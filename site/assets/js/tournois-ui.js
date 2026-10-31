// Club d'échecs UL — tournament pages. All writes run through server-side authorization.
const API='/club-api/tournois';
const $=(sel,root=document)=>root.querySelector(sel);
const esc=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabel=s=>({draft:'En préparation',active:'En cours',finished:'Terminé'})[s]??s;
const resultLabel=s=>({'1-0':'1 – 0','0-1':'0 – 1','1/2-1/2':'½ – ½',BYE:'Bye',null:'À jouer'})[s??'null']??'À jouer';
async function api(path='',payload){
  const options={credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json'}};
  if(payload!==undefined){options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify(payload);}
  let res;
  try{res=await fetch(API+path,options);}catch{throw Error('Connexion au serveur impossible.');}
  let data;try{data=await res.json();}catch{throw Error('Réponse inattendue du serveur.');}
  if(!res.ok)throw Error(data.error||`Erreur ${res.status}`);
  return data;
}
const tournamentLabel=t=>`${esc(t.name)} <small>${esc(statusLabel(t.status))} · ${t.roundsPlanned} ronde${t.roundsPlanned>1?'s':''}</small>`;
function listButton(t,id,cb){const b=document.createElement('button');b.className='tournament-list-item'+(id===t.id?' is-active':'');b.type='button';b.dataset.id=t.id;b.innerHTML=`<strong>${esc(t.name)}</strong><small>${esc(statusLabel(t.status))} · ${t.roundsPlanned} ronde(s)</small>`;b.addEventListener('click',()=>cb(t.id));return b;}
function roundsTable(r,players,editable=false){
 const playerName=new Map(players.map(p=>[p.id,p.name]));
 const rows=r.pairings.slice().sort((a,b)=>(a.board??999)-(b.board??999)).map(p=>{
  const white=esc(playerName.get(p.whitePlayerId)||'—'),black=p.blackPlayerId?esc(playerName.get(p.blackPlayerId)||'—'):'Bye';
  const result=p.blackPlayerId?esc(resultLabel(p.result)):'0,5 point (Bye)';
  const selector=editable && p.blackPlayerId ? `<select class="tournament-result-select" aria-label="Résultat de la table ${p.board}" data-pairing-id="${p.id}"><option value="">Choisir…</option><option value="1-0" ${p.result==='1-0'?'selected':''}>1 – 0</option><option value="0-1" ${p.result==='0-1'?'selected':''}>0 – 1</option><option value="1/2-1/2" ${p.result==='1/2-1/2'?'selected':''}>½ – ½</option></select><button class="tournament-submit-result" data-save-result="${p.id}" type="button">Enregistrer</button>` : result;
  return `<tr><td>${p.board??'—'}</td><td>${white}</td><td>${black}</td><td>${selector}</td></tr>`;
 }).join('');
 return `<section class="tournament-round"><div class="tournament-round-head"><h4>Ronde ${r.number}</h4><span class="tournament-label ${r.status==='active'?'is-live':''}">${r.status==='active'?'En cours':'Terminée'}</span></div><div class="tournament-table-wrap"><table class="tournament-table"><thead><tr><th>Table</th><th>Blancs</th><th>Noirs</th><th>Résultat</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function scoreboard(details){
 const rows=details.standings.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.name)}${p.active===false?' <small>(retiré)</small>':''}</td><td>${p.points}</td><td>${p.played}</td><td>${p.wins}</td><td>${p.draws}</td></tr>`).join('');
 return `<div class="tournament-table-wrap"><table class="tournament-table"><thead><tr><th>Rang*</th><th>Joueur</th><th>Points</th><th>Parties</th><th>V</th><th>N</th></tr></thead><tbody>${rows}</tbody></table></div><p class="tournament-muted" style="font-size:.8rem">* Classement indicatif par points, puis cote initiale. Les départages officiels ne sont pas calculés.</p>`;
}
function detailsHtml(d,editable=false){
 const t=d.tournament;
 return `<div><div class="panel-heading"><div><strong>${esc(t.name)}</strong><div class="tournament-open-status">Suisse simplifié · ${esc(statusLabel(t.status))} · ${d.players.filter(p=>p.active!==false).length} actifs / ${d.players.length} inscrits</div></div><span class="tournament-label">${d.rounds.length} / ${t.roundsPlanned} rondes</span></div>
 ${d.rounds.length?'<h4 class="tournament-section-title">Appariements et résultats</h4>'+d.rounds.slice().reverse().map(r=>roundsTable(r,d.players,editable && r.number===d.rounds.length)).join(''):'<p class="tournament-muted">Aucune ronde lancée.</p>'}
 <h4 class="tournament-section-title">Classement provisoire</h4>${scoreboard(d)}</div>`;
}
const publicList=$('#public-tournaments'),publicDetail=$('#public-tournament-detail');
if(publicList){
 let selectedId=null,refreshing=false;
 const select=async(id)=>{selectedId=id;[...publicList.children].forEach(x=>x.classList.toggle('is-active',Number(x.dataset.id)===id));try{const d=await api('/'+id);publicDetail.innerHTML=detailsHtml(d);$('#t-detail-title').textContent='Appariements & classement';}catch(e){publicDetail.textContent=e.message;}};
 const refresh=async()=>{if(refreshing)return;refreshing=true;try{
  const d=await api();publicList.replaceChildren();
  if(!d.tournaments.length){publicList.innerHTML='<p class="tournament-muted">Aucun tournoi publié pour le moment. Les organisateurs pourront créer le prochain tournoi ici.</p>';publicDetail.innerHTML='<p class="tournament-muted">Les appariements apparaîtront lors de la première ronde.</p>';selectedId=null;}
  else{d.tournaments.forEach(t=>publicList.appendChild(listButton(t,selectedId,select)));
   if(!selectedId||!d.tournaments.some(t=>t.id===selectedId))selectedId=d.tournaments[0].id;
   [...publicList.children].forEach(x=>x.classList.toggle('is-active',Number(x.dataset.id)===selectedId));await select(selectedId);
  }
  $('#public-update-status').textContent='Actualisé à '+new Date().toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'});
 }catch(e){publicList.textContent=e.message;$('#public-update-status').textContent='Erreur de chargement';}finally{refreshing=false;}};
 $('#public-refresh')?.addEventListener('click',refresh);refresh();
 setInterval(()=>{if(!document.hidden)refresh();},15000);
}
const adminPanel=$('#tournament-admin');
if(adminPanel){
 let selected=null;let list=[];let currentDetails=null;
 const flash=(msg,good=false)=>{const e=$('#admin-flash');e.textContent=msg;e.classList.toggle('is-success',good);};
 const login=$('#tournament-login');
 const showSession=(admin)=>{login.hidden=admin;adminPanel.hidden=!admin;if(admin)refreshAdmin();};
 const adminList=$('#admin-tournaments'),detail=$('#admin-tournament-detail');
 const refreshAdmin=async()=>{try{
   const d=await api();list=d.tournaments;adminList.replaceChildren();
   if(!list.length){adminList.innerHTML='<p class="tournament-muted">Aucun tournoi. Créez-en un ci-dessus.</p>';selected=null;detail.innerHTML='<p class="tournament-muted">Sélectionnez un tournoi.</p>';return;}
   if(!list.some(t=>t.id===selected))selected=list[0].id;
   list.forEach(t=>adminList.appendChild(listButton(t,selected,async id=>{selected=id;await refreshAdmin();})));
   await loadDetail();
  }catch(e){flash(e.message);}};
 const mutate=async(path,payload)=>{try{const res=await api(path,payload);flash('Modification enregistrée.',true);await refreshAdmin();return res;}catch(e){flash(e.message);return null;}};
 const loadDetail=async()=>{
  if(!selected)return;currentDetails=await api('/'+selected);const d=currentDetails,t=d.tournament;
  $('#admin-tournament-status').textContent=statusLabel(t.status);
  const latest=d.rounds.at(-1),complete=!!latest?.pairings.every(p=>p.result);
  const canEditRoster=t.status==='draft'||(t.status==='active' && complete && d.rounds.length<t.roundsPlanned);
  let html=detailsHtml(d,true);
  if(canEditRoster){
   html+=`<hr class="tournament-section-divider"><h4 class="tournament-section-title">Ajouter un joueur</h4>
   <form id="add-player-form" class="tournament-form"><label>Nom complet<input name="name" required maxlength="100" placeholder="Prénom Nom"></label><label>Cote de départ (facultatif)<input type="number" name="seedRating" min="0" max="3500" value="1200"></label><button class="btn btn-primary" type="submit">Ajouter le joueur</button></form>
   <h4 class="tournament-section-title">Ajouter plusieurs joueurs</h4><form id="batch-player-form" class="tournament-form"><label>Un joueur par ligne (facultatif : Nom ; cote)<textarea name="names" required rows="5" maxlength="16000" placeholder="Camille Tremblay ; 1540&#10;Maxime Roy ; 1210&#10;Alex Martin"></textarea></label><button class="btn btn-outline" type="submit">Ajouter toute la liste</button></form>
   <h4 class="tournament-section-title">Participants</h4><p class="tournament-muted">Les retraits s'appliquent aux prochaines rondes seulement : les résultats déjà obtenus restent au classement.</p><div class="tournament-table-wrap"><table class="tournament-table"><thead><tr><th>Nom</th><th>Cote initiale</th><th>Statut</th><th>Action</th></tr></thead><tbody>${d.players.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.seedRating}</td><td>${p.active===false?'Retiré':'Actif'}</td><td>${p.active===false?`<button type="button" class="tournament-small-button" data-reinstate-player="${p.id}">Réintégrer</button>`:`<button type="button" class="tournament-small-button" data-remove-player="${p.id}">Retirer</button>`}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if(!canEditRoster && t.status==='active')html+='<p class="tournament-muted">Pour ajouter ou retirer des joueurs, enregistrez d’abord tous les résultats de la ronde en cours. La gestion se rouvrira avant la ronde suivante.</p>';
  html+=`<div class="tournament-admin-actions">${t.status!=='finished' && d.rounds.length<t.roundsPlanned && (!latest || complete)?'<button class="btn btn-primary" id="generate-round" type="button">'+(d.rounds.length?'Générer la ronde suivante':'Lancer la ronde 1')+'</button>':''}
 ${t.status==='active'&&complete?'<button class="btn btn-outline" id="finish-tournament" type="button">Terminer ce tournoi</button>':''}
 <button class="btn btn-outline" id="export-tournament" type="button">Exporter JSON ↓</button></div>
 <p class="tournament-admin-info">Les joueurs consultent leurs tables sur la page <a href="/tournois/">Tournois</a>. Seul le comité peut enregistrer les résultats. Les changements sont conservés dans la base du site.</p>`;
  detail.innerHTML=html;
  $('#add-player-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=new FormData(e.target);await mutate('/'+selected+'/players',{name:form.get('name'),seedRating:form.get('seedRating')});});
  $('#batch-player-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=new FormData(e.target);await mutate('/'+selected+'/players/batch',{names:form.get('names')});});
  detail.querySelectorAll('[data-remove-player]').forEach(btn=>btn.addEventListener('click',()=>{if(confirm('Retirer ce joueur des prochaines rondes ? Ses résultats passés seront conservés.'))mutate('/'+selected+'/players/'+btn.dataset.removePlayer+'/remove',{});}));
  detail.querySelectorAll('[data-reinstate-player]').forEach(btn=>btn.addEventListener('click',()=>{if(confirm('Réintégrer ce joueur aux prochaines rondes ?'))mutate('/'+selected+'/players/'+btn.dataset.reinstatePlayer+'/reinstate',{});}));
  $('#generate-round')?.addEventListener('click',()=>{if(confirm('Générer et publier les appariements de la prochaine ronde ?'))mutate('/'+selected+'/rounds',{});});
  $('#finish-tournament')?.addEventListener('click',()=>{if(confirm('Terminer définitivement ce tournoi ?'))mutate('/'+selected+'/finish',{});});
  detail.querySelectorAll('[data-save-result]').forEach(btn=>btn.addEventListener('click',()=>{const select=detail.querySelector(`[data-pairing-id="${btn.dataset.saveResult}"]`);if(!select.value){flash('Choisissez un résultat.');return;}mutate('/'+selected+'/pairings/'+btn.dataset.saveResult+'/result',{result:select.value});}));
  $('#export-tournament')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(currentDetails,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`tournoi-ul-${selected}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);});
 };
 $('#tournament-login-form').addEventListener('submit',async e=>{e.preventDefault();const code=$('#organizer-code').value;try{await api('/session',{code});$('#organizer-code').value='';$('#login-flash').textContent='';showSession(true);}catch(err){$('#login-flash').textContent=err.message;}});
 $('#admin-logout').addEventListener('click',async()=>{try{await api('/session',{action:'logout'});}catch{}showSession(false);});
 $('#create-tournament-form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);try{const res=await api('',{name:f.get('name'),roundsPlanned:Number(f.get('rounds'))});selected=res.id;flash('Tournoi créé. Ajoutez maintenant les participants.',true);e.target.reset();await refreshAdmin();}catch(err){flash(err.message);}});
 api('/session').then(s=>showSession(s.admin)).catch(()=>showSession(false));
}
