import {describe,it,expect} from 'vitest';
import {BattlefieldSimulation} from './BattlefieldSimulation';
import {createBattlefield} from './createBattlefield';
import {distance,distanceToSegment,polylineLength} from '../core/types';
import {atDistance} from '../core/Polyline';
import {SaveSystem} from '../persistence/SaveSystem';

function engineersOnly():BattlefieldSimulation {
  const state=createBattlefield();state.squads=state.squads.filter(s=>s.kind==='engineer');
  state.soldiers=state.soldiers.filter(s=>state.squads.some(q=>q.id===s.squadId));state.trenches=[];state.craters=[];state.simSpeed=5;
  return new BattlefieldSimulation(state);
}
describe('complex works and drawn orders',()=>{
  it('finishes a complex long route and its queued continuation after a mid-build save/load',()=>{
    const sim=engineersOnly(),engineer=sim.state.squads[0];
    const path=Array.from({length:64},(_,i)=>({x:-1510-i*4,z:-1280+Math.sin(i*.4)*45-i*6}));
    const first=sim.createTrench(path,engineer.id)!;
    const last=path.at(-1)!;
    const second=sim.createTrench([last,{x:last.x-100,z:last.z+80},{x:last.x-130,z:last.z-40},{x:last.x-240,z:last.z}],engineer.id)!;
    expect(first).toBeDefined();expect(second).toBeDefined();expect(engineer.order.trenchId).toBe(first);expect(engineer.constructionQueue).toEqual([second]);
    for(let i=0;i<600;i++)sim.step(.05);
    expect(sim.state.trenches[0].progress).toBeGreaterThan(.05);
    const restored=new SaveSystem().parse(JSON.stringify(sim.state));sim.replaceState(restored);
    for(let i=0;i<6500&&sim.state.trenches.some(t=>t.status!=='complete');i++)sim.step(.05);
    expect(sim.state.trenches.map(t=>t.progress)).toEqual([1,1]);
    expect(sim.state.trenches.map(t=>t.status)).toEqual(['complete','complete']);
    expect(sim.state.squads[0].constructionQueue).toHaveLength(0);
    expect(distance(sim.state.squads[0],sim.state.trenches[1].points.at(-1)!)).toBeLessThan(12);
  },15000);

  it('pauses and resumes excavation at the working face rather than restarting',()=>{
    const sim=engineersOnly(),squad=sim.state.squads[0];
    const id=sim.createTrench([{x:-1435,z:-1280},{x:-1535,z:-1220},{x:-1650,z:-1370}],squad.id)!;
    for(let i=0;i<250;i++)sim.step(.05);
    const trench=sim.state.trenches.find(t=>t.id===id)!,before=trench.progress;
    sim.issueHold([squad.id]);for(let i=0;i<100;i++)sim.step(.05);
    expect(trench.progress).toBe(before);expect(trench.status).toBe('planned');
    expect(sim.resumeConstruction([squad.id])).toBe(1);
    expect(distance(squad.route.at(-1)!,sim.trenches.constructionHead(trench))).toBeLessThan(1);
    for(let i=0;i<1400;i++)sim.step(.05);
    expect(trench.progress).toBe(1);
  });

  it('rejects a trench segment crossing a building even when both control points are clear',()=>{
    const sim=engineersOnly(),building=sim.terrain.buildings[0];
    const count=sim.state.trenches.length;
    expect(sim.createTrench([{x:building.x-40,z:building.z},{x:building.x+40,z:building.z}],sim.state.squads[0].id)).toBeUndefined();
    expect(sim.state.trenches).toHaveLength(count);
    expect(sim.createTrench([{x:NaN,z:0},{x:40,z:0}])).toBeUndefined();
  });

  it('uses built linear capacity, releases it on hold, and never grants cover on an unbuilt plan',()=>{
    const sim=new BattlefieldSimulation(createBattlefield()),trench=sim.state.trenches[0];
    expect(sim.trenches.capacity(trench)).toBe(Math.floor((polylineLength(trench.points)-6)/2.5));
    const ids=sim.state.squads.slice(0,5).map(s=>s.id);expect(sim.issueOccupyNearest(ids,trench.id)).toBe(trench.id);
    expect(sim.trenches.used(trench)).toBe(50);
    expect(sim.issueOccupyNearest([sim.state.squads[5].id],trench.id)).toBeUndefined();
    sim.issueHold([ids[0]]);expect(sim.trenches.used(trench)).toBe(40);
    expect(sim.issueOccupyNearest([sim.state.squads[5].id],trench.id)).toBe(trench.id);
    const plan=sim.createTrench([{x:-1700,z:-1600},{x:-1750,z:-1640}])!,t=sim.state.trenches.find(t=>t.id===plan)!;
    const p=atDistance(t.points,20);expect(sim.trenches.capacity(t)).toBe(0);expect(sim.terrain.coverAt(p.x,p.z)).not.toBe('trench');
  });

  it('follows every bend of a drawn corridor and ends in a spaced column',()=>{
    const state=createBattlefield(),squad=state.squads[0];state.squads=[squad];state.soldiers=state.soldiers.filter(s=>s.squadId===squad.id);state.simSpeed=5;
    const sim=new BattlefieldSimulation(state);
    const bends=[{x:-1400,z:-1510},{x:-1500,z:-1510},{x:-1500,z:-1600},{x:-1430,z:-1600}];
    expect(sim.issueDrawnPath([squad.id],bends)).toBe(true);
    const path=squad.order.drawnPath!.map(p=>({...p})),visited=new Set<number>();
    for(let i=0;i<1700&&squad.order.type==='move';i++){
      sim.step(.05);const lead=state.soldiers[0];
      bends.forEach((p,j)=>{if(distance(lead,p)<3)visited.add(j);});
      if((lead.pathTravel??0)>15)expect(Math.min(...path.slice(1).map((p,j)=>distanceToSegment(lead,path[j],p).distance))).toBeLessThan(2.5);
    }
    expect([...visited].sort()).toEqual([0,1,2,3]);expect(squad.order.type).toBe('hold');
    for(let i=0;i<state.soldiers.length;i++)for(let j=i+1;j<state.soldiers.length;j++)expect(distance(state.soldiers[i],state.soldiers[j])).toBeGreaterThan(1);
  });
  it('keeps multi-squad destinations separate, appends routes, and validates saved orders',()=>{
    const state=createBattlefield();state.squads=state.squads.slice(0,2);state.soldiers=state.soldiers.filter(s=>state.squads.some(q=>q.id===s.squadId));state.simSpeed=5;
    const sim=new BattlefieldSimulation(state),ids=state.squads.map(s=>s.id);
    const path=[{x:-1420,z:-1510},{x:-1500,z:-1510},{x:-1500,z:-1590}];
    expect(sim.issueDrawnPath(ids,path)).toBe(true);
    for(let i=0;i<100;i++)sim.step(.05);
    expect(sim.issueDrawnPath(ids,[path.at(-1)!,{x:-1580,z:-1590}],true)).toBe(true);
    const restored=new SaveSystem().parse(JSON.stringify(state));sim.replaceState(restored);
    expect(restored.squads[1].order.pathEndOffset).toBeGreaterThan(10);
    for(let i=0;i<1800&&restored.squads.some(s=>s.order.type==='move');i++)sim.step(.05);
    expect(restored.squads.every(s=>s.order.type==='hold')).toBe(true);
    expect(distance(restored.squads[0],restored.squads[1])).toBeGreaterThan(12);
    const corrupt=structuredClone(restored);corrupt.squads[0].order={type:'move',drawnPath:[{x:1,z:2},{x:Infinity,z:2}],issuedAt:0};
    expect(()=>new SaveSystem().parse(JSON.stringify(corrupt))).toThrow();
  });
  it('does not apply a cancelled asynchronous drawn approach or stale destination response',()=>{
    const sim=new BattlefieldSimulation(createBattlefield()),squad=sim.state.squads[0],callbacks:((r:{x:number;z:number}[])=>void)[]=[];
    sim.scheduleNavigation=(_a,_b,done)=>callbacks.push(done);
    sim.issueMove([squad.id],{x:-1480,z:-1550});
    sim.issueDrawnPath([squad.id],[{x:-1420,z:-1510},{x:-1500,z:-1510}]);
    callbacks[0]([{x:-1480,z:-1550}]);expect(squad.movementState).toBe('planning');
    sim.issueHold([squad.id]);callbacks[1]([{x:-1420,z:-1510}]);
    expect(squad.order.type).toBe('hold');expect(squad.route).toHaveLength(0);
  });
});
