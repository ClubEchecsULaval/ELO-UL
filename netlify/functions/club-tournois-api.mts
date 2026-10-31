import type {Config} from '@netlify/functions';
import {eq,and,asc,desc,inArray,sql} from 'drizzle-orm';
import {db} from '../../db/index.js';
import {ulTournaments as tournaments,ulTournamentPlayers as players,ulTournamentRounds as rounds,ulTournamentPairings as pairs} from '../../db/tournament-schema.js';
import {isAdmin,sameOrigin,json} from '../../lib/tournament-auth.mjs';
import {pairSwiss,standings} from '../../lib/swiss.mjs';

class APIError extends Error {constructor(public status:number,message:string){super(message);}}
const fail=(status:number,msg:string):never=>{throw new APIError(status,msg);};
const validId=(s:string)=>{const x=Number(s);return Number.isSafeInteger(x)&&x>0?x:fail(400,'Identifiant incorrect.');};
const validText=(v:unknown,max=100)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(422,'Texte manquant ou trop long.');return (v as string).trim();};
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim().replace(/\s+/g,' ');
const withNoCache = (data:unknown,status=200)=>json(data,status);

async function findTournament(id:number,tx:any=db) {
 const [t]=await tx.select().from(tournaments).where(eq(tournaments.id,id));
 return t||fail(404,'Tournoi introuvable.');
}
async function readDetails(id:number, admin=false){
 const t=await findTournament(id);
 if(t.status==='draft'&&!admin)fail(404,'Tournoi introuvable.');
 const ps=await db.select().from(players).where(eq(players.tournamentId,id)).orderBy(asc(players.id));
 const rs=await db.select().from(rounds).where(eq(rounds.tournamentId,id)).orderBy(asc(rounds.number));
 const matches=rs.length?await db.select().from(pairs).where(inArray(pairs.roundId,rs.map(r=>r.id))).orderBy(asc(pairs.id)):[];
 const rm=new Map(rs.map(r=>[r.id,r.number]));
 const games=matches.map(p=>({id:p.id,roundId:p.roundId,round:rm.get(p.roundId),board:p.board,whitePlayerId:p.whitePlayerId,blackPlayerId:p.blackPlayerId,result:p.result}));
 const score=standings(ps,games);
 return {tournament:t,players:ps.map(p=>({id:p.id,name:p.name,seedRating:p.seedRating,active:p.active})),rounds:rs.map(r=>({id:r.id,number:r.number,status:r.status,pairings:games.filter(g=>g.roundId===r.id)})),standings:score.map(({opponents,...s})=>s)};
}

async function createTournament(body:any){
 const name=validText(body.name,120);const number=Number(body.roundsPlanned);
 if(!Number.isInteger(number)||number<1||number>15)fail(422,'Nombre de rondes entre 1 et 15 requis.');
 const [record]=await db.insert(tournaments).values({name,roundsPlanned:number,format:'swiss',status:'draft'}).returning();
 return {id:record.id,tournament:record};
}
/**
 * Participants modifiables avant le début ou ENTRE deux rondes terminées.
 * Ne jamais modifier le roster d'une ronde dont des parties restent en cours.
 * À exécuter après le verrouillage de la ligne du tournoi (FOR UPDATE).
 */
async function assertRosterEditable(tid:number,tx:any){
 const t=await findTournament(tid,tx);
 if(t.status==='finished')fail(409,'Tournoi terminé : participants non modifiables.');
 const rs=await tx.select().from(rounds).where(eq(rounds.tournamentId,tid)).orderBy(desc(rounds.number));
 if(rs.length){
  if(rs[0].status!=='finished')fail(409,'Terminez toutes les parties de la ronde actuelle avant de modifier les joueurs.');
  if(rs.length>=t.roundsPlanned)fail(409,'Toutes les rondes sont terminées.');
 }
 return t;
}

/** Supprime un tournoi et uniquement ses données (rondes, appariements, joueurs).
 *  L'opération exige une session organisateur ET une confirmation du nom exact.
 *  L'ordre explicite protège les clés étrangères RESTRICT et rend la suppression atomique.
 */
async function deleteTournament(tid:number,body:any){
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM ul_tournaments WHERE id = ${tid} FOR UPDATE`);
  const t=await findTournament(tid,tx);
  if(typeof body.confirmation!=='string' || body.confirmation!==t.name){
   fail(422,'La confirmation du nom du tournoi est incorrecte.');
  }
  const rs=await tx.select({id:rounds.id}).from(rounds).where(eq(rounds.tournamentId,tid));
  if(rs.length){
   await tx.delete(pairs).where(inArray(pairs.roundId,rs.map(r=>r.id)));
  }
  await tx.delete(rounds).where(eq(rounds.tournamentId,tid));
  await tx.delete(players).where(eq(players.tournamentId,tid));
  await tx.delete(tournaments).where(eq(tournaments.id,tid));
  return {ok:true,deleted:true};
 });
}

async function addPlayer(tid:number,body:any){
 const name=validText(body.name,100);const seedRating=body.seedRating===undefined||body.seedRating===''?1200:Number(body.seedRating);
 if(!Number.isInteger(seedRating)||seedRating<0||seedRating>3500)fail(422,'Cote initiale entre 0 et 3500 requise.');
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM ul_tournaments WHERE id = ${tid} FOR UPDATE`);
  await assertRosterEditable(tid,tx);
  const existing=await tx.select().from(players).where(eq(players.tournamentId,tid));
  if(existing.length>=128)fail(409,'Maximum de 128 joueurs.');
  if(existing.some(p=>p.normalizedName===normalized(name)))fail(409,'Ce joueur existe déjà. Utilisez Réintégrer s’il est retiré.');
  const [player]=await tx.insert(players).values({tournamentId:tid,name,normalizedName:normalized(name),seedRating}).returning();
  return {player};
 });
}
async function addPlayersBatch(tid:number,body:any){
 const raw=body.names;
 if(typeof raw!=='string'||!raw.trim()||raw.length>16000)fail(422,'Liste de joueurs invalide.');
 const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length||lines.length>128)fail(422,'Saisissez entre 1 et 128 noms.');
 const incoming=lines.map(line=>{
  const parts=line.split(';');if(parts.length>2)fail(422,'Format attendu : un nom par ligne, suivi éventuellement de ; cote.');
  const name=validText(parts[0],100);
  const seedRating=parts[1]===undefined||!parts[1].trim()?1200:Number(parts[1].trim());
  if(!Number.isInteger(seedRating)||seedRating<0||seedRating>3500)fail(422,'Cote incorrecte pour '+name);
  return {name,normalizedName:normalized(name),seedRating,tournamentId:tid};
 });
 const uniq=new Set(incoming.map(p=>p.normalizedName));
 if(uniq.size!==incoming.length)fail(409,'Un nom est répété dans la liste.');
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM ul_tournaments WHERE id = ${tid} FOR UPDATE`);
  await assertRosterEditable(tid,tx);
  const existing=await tx.select().from(players).where(eq(players.tournamentId,tid));
  if(existing.length+incoming.length>128)fail(409,'Maximum de 128 joueurs.');
  if(incoming.some(p=>existing.some(old=>old.normalizedName===p.normalizedName)))fail(409,'Un nom existe déjà dans ce tournoi. Réintégrez le joueur retiré plutôt que de le dupliquer.');
  await tx.insert(players).values(incoming);
  return {ok:true,added:incoming.length};
 });
}
// Retrait non destructif : les parties et points déjà acquis sont conservés.
async function setPlayerActive(tid:number,pid:number,active:boolean){
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM ul_tournaments WHERE id = ${tid} FOR UPDATE`);
  await assertRosterEditable(tid,tx);
  const [p]=await tx.select().from(players).where(and(eq(players.id,pid),eq(players.tournamentId,tid)));
  if(!p)fail(404,'Joueur introuvable.');
  if(p.active===active)return {ok:true,active};
  await tx.update(players).set({active}).where(eq(players.id,pid));
  return {ok:true,active};
 });
}

async function newRound(tid:number){
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM ul_tournaments WHERE id = ${tid} FOR UPDATE`);
  const t=await findTournament(tid,tx);
  if(t.status==='finished')fail(409,'Ce tournoi est terminé.');
  const ps=await tx.select().from(players).where(eq(players.tournamentId,tid));
  if(ps.filter(p=>p.active).length<2)fail(409,'Il faut au moins deux joueurs actifs pour lancer une ronde.');
  const rs=await tx.select().from(rounds).where(eq(rounds.tournamentId,tid)).orderBy(asc(rounds.number));
  const n=rs.length+1;if(n>t.roundsPlanned)fail(409,'Nombre maximal de rondes atteint.');
  const previous=rs.length?await tx.select().from(pairs).where(inArray(pairs.roundId,rs.map(r=>r.id))):[];
  if(previous.some(p=>!p.result))fail(409,'Tous les résultats doivent être saisis avant la ronde suivante.');
  if(rs.length)await tx.update(rounds).set({status:'finished'}).where(eq(rounds.id,rs.at(-1)!.id));
  const ordered=previous.map(p=>({...p,round:rs.find(r=>r.id===p.roundId)?.number ?? 0})).sort((a,b)=>a.round-b.round||a.id-b.id);
  const pairings=pairSwiss(ps,ordered,n);
  const [round]=await tx.insert(rounds).values({tournamentId:tid,number:n,status:'active'}).returning();
  await tx.insert(pairs).values(pairings.map(p=>({...p,roundId:round.id})));
  await tx.update(tournaments).set({status:'active'}).where(eq(tournaments.id,tid));
  return {ok:true,round:n};
 });
}
async function saveResult(tid:number,pairingId:number,body:any){
 const result=body.result;if(!['1-0','0-1','1/2-1/2'].includes(result))fail(422,'Résultat invalide.');
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM ul_tournaments WHERE id = ${tid} FOR UPDATE`);
  const t=await findTournament(tid,tx);
  const rs=await tx.select().from(rounds).where(eq(rounds.tournamentId,tid)).orderBy(desc(rounds.number));
  const r=rs[0];if(!r)fail(409,'Aucune ronde commencée.');
  const [match]=await tx.select().from(pairs).where(and(eq(pairs.id,pairingId),eq(pairs.roundId,r.id)));
  if(!match)fail(404,'Appariement introuvable dans la ronde actuelle.');
  if(!match.blackPlayerId)fail(409,'Le repos automatique ne peut pas être modifié.');
  // Les organisateurs peuvent corriger une erreur de saisie sur la dernière ronde,
  // même après la clôture; aucun joueur non autorisé n'a accès à cette route.
  await tx.update(pairs).set({result}).where(eq(pairs.id,pairingId));
  const all=await tx.select().from(pairs).where(eq(pairs.roundId,r.id));
  const complete=all.every(p=>p.id===pairingId?true:!!p.result);
  await tx.update(rounds).set({status:complete?'finished':'active'}).where(eq(rounds.id,r.id));
  if(complete&&r.number===t.roundsPlanned)await tx.update(tournaments).set({status:'finished'}).where(eq(tournaments.id,tid));
  return {ok:true,complete};
 });
}
async function finishTournament(tid:number){
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM ul_tournaments WHERE id = ${tid} FOR UPDATE`);
  const t=await findTournament(tid,tx);if(t.status==='draft')fail(409,'Aucune ronde jouée.');
  const rs=await tx.select().from(rounds).where(eq(rounds.tournamentId,tid)).orderBy(desc(rounds.number));
  const all=await tx.select().from(pairs).where(eq(pairs.roundId,rs[0].id));
  if(all.some(p=>!p.result))fail(409,'Des résultats sont encore manquants.');
  await tx.update(rounds).set({status:'finished'}).where(eq(rounds.id,rs[0].id));
  await tx.update(tournaments).set({status:'finished'}).where(eq(tournaments.id,tid));
  return {ok:true};
 });
}
async function route(req:Request){
 const url=new URL(req.url);
 const parts=url.pathname.replace(/\/+$/,'').split('/').slice(3); // api/club-tournois/{id}/...
 const admin=isAdmin(req);
 if(req.method==='GET'){
  if(parts.length===0){const ts=admin?await db.select().from(tournaments).orderBy(desc(tournaments.id)):await db.select().from(tournaments).where(sql`${tournaments.status} <> 'draft'`).orderBy(desc(tournaments.id));return withNoCache({tournaments:ts,admin});}
  if(parts.length===1)return withNoCache(await readDetails(validId(parts[0]),admin));
  return fail(404,'Route introuvable.');
 }
 if(req.method!=='POST')return fail(405,'Méthode non permise.');
 if(!sameOrigin(req))return fail(403,'Origine de requête invalide.');
 if(!admin)return fail(401,'Code organisateur requis.');
 if(!req.headers.get('content-type')?.includes('application/json'))return fail(415,'JSON attendu.');
 let body:any;try{body=await req.json();}catch{return fail(400,'JSON invalide.');}
 if(!body || typeof body!=='object' || Array.isArray(body))return fail(400,'Objet JSON attendu.');
 if(parts.length===0)return withNoCache(await createTournament(body),201);
 const id=validId(parts[0]);
 if(parts[1]==='delete'&&parts.length===2)return withNoCache(await deleteTournament(id,body));
 if(parts[1]==='players'&&parts.length===2)return withNoCache(await addPlayer(id,body),201);
 if(parts[1]==='players'&&parts[2]==='batch'&&parts.length===3)return withNoCache(await addPlayersBatch(id,body),201);
 if(parts[1]==='players'&&parts[3]==='remove'&&parts.length===4)return withNoCache(await setPlayerActive(id,validId(parts[2]),false));
 if(parts[1]==='players'&&parts[3]==='reinstate'&&parts.length===4)return withNoCache(await setPlayerActive(id,validId(parts[2]),true));
 if(parts[1]==='rounds'&&parts.length===2)return withNoCache(await newRound(id),201);
 if(parts[1]==='pairings'&&parts[3]==='result'&&parts.length===4)return withNoCache(await saveResult(id,validId(parts[2]),body));
 if(parts[1]==='finish'&&parts.length===2)return withNoCache(await finishTournament(id));
 return fail(404,'Route introuvable.');
}
export default async function(req:Request){
 try {return await route(req);}catch(err){
  if(err instanceof APIError)return json({error:err.message},err.status);
  console.error('Erreur de tournoi:',err);
  return json({error:'Erreur interne. Vérifiez la configuration de la base Netlify et ses migrations.'},500);
 }
}
export const config:Config={
 path:['/club-api/tournois','/club-api/tournois/*'],
 excludedPath:['/club-api/tournois/session'],
 rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['ip','domain']},
};
