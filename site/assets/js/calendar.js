// Calendrier officiel du Club d'échecs UL. Les activités proviennent de Netlify Database.
(() => {
  const $ = id => document.getElementById(id);
  const grid = $('calendar-days');
  if (!grid) return;

  const API = '/club-api/tournois/calendrier';
  const SESSION = '/club-api/tournois/session';
  const labels = {jeu_libre:'Jeu libre', atelier:'Atelier', tournoi:'Tournoi'};
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let month = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  let filter = 'tous';
  let events = [];
  let loggedIn = false;

  const dateKey = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  const dateFromKey = k => {const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12);};
  const shortMonth = d => new Intl.DateTimeFormat('fr-CA',{month:'short'}).format(d).replace('.','').toUpperCase();
  const timeText = t => t.replace(':', ' h ');
  const showError = (id, message, ok=false) => {const el=$(id);if(el){el.textContent=message;el.classList.toggle('is-success',ok);}};

  async function request(url, payload) {
    const opts={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
    if(payload!==undefined){opts.method='POST';opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(payload);}
    const r=await fetch(url,opts);
    let result;
    try{result=await r.json();}catch{throw Error('Réponse inattendue du serveur.');}
    if(!r.ok) throw Error(result.error||`Erreur ${r.status}`);
    return result;
  }

  function render() {
    const year=month.getFullYear(), monthNum=month.getMonth();
    const active=events.filter(e=>{
      const d=dateFromKey(e.eventDate);
      return d.getFullYear()===year && d.getMonth()===monthNum && (filter==='tous' || e.category===filter);
    });
    $('calendar-month-label').textContent=new Intl.DateTimeFormat('fr-CA',{month:'long',year:'numeric'}).format(month);
    grid.replaceChildren();
    ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(x=>{
      const node=document.createElement('div');node.className='calendar-day-name';node.textContent=x;node.setAttribute('role','columnheader');grid.append(node);
    });
    const first=new Date(year,monthNum,1,12),offset=(first.getDay()+6)%7;
    const days=new Date(year,monthNum+1,0,12).getDate();
    const cells=Math.ceil((days+offset)/7)*7;
    for(let i=0;i<cells;i++){
      const d=new Date(year,monthNum,i-offset+1,12),key=dateKey(d);
      const cell=document.createElement('div');cell.className='calendar-cell';cell.setAttribute('role','gridcell');
      if(d.getMonth()!==monthNum)cell.classList.add('muted');
      if(key===dateKey(today))cell.classList.add('today');
      const number=document.createElement('span');number.className='calendar-number';number.textContent=d.getDate();cell.append(number);
      active.filter(e=>e.eventDate===key).forEach(e=>{
        const mark=document.createElement('span');mark.className='calendar-mark tag-'+e.category;
        mark.textContent=`${labels[e.category]||e.category} · ${timeText(e.startTime)}`;
        mark.title=`${e.name} — ${e.location}`;
        cell.append(mark);
      });
      grid.append(cell);
    }

    const list=$('calendar-list');list.replaceChildren();
    $('calendar-count').textContent=`${active.length} activité${active.length>1?'s':''}`;
    if(!active.length){
      const empty=document.createElement('div');empty.className='no-events';empty.textContent='Aucune activité prévue pour ce mois et ce filtre.';list.append(empty);return;
    }
    for(const e of active){
      const d=dateFromKey(e.eventDate);
      const row=document.createElement('div');row.className='event-list-row';
      const date=document.createElement('div');date.className='event-date';date.textContent=String(d.getDate());
      const mm=document.createElement('small');mm.textContent=shortMonth(d);date.append(mm);
      const content=document.createElement('div');content.className='calendar-event-content';
      const title=document.createElement('strong');title.textContent=e.name;
      const meta=document.createElement('span');meta.textContent=`${labels[e.category]||e.category} · ${timeText(e.startTime)} · ${e.location}`;
      content.append(title,meta);
      const badge=document.createElement('span');badge.className='event-pill';badge.textContent=labels[e.category]||e.category;
      row.append(date,content,badge);list.append(row);
    }
  }

  async function reloadActivities() {
    const data=await request(API);
    events=Array.isArray(data.events)?data.events:[];
    render();
    if(loggedIn)renderOrganizerList();
  }

  function renderOrganizerList() {
    const list=$('calendar-admin-events');list.replaceChildren();
    if(!events.length){const p=document.createElement('p');p.className='calendar-empty-admin';p.textContent='Aucune activité enregistrée.';list.append(p);return;}
    for(const e of events){
      const row=document.createElement('div');row.className='calendar-admin-event';
      const content=document.createElement('div');
      const name=document.createElement('strong');name.textContent=e.name;
      const meta=document.createElement('small');meta.textContent=`${e.eventDate} · ${timeText(e.startTime)} · ${e.location} · ${labels[e.category]||e.category}`;
      content.append(name,meta);
      const del=document.createElement('button');del.type='button';del.className='calendar-delete';del.textContent='Supprimer';
      del.addEventListener('click',async()=>{
        const confirmation=window.prompt(`Pour supprimer définitivement « ${e.name} », entrez exactement son nom :`);
        if(confirmation!==e.name)return;
        try{await request(`${API}/${e.id}/delete`,{confirmation});await reloadActivities();showError('calendar-admin-feedback','Activité supprimée.',true);}
        catch(err){showError('calendar-admin-feedback',err.message);}
      });
      row.append(content,del);list.append(row);
    }
  }

  function showOrganizer(admin) {
    loggedIn=admin;
    $('calendar-login-box').hidden=admin;
    $('calendar-admin-panel').hidden=!admin;
    if(admin)renderOrganizerList();
  }

  $('calendar-prev').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1,12);render();});
  $('calendar-next').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1,12);render();});
  $('calendar-today').addEventListener('click',()=>{month=new Date(today.getFullYear(),today.getMonth(),1,12);render();});
  document.querySelectorAll('[data-calendar-filter]').forEach(button=>button.addEventListener('click',()=>{
    filter=button.dataset.calendarFilter;
    document.querySelectorAll('[data-calendar-filter]').forEach(el=>el.classList.toggle('active',el===button));render();
  }));

  $('calendar-manage-toggle').addEventListener('click',async()=>{
    const area=$('calendar-admin-area');area.hidden=!area.hidden;
    $('calendar-manage-toggle').setAttribute('aria-expanded',String(!area.hidden));
    if(area.hidden)return;
    try{const session=await request(SESSION);showOrganizer(Boolean(session.admin));}
    catch(err){showOrganizer(false);showError('calendar-login-feedback','Vérification de session impossible : '+err.message);}
  });
  $('calendar-login-form').addEventListener('submit',async ev=>{
    ev.preventDefault();const code=$('calendar-admin-code').value;
    try{await request(SESSION,{code});$('calendar-admin-code').value='';showError('calendar-login-feedback','');showOrganizer(true);}
    catch(err){showError('calendar-login-feedback',err.message);}
  });
  $('calendar-logout').addEventListener('click',async()=>{
    try{await request(SESSION,{action:'logout'});}catch(err){showError('calendar-admin-feedback',err.message);return;}
    showOrganizer(false);showError('calendar-login-feedback','Session terminée.');
  });
  $('calendar-event-form').addEventListener('submit',async ev=>{
    ev.preventDefault();const form=ev.currentTarget;
    const fd=new FormData(form);
    const payload={name:fd.get('name'),date:fd.get('date'),time:fd.get('time'),location:fd.get('location'),category:fd.get('category')};
    const button=$('calendar-submit');button.disabled=true;
    try{
      await request(API,payload);
      await reloadActivities();
      month=new Date(Number(payload.date.slice(0,4)),Number(payload.date.slice(5,7))-1,1,12);
      render();form.reset();$('calendar-event-date').value=dateKey(today);
      showError('calendar-admin-feedback','Activité publiée dans le calendrier.',true);
    }catch(err){showError('calendar-admin-feedback',err.message);}
    finally{button.disabled=false;}
  });

  $('calendar-event-date').value=dateKey(today);
  render();
  reloadActivities().catch(err=>{
    $('calendar-count').textContent='Chargement impossible';
    const list=$('calendar-list');list.replaceChildren();
    const p=document.createElement('p');p.className='no-events';p.textContent='Impossible de charger les activités : '+err.message;list.append(p);
  });
  setInterval(()=>{if(!document.hidden)reloadActivities().catch(()=>{});},60000);
})();
