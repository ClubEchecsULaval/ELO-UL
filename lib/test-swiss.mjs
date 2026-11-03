import test from 'node:test';import assert from 'node:assert/strict';
import {pairSwiss,standings} from './swiss.mjs';
const players=(n)=>Array.from({length:n},(_,i)=>({id:i+1,name:'Joueur '+(i+1),seedRating:1800-100*i}));
test('round 1 gives one unique seat to each of six players and valid tables',()=>{
 const ps=players(6),pairs=pairSwiss(ps,[],1);assert.equal(pairs.length,3);assert.deepEqual(pairs.map(p=>p.board),[1,2,3]);
 const ids=pairs.flatMap(p=>[p.whitePlayerId,p.blackPlayerId]);assert.equal(new Set(ids).size,6);
});
test('odd player counts award exactly one bye with one point',()=>{
 const ps=players(5),round1=pairSwiss(ps,[],1);
 assert.equal(round1.filter(p=>p.result==='BYE').length,1);
 const score=standings(ps,round1);assert.equal(score.reduce((a,p)=>a+p.points,0),1);
 const completed=round1.map(p=>({...p,result:p.result||'1-0'}));
 const round2=pairSwiss(ps,completed,2);
 assert.notEqual(round1.find(p=>p.result==='BYE').whitePlayerId,round2.find(p=>p.result==='BYE').whitePlayerId);
});
test('avoid repeat pairings when an alternate exists',()=>{
 const ps=players(4),r1=pairSwiss(ps,[],1).map(p=>({...p,result:'1-0'}));const r2=pairSwiss(ps,r1,2);
 const key=p=>[p.whitePlayerId,p.blackPlayerId].sort((a,b)=>a-b).join('-');
 assert.equal(r2.some(p=>r1.some(old=>key(old)===key(p))),false);
});
test('reject incomplete previous results and too few players',()=>{
 assert.throws(()=>pairSwiss(players(2),[{id:1,whitePlayerId:1,blackPlayerId:2,result:null}],2));
 assert.throws(()=>pairSwiss(players(1),[],1));
});
