(() => {
  const $=id=>document.getElementById(id);
  const calendar=$('calendar-days');
  if(!calendar)return;
  const today=new Date();
  today.setHours(12,0,0,0);
  let month=new Date(today.getFullYear(),today.getMonth(),1,12);
  let filter='tous';
  const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const datePlus=(months,day)=>new Date(today.getFullYear(),today.getMonth()+months,day,12);
  // Exemples visuels uniquement : n'afficher comme vrais événements officiels en aucun cas.
  const demoEvents=[
    {day:datePlus(0,8),title:'Exemple · Soirée libre',category:'rencontre',time:'18 h 00'},
    {day:datePlus(0,17),title:'Exemple · Tournoi blitz',category:'tournoi',time:'19 h 00'},
    {day:datePlus(0,25),title:'Exemple · Atelier de stratégie',category:'atelier',time:'17 h 30'},
    {day:datePlus(1,6),title:'Exemple · Soirée libre',category:'rencontre',time:'18 h 00'},
    {day:datePlus(1,20),title:'Exemple · Tournoi rapide',category:'tournoi',time:'13 h 00'}
  ];
  const categoryLabel={rencontre:'Rencontre',tournoi:'Tournoi',atelier:'Atelier'};
  const shortMonth = date => new Intl.DateTimeFormat('fr-CA',{month:'short'}).format(date).replace('.','').toUpperCase();
  function render(){
    const active=$('show-demo-calendar').checked ? demoEvents.filter(e=>e.day.getFullYear()===month.getFullYear()&&e.day.getMonth()===month.getMonth()&&(filter==='tous'||e.category===filter)):[];
    $('calendar-month-label').textContent=new Intl.DateTimeFormat('fr-CA',{month:'long',year:'numeric'}).format(month);
    calendar.replaceChildren();
    ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(x=>{const node=document.createElement('div');node.className='calendar-day-name';node.textContent=x;node.setAttribute('role','columnheader');calendar.append(node);});
    const first=new Date(month.getFullYear(),month.getMonth(),1,12); const offset=(first.getDay()+6)%7;
    const days=new Date(month.getFullYear(),month.getMonth()+1,0,12).getDate();
    const cells=Math.ceil((days+offset)/7)*7;
    for(let i=0;i<cells;i++){
      const d=new Date(month.getFullYear(),month.getMonth(),i-offset+1,12);
      const cell=document.createElement('div');cell.className='calendar-cell';cell.setAttribute('role','gridcell');
      if(d.getMonth()!==month.getMonth())cell.classList.add('muted');
      if(dateKey(d)===dateKey(today))cell.classList.add('today');
      const dayLabel=document.createElement('span');dayLabel.className='calendar-number';dayLabel.textContent=d.getDate();cell.append(dayLabel);
      active.filter(e=>dateKey(e.day)===dateKey(d)).forEach(e=>{const mark=document.createElement('span');mark.className='calendar-mark tag-'+e.category;mark.textContent=categoryLabel[e.category]+' · EXEMPLE';mark.title=e.title;cell.append(mark);});
      calendar.append(cell);
    }
    const list=$('calendar-list');list.replaceChildren();
    $('calendar-count').textContent=active.length+' événement'+(active.length>1?'s':'')+' exemple'+(active.length>1?'s':'');
    if(active.length===0){const empty=document.createElement('div');empty.className='no-events';empty.textContent='Aucun événement dans cette sélection. Les dates officielles seront ajoutées par le comité.';list.append(empty);return;}
    active.sort((a,b)=>a.day-b.day).forEach(e=>{
      const row=document.createElement('div');row.className='event-list-row';
      const date=document.createElement('div');date.className='event-date';date.textContent=String(e.day.getDate());const mm=document.createElement('small');mm.textContent=shortMonth(e.day);date.append(mm);
      const content=document.createElement('div');const title=document.createElement('strong');title.textContent=e.title;const meta=document.createElement('span');meta.textContent=categoryLabel[e.category]+' · '+e.time;content.append(title,meta);
      const badge=document.createElement('span');badge.className='event-pill';badge.textContent='FICTIF';row.append(date,content,badge);list.append(row);
    });
  }
  $('calendar-prev').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1,12);render();});
  $('calendar-next').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1,12);render();});
  $('calendar-today').addEventListener('click',()=>{month=new Date(today.getFullYear(),today.getMonth(),1,12);render();});
  $('show-demo-calendar').addEventListener('change',render);
  document.querySelectorAll('[data-calendar-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.calendarFilter;document.querySelectorAll('[data-calendar-filter]').forEach(el=>el.classList.toggle('active',el===button));render();}));
  render();
})();
