import {describe,it,expect} from 'vitest';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {createBattlefield,addSquad} from '../simulation/createBattlefield';
import {distance} from '../core/types';
import {SaveSystem} from '../persistence/SaveSystem';
import {preparedStatus} from './PreparedOrders';
import {raidSearchComplete} from './TrenchRaid';

function fixture(){
  const state=createBattlefield();state.soldiers=[];state.squads=[];state.trenches=[];state.craters=[];
  for(let i=0;i<3;i++)addSquad(state,'rifle',8,-1760+i*36,-1710,`Assault ${i}`);
  const enemy=addSquad(state,'rifle',4,-1580,-1500,'Defenders');enemy.faction='enemy';
  const id=state.nextEntityId++,branch=state.nextEntityId++;
  state.trenches.push({id,points:[{x:-1800,z:-1610},{x:-1640,z:-1610}],width:4.2,depth:1.75,status:'complete',progress:1,engineerSquadId:enemy.id},
    {id:branch,points:[{x:-1720,z:-1610},{x:-1720,z:-1570}],width:4.2,depth:1.75,status:'complete',progress:1,engineerSquadId:enemy.id});
  const sim=new BattlefieldSimulation(state);
  for(const s of state.soldiers){s.carried!.ammo=60;state.living!.ledger.initial.ammo+=60;s.ammunition=60;}
  state.terrainKnowledge={nextReview:1,sections:[]};
  for(const t of state.trenches){const [a,b]=t.points,length=distance(a,b);for(let n=0;n<length/4;n++)state.terrainKnowledge.sections.push({id:state.nextEntityId++,sourceId:t.id,cell:n,points:[{x:a.x+(b.x-a.x)*n*4/length,z:a.z+(b.z-a.z)*n*4/length},{x:a.x+(b.x-a.x)*(n+1)*4/length,z:a.z+(b.z-a.z)*(n+1)*4/length}],width:t.width,at:0,side:'player'});}
  const ids=state.squads.slice(0,3).map(q=>q.id);sim.prepareOrder(ids,'assault',{x:-1720,z:-1610},id);
  return {state,sim,ids,id};
}
describe('persistent physical trench raid',()=>{
  it('keeps existing lanes stable when assault squads are prepared one at a time',()=>{
    const {state,sim,ids,id}=fixture();sim.cancelPrepared();
    for(const squad of ids)sim.prepareOrder([squad],'assault',{x:-1720,z:-1610},id);
    const entries=state.preparedOrders!.map(o=>o.raid!.entry);
    for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)expect(distance(entries[i],entries[j])).toBeGreaterThanOrEqual(12);
    const first=structuredClone(state.preparedOrders![0]);sim.prepareOrder([ids[2]],'assault',{x:-1720,z:-1610},id);
    expect(state.preparedOrders![0]).toEqual(first);
  });
  it('allocates distinct known entries; WAIT saves and GO releases on one tick without hidden geometry',()=>{
    const {state,sim}=fixture();expect(new Set(state.preparedOrders!.map(o=>JSON.stringify(o.raid!.entry))).size).toBe(3);
    const before=state.soldiers.map(s=>({x:s.x,z:s.z}));for(let i=0;i<20;i++)sim.step(.05);
    expect(state.soldiers.map(s=>({x:s.x,z:s.z}))).toEqual(before);
    const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));expect(copy.state).toEqual(state);
    sim.signalPrepared();copy.signalPrepared();sim.step(.05);copy.step(.05);expect(copy.state).toEqual(state);
    expect(new Set(state.preparedOrders!.map(o=>o.releasedAt)).size).toBe(1);
    expect(state.preparedOrders!.every(o=>o.raid!.phase==='approach')).toBe(true);
  });
  it('walks from open ground through separate entries and clears branches before physical capture',()=>{
    const {state,sim,ids,id}=fixture();sim.signalPrepared();let entered=false,partial=false;
    for(let i=0;i<11000&&!state.preparedOrders!.every(o=>o.raid!.phase==='secured');i++){
      sim.step(.05);
      if(state.preparedOrders!.some(o=>o.raid!.members.some(m=>m.entered)))entered=true;
      if(state.preparedOrders!.some(o=>o.raid!.cleared.length>0)&&!state.living!.garrisons.some(g=>g.faction!=='enemy'&&g.trenchId===id))partial=true;
      if(i===1600){const saved=new SaveSystem().parse(JSON.stringify(state));expect(saved).toEqual(state);}
    }
    expect({entered,orders:state.preparedOrders!.map(o=>({phase:o.raid!.phase,reason:o.raid!.reason,entry:o.raid!.entry,members:o.raid!.members})),squads:state.squads.slice(0,3).map(q=>({x:q.x,z:q.z,order:q.order,route:q.route}))}).toMatchObject({entered:true});expect(partial).toBe(true);
    expect(state.preparedOrders!.map(o=>({phase:o.raid!.phase,reason:o.raid!.reason,cleared:o.raid!.cleared.length,members:o.raid!.members}))).toEqual(expect.arrayContaining([expect.objectContaining({phase:'secured'})]));
    expect(state.squads.filter(q=>ids.includes(q.id)).every(q=>q.order.type==='occupy-trench')).toBe(true);
    expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
  },20000);
  it('retains failed assault identity, regroups physically and accepts a new preparation',()=>{
    const {state,sim,ids,id}=fixture();sim.signalPrepared();sim.step(.05);
    const people=state.soldiers.filter(s=>s.squadId===ids[0]);for(const s of people.slice(0,6)){s.health=0;s.needs!.life='dead';}
    for(let i=0;i<400;i++)sim.step(.05);
    const o=state.preparedOrders!.find(o=>o.squadId===ids[0])!;
    expect(['regrouping','failed']).toContain(o.raid!.phase);expect(preparedStatus(state,o)).toContain('ASSAULT FAILED');
    expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
    expect(sim.prepareOrder([ids[0]],'assault',o.target,id)).toBe(1);expect(state.preparedOrders!.find(o=>o.squadId===ids[0])!.raid!.phase).toBe('wait');
  });
  it('cannot bypass progressive search by securing another branch of the same network',()=>{
    const {state,sim,ids,id}=fixture(),branch=state.trenches[1].id;
    const people=state.soldiers.filter(s=>s.squadId===ids[0]);
    people.forEach((s,i)=>{s.x=-1720;s.z=-1608+i*2;});
    expect(sim.assignGarrison(ids,branch)).toBe(false);
    expect(sim.garrisons.lastAssignment.reason).toContain('not searched');
    // The ownership gate does not disclose an unobserved extension as a goal.
    state.terrainKnowledge!.sections=state.terrainKnowledge!.sections.filter(s=>s.sourceId===id);
    state.preparedOrders![0].raid!.cleared=state.terrainKnowledge!.sections.map(s=>s.id);
    expect(raidSearchComplete(state,sim.garrisons.network,id)).toBe(false);
    expect(state.preparedOrders![0].raid!.members).toEqual([]);
  });
  it('rejects malformed personal raid paths and cannot prepare an unavailable formation',()=>{
    const {state,sim,ids}=fixture();
    state.preparedOrders![0].raid!.members=[{id:state.squads[1].soldierIds[0],entry:{x:0,z:0},entered:false,route:[],index:0,retryAt:0}];
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow();
    for(const s of state.soldiers.filter(s=>s.squadId===ids[0])){s.health=0;s.needs!.life='dead';}
    expect(sim.prepareOrder([ids[0]],'assault',{x:0,z:0})).toBe(0);
  });
});
