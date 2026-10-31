/** Tableau des rondes : signes +/-/= et rang ACTUEL de l'adversaire.
 *  Le même modèle sert aux tournois en cours et terminés.
 *  Pour un joueur ajouté ou retiré, le dénominateur correspond aux rondes où il
 *  figure réellement dans les appariements, Bye inclus.
 */
export function roundRankingModel(details) {
  const players = details.players ?? [];
  const standings = details.standings ?? [];
  const rounds = details.rounds ?? [];
  const planned = Math.max(0, Math.min(15, Number(details.tournament?.roundsPlanned) || 0));
  const rankById = new Map(standings.map((p, i) => [Number(p.id), i + 1]));
  const nameById = new Map(players.map(p => [Number(p.id), p.name]));
  const roundsByNumber = new Map(rounds.map(r => [Number(r.number), r]));
  const columns = Array.from({length:planned},(_,i)=>i+1);
  const rows = standings.map((p,i) => {
    let participated=0;
    const cells=columns.map(number => {
      const match=(roundsByNumber.get(number)?.pairings??[])
        .find(g => Number(g.whitePlayerId)===Number(p.id) || (g.blackPlayerId!=null && Number(g.blackPlayerId)===Number(p.id)));
      if(!match) return {text:'—',kind:'absent',title:'Aucun appariement'};
      participated++;
      if(match.blackPlayerId==null && match.result==='BYE')
        return {text:'Bye',kind:'bye',title:'Bye automatique : 0,5 point'};
      if(!match.result) return {text:'…',kind:'pending',title:'Partie à jouer / résultat non saisi'};
      const isWhite=Number(match.whitePlayerId)===Number(p.id);
      const opponentId=Number(isWhite?match.blackPlayerId:match.whitePlayerId);
      const opponentRank=rankById.get(opponentId);
      const opponentName=nameById.get(opponentId)??'Adversaire';
      const score=match.result==='1/2-1/2'?'draw':
        ((match.result==='1-0'&&isWhite)||(match.result==='0-1'&&!isWhite))?'win':'loss';
      const sign=score==='win'?'+':score==='loss'?'-':'=';
      const label=score==='win'?'Victoire':score==='loss'?'Défaite':'Nulle';
      return {text:`${sign}${opponentRank??'?'}`,kind:score,title:`${label} contre ${opponentName} (rang actuel ${opponentRank??'inconnu'})`};
    });
    return {id:p.id,rank:i+1,name:p.name,active:p.active!==false,cells,points:p.points,
      participated,total:`${Number(p.points??0)}/${participated}`};
  });
  return {columns,rows};
}
