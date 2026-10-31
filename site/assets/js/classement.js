(() => {
  // Données fictives du prototype d'origine. Ne pas présenter comme des cotes officielles.
  const players = [
    { name: 'Alice', elo: 1520 },
    { name: 'Bob', elo: 1480 },
    { name: 'Charlie', elo: 1410 }
  ];
  const tbody = document.querySelector('#ranking-table');
  const search = document.querySelector('#ranking-search');
  const sort = document.querySelector('#ranking-sort');
  const empty = document.querySelector('#ranking-empty');
  const count = document.querySelector('#ranking-count');
  const best = document.querySelector('#ranking-best');
  if (!tbody || !search || !sort || !empty) return;
  const label = document.createElement('span');
  label.className='status-demo'; label.textContent = 'DÉMO';
  const render = () => {
    const query = search.value.trim().toLocaleLowerCase('fr');
    const filtered = players.filter(p => p.name.toLocaleLowerCase('fr').includes(query));
    const mode = sort.value;
    if (mode === 'elo-asc') filtered.sort((a,b) => a.elo - b.elo);
    else if (mode === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name,'fr'));
    else filtered.sort((a,b) => b.elo - a.elo);
    tbody.replaceChildren();
    filtered.forEach((player, index) => {
      const tr = document.createElement('tr');
      const rank = document.createElement('td');
      rank.className='rank-no';rank.textContent=String(index+1).padStart(2,'0');
      const name = document.createElement('td');
      const wrap=document.createElement('div'); wrap.className='player-cell';
      const avatar=document.createElement('span'); avatar.className='player-avatar'; avatar.textContent=player.name.slice(0,1);
      const text=document.createElement('span');text.textContent=player.name;wrap.append(avatar,text);name.append(wrap);
      const elo=document.createElement('td'); elo.className='player-rating';elo.textContent=player.elo.toLocaleString('fr-CA');
      const status=document.createElement('td');status.append(label.cloneNode(true));
      tr.append(rank,name,elo,status);tbody.append(tr);
    });
    empty.hidden=filtered.length!==0;
    if(count)count.textContent=String(players.length);
    if(best)best.textContent=String(Math.max(...players.map(p=>p.elo)));
  };
  search.addEventListener('input',render);
  sort.addEventListener('change',render);
  render();
})();
