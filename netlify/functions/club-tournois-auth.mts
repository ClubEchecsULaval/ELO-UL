import type {Config} from '@netlify/functions';
import {checkCode,isAdmin,sessionCookie,clearCookie,sameOrigin,json} from '../../lib/tournament-auth.mjs';
export default async function(req:Request) {
  if(req.method==='GET') return json({admin:isAdmin(req)});
  if(req.method!=='POST') return json({error:'Méthode non permise.'},405);
  if(!sameOrigin(req)) return json({error:'Origine de requête invalide.'},403);
  if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'JSON attendu.'},415);
  let body:Record<string,unknown>;
  try{body=await req.json();}catch{return json({error:'JSON invalide.'},400);}
  if(!body || typeof body!=='object' || Array.isArray(body))return json({error:'Objet JSON attendu.'},400);
  if(body.action==='logout')return json({admin:false},200,{'Set-Cookie':clearCookie(req)});
  if(!checkCode(body.code))return json({error:'Code incorrect ou configuration manquante.'},401);
  return json({admin:true},200,{'Set-Cookie':sessionCookie(req)});
}
export const config:Config={path:'/club-api/tournois/session',rateLimit:{windowLimit:8,windowSize:60,aggregateBy:['ip','domain']}};
