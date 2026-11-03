/** Swiss-inspired pairings for informal club tournaments; NOT FIDE certified. */
export function standings(players, previousPairs) {
  const stats = new Map(players.map(p => [p.id, { id:p.id, name:p.name, seedRating:p.seedRating ?? 1200, active:p.active !== false, points:0, played:0, wins:0, draws:0, losses:0, byeCount:0, whites:0, blacks:0, lastColor:null, opponents:new Set() }]));
  for (const g of previousPairs) {
    const w = stats.get(g.whitePlayerId); const b = stats.get(g.blackPlayerId);
    if (!w) continue;
    if (!b) { if (g.result === 'BYE') { w.points += 0.5; w.byeCount++; } continue; }
    w.opponents.add(b.id); b.opponents.add(w.id);
    w.whites++; w.lastColor='W'; b.blacks++; b.lastColor='B';
    if (g.result === '1-0') { w.points++;w.wins++;b.losses++;w.played++;b.played++; }
    else if (g.result === '0-1') { b.points++;b.wins++;w.losses++;w.played++;b.played++; }
    else if (g.result === '1/2-1/2') { w.points+=0.5;b.points+=0.5;w.draws++;b.draws++;w.played++;b.played++; }
  }
  return [...stats.values()].sort((a,b)=>b.points-a.points || b.seedRating-a.seedRating || a.name.localeCompare(b.name,'fr'));
}
function colorPenalty(a,b,whiteA) {
  const aw = a.whites+(whiteA?1:0), ab=a.blacks+(whiteA?0:1);
  const bw = b.whites+(whiteA?0:1), bb=b.blacks+(whiteA?1:0);
  return Math.abs(aw-ab)*5 + Math.abs(bw-bb)*5 + (a.lastColor===(whiteA?'W':'B')?3:0) + (b.lastColor===(whiteA?'B':'W')?3:0);
}
function orient(a,b) {
  const aWhite = colorPenalty(a,b,true), bWhite=colorPenalty(a,b,false);
  return aWhite <= bWhite ? {whitePlayerId:a.id,blackPlayerId:b.id} : {whitePlayerId:b.id,blackPlayerId:a.id};
}
function pairCost(a,b) {
  return (a.opponents.has(b.id)?100000:0) + Math.abs(a.points-b.points)*400 + Math.abs(a.seedRating-b.seedRating)/80 + Math.min(colorPenalty(a,b,true),colorPenalty(a,b,false));
}
/** Immutable input; output pairs include BYE with a null opponent. */
export function pairSwiss(players, completedPairs=[], roundNumber=1) {
  if (players.filter(p => p.active !== false).length < 2 || players.length > 128) throw new Error('Un tournoi doit compter de 2 à 128 participants actifs.');
  if (!Number.isInteger(roundNumber) || roundNumber < 1) throw new Error('Numéro de ronde invalide.');
  if (completedPairs.some(p=>!p.result)) throw new Error('Tous les résultats précédents doivent être enregistrés.');
  // Conserver l'historique des joueurs retirés, mais ne plus les apparier.
  const activeIds = new Set(players.filter(p => p.active !== false).map(p => p.id));
  const ranked = standings(players,completedPairs).filter(p => activeIds.has(p.id));
  let bye = null;
  if (ranked.length%2) {
    bye = [...ranked].reverse().find(p=>p.byeCount===0) ?? ranked.at(-1);
  }
  const remain=ranked.filter(p=>p.id!==bye?.id);
  let pairs=[];
  if (roundNumber===1) {
    // Seed-based first round (top half against bottom half).
    const half=remain.length/2;
    for(let i=0;i<half;i++) pairs.push([remain[i],remain[i+half]]);
  } else {
    // Search for repeat-free pairings while keeping score groups together.
    // Bounded backtracking prevents unbounded computation in large events.
    let best=null, bestCost=Infinity, visited=0;
    const maxNodes=22000;
    const go=(left,chosen,cost)=>{
      if(++visited>maxNodes || cost>=bestCost) return;
      if(left.length===0){best=chosen.map(p=>[p[0],p[1]]);bestCost=cost;return;}
      const first=left[0];
      const candidates=left.slice(1).map((p,i)=>({p,i:i+1,c:pairCost(first,p)})).sort((a,b)=>a.c-b.c).slice(0,Math.min(7,left.length-1));
      for(const {p,i,c} of candidates){
        go(left.filter((_,idx)=>idx!==0 && idx!==i),[...chosen,[first,p]],cost+c);
      }
    };
    go(remain,[],0);
    if(!best){
      const left=[...remain];best=[];
      while(left.length){ const a=left.shift();let bestI=0;for(let i=1;i<left.length;i++)if(pairCost(a,left[i])<pairCost(a,left[bestI]))bestI=i;best.push([a,left.splice(bestI,1)[0]]); }
    }
    pairs=best;
  }
  const result = pairs.map(([a,b],i)=>({board:i+1,...orient(a,b),result:null}));
  if(bye) result.push({board:null,whitePlayerId:bye.id,blackPlayerId:null,result:'BYE'});
  return result;
}
