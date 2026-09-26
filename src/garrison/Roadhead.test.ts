import {describe,it,expect} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {pointOnRoad,ROADS} from '../terrain/WorldLayout';
import {balance,total,transfer} from './Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';

function cutRoad(){
  const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];
  w.rear=pointOnRoad(ROADS[1],520);g.entrance={x:700,z:1015};g.forward=pointOnRoad(ROADS[1],700);
  s.trenches.push({id:s.nextEntityId++,points:[{x:700,z:990},{x:700,z:1040}],width:4.2,depth:1.75,progress:1,status:'complete',excavation:{origin:25,start:0,end:50}});
  sim.terrain.syncModifications();
  const t=w.trucks.find(t=>t.role==='shuttle')!;Object.assign(t,pointOnRoad(ROADS[1],680));
  t.garrisonId=g.id;t.state='blocked';t.resume='outbound';t.route=[{...g.forward}];t.routeIndex=0;transfer(w.rearStock,t.cargo,'materials',32);
  return {sim,s,w,g,t};
}
describe('physical roadhead clearance',()=>{
  it('places a new unloading apron beside a road-cutting trench, on the accessible side',()=>{
    const {sim,g}=cutRoad(),p=sim.garrisons.logistics.forwardPoint(g.entrance);
    expect(p.x).toBeLessThan(700);expect(sim.terrain.deformationAt(p.x,p.z)).toBeGreaterThan(-.35);
  });
  it('reroutes an undelivered truck to an empty valid apron without moving people, cargo or stocks',()=>{
    const {sim,s,g,t}=cutRoad(),position={x:t.x,z:t.z},before=total(t.cargo);
    sim.garrisons.logistics.step(.05);
    expect(Math.hypot(t.x-position.x,t.z-position.z)).toBeLessThanOrEqual(.600001);expect(total(t.cargo)).toBe(before);expect(total(g.forwardStock)).toBe(0);
    expect(t.route.at(-1)).toEqual(g.forward);expect(g.forward.x).toBeLessThan(700);
    const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));
    for(let i=0;i<220;i++){s.elapsed+=.05;copy.state.elapsed+=.05;sim.garrisons.logistics.step(.05);copy.garrisons.logistics.step(.05);}
    expect(copy.state).toEqual(s);expect(g.forwardStock.materials).toBe(32);
    for(const n of Object.values(balance(s)))expect(Math.abs(n)).toBeLessThan(1e-7);
  });
  it('never relocates existing stock or an active foot pickup',()=>{
    const {sim,g,w,s}=cutRoad(),point={...g.forward};transfer(w.rearStock,g.forwardStock,'materials',1);
    sim.garrisons.logistics.step(.05);expect(g.forward).toEqual(point);expect(g.forwardStock.materials).toBe(1);
    transfer(g.forwardStock,w.rearStock,'materials',1);
    s.soldiers[0].duty={kind:'haul',stage:'pickup',destination:point,route:[point],routeIndex:0,since:0,until:100,reason:'Collect physical forward shipment',blockedFor:0};
    sim.garrisons.logistics.step(.05);expect(g.forward).toEqual(point);
  });
});
