(() => {
  const get = id => document.getElementById(id);
  const ids = ['elo-self','elo-opponent','elo-result','elo-k'];
  if (!ids.every(id => get(id))) return;
  function update() {
    const myRating = Number(get('elo-self').value);
    const opponentRating = Number(get('elo-opponent').value);
    const result = Number(get('elo-result').value);
    const k = Number(get('elo-k').value);
    if (![myRating,opponentRating,result,k].every(Number.isFinite)||myRating<100||opponentRating<100||myRating>3500||opponentRating>3500) {
      get('elo-new-rating').textContent = '—';
      get('elo-delta').textContent = 'Veuillez saisir des cotes entre 100 et 3 500.';
      get('elo-expected').textContent='';return;
    }
    const expected = 1/(1+10**((opponentRating-myRating)/400));
    const next = Math.max(100,myRating+Math.round(k*(result-expected)));
    const diff = next - myRating;
    get('elo-new-rating').textContent=next.toLocaleString('fr-CA');
    get('elo-delta').textContent=(diff>0?'+':'')+diff+' points';
    get('elo-delta').classList.toggle('negative',diff<0);
    get('elo-expected').textContent='Score attendu : '+(expected*100).toLocaleString('fr-CA',{maximumFractionDigits:1})+' %';
  }
  ids.forEach(id=> {get(id).addEventListener('input',update);get(id).addEventListener('change',update);});
  update();
})();
