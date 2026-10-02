import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {transfer,balance} from '../garrison/Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {constructionDemand,claimed} from '../garrison/SupplyDemand';
import type {SoldierState,Vec2} from '../core/types';
import {workReadout} from '../ui/PositionReadout';

function twoGuns(){
  const sim=createStudyScenario(1944,0,32),state=sim.state,g=state.living!.garrisons[0],t=state.trenches[0];g.nextSupport=1e9;
  transfer(state.living!.rearStock,g.cache,'materials',100);
  for(const [i,p] of state.soldiers.entries()){p.equipment!.tools=i<4;p.x=t.points[0].x+30+(i%8)*2;p.z=t.points[0].z;delete p.duty;}
  const sites=[30,85].map(along=>{const origin={x:t.points[0].x+along,z:t.points[0].z};const id=sim.requestConstruction({kind:'facility',facilityKind:'mortar',garrisonId:g.id,origin,position:{x:origin.x,z:origin.z-8},facing:0});expect(id).toBeDefined();return state.living!.facilities.find(f=>f.id===id)!;});
  return {sim,state,g,sites};
}
describe('persistent construction staffing after startup',()=>{
  it('does not let ordinary idle friendlies permanently reserve both starting work faces',()=>{
    const {sim,state,sites}=twoGuns(),f=sites[0],t=state.trenches.find(t=>t.id===f.connectorId)!;
    const tool=state.soldiers.find(p=>p.id===f.workOrder!.workerIds[0])!,idle=state.soldiers.filter(p=>!sites.some(f=>f.workOrder!.workerIds.includes(p.id))).slice(0,2);
    for(const p of state.soldiers){p.x=t.points[0].x+50;p.z=t.points[0].z;delete p.duty;}
    for(const [i,p]of idle.entries()){p.x=t.points[0].x+(i?1.2:-1.2);p.z=t.points[0].z;p.action='holding';}
    const internal=sim.garrisons as unknown as {workPoint:(a:Vec2,b:Vec2,p:number,s:SoldierState)=>Vec2|undefined};
    const before=idle.map(p=>({x:p.x,z:p.z}));
    expect(internal.workPoint(t.points[0],f,0,tool)).toBeDefined();
    expect(idle.map(p=>({x:p.x,z:p.z}))).toEqual(before);
    // Actual work reservations remain exclusive, even when a worker is still
    // approaching. Friendly passing does not create extra cutting faces.
    for(const p of idle)p.duty={kind:'construct',facilityId:f.id,destination:{x:p.x,z:p.z},route:[],routeIndex:0,since:0,until:100,blockedFor:0,reason:'Reserved work face'};
    expect(internal.workPoint(t.points[0],f,0,tool)).toBeUndefined();
    for(const p of idle){p.duty!.kind='rest';p.duty!.playerOrdered=true;}
    expect(internal.workPoint(t.points[0],f,0,tool)).toBeUndefined();
    for(const p of idle){delete p.duty!.playerOrdered;p.duty!.kind='sleep';}
    expect(internal.workPoint(t.points[0],f,0,tool)).toBeUndefined();
  });
  it('persists a current blocked work-face explanation instead of claiming idle workers are approaching',()=>{
    const {state,sites}=twoGuns(),f=sites[0];f.paid=true;
    f.workOrder!.accessIssue={at:state.elapsed,reason:'WORK FACE OCCUPIED'};
    expect(workReadout(state,f).status).toBe('WORK FACE OCCUPIED');
    const copy=new SaveSystem().parse(JSON.stringify(state));
    expect(copy.living!.facilities.find(o=>o.id===f.id)!.workOrder!.accessIssue).toEqual(f.workOrder!.accessIssue);
    state.elapsed+=11;expect(workReadout(state,f).status).not.toBe('WORK FACE OCCUPIED');
  });
  it('defaults both explicitly ordered field guns to persistent automatic workers',()=>{
    const {sites}=twoGuns();expect(sites.every(f=>f.workOrder?.autoWorkers)).toBe(true);
    expect(sites.every(f=>f.workOrder!.workerIds.length>=2)).toBe(true);
  });
  it('replaces an exhausted reserved tool carrier instead of counting them as useful labor forever',()=>{
    const {sim,state,sites}=twoGuns(),f=sites[0];
    const previous=f.workOrder!.workerIds.find(id=>state.soldiers.find(p=>p.id===id)!.equipment!.tools)!;
    const tired=state.soldiers.find(p=>p.id===previous)!;tired.needs!.energy=20;
    const spare=state.soldiers.find(p=>p.equipment!.tools&&!sites.some(f=>f.workOrder!.workerIds.includes(p.id)))!;
    const stock=structuredClone(tired.carried),position={x:tired.x,z:tired.z};
    sim.garrisons.autoWorkers(f.id);
    expect(f.workOrder!.workerIds).toContain(spare.id);
    expect(f.workOrder!.workerIds).not.toContain(previous);
    expect(tired.carried).toEqual(stock);expect({x:tired.x,z:tired.z}).toEqual(position);
  });
  it('replaces a pinned automatic worker without overwriting the reaction or commandeering another gun crew',()=>{
    const {sim,state,sites}=twoGuns(),f=sites[0],p=state.soldiers.find(p=>p.id===f.workOrder!.workerIds[0])!,other=sites[1];
    const protectedIds=[...other.workOrder!.workerIds];other.weaponCrewIds=protectedIds;
    p.suppression=90;p.combat={shotSequence:0,owner:'reaction',reaction:'pinned'};
    sim.garrisons.autoWorkers(f.id);
    expect(f.workOrder!.autoWorkers).toBe(true);expect(f.workOrder!.workerIds).not.toContain(p.id);expect(p.combat.reaction).toBe('pinned');
    expect(f.workOrder!.workerIds.some(id=>protectedIds.includes(id))).toBe(false);
  });
  it('gives a critical site scarce uncommitted material and an idle tool carrier, without creating stock',()=>{
    const {sim,state,g,sites}=twoGuns(),[low,urgent]=sites,p=state.soldiers.find(p=>p.id===low.workOrder!.workerIds[0])!;
    for(const person of state.soldiers)person.equipment!.tools=person===p;
    urgent.workOrder!.workerIds=[];low.workOrder!.workerIds=[p.id];p.duty={kind:'rest',destination:{x:p.x,z:p.z},route:[],routeIndex:0,arrivedAt:0,since:0,until:100,reason:'Waiting for materials',blockedFor:0};
    transfer(g.cache,state.living!.rearStock,'materials',g.cache.materials-10);const before=balance(state);
    expect(sim.garrisons.setWorkPriority(low.id,'low')).toBe(true);expect(sim.garrisons.setWorkPriority(urgent.id,'critical')).toBe(true);
    expect(claimed(constructionDemand(state,urgent.id)!)).toBe(10);expect(claimed(constructionDemand(state,low.id)!)).toBe(0);
    sim.garrisons.autoWorkers(urgent.id);expect(urgent.workOrder!.workerIds).toContain(p.id);expect(low.workOrder!.workerIds).not.toContain(p.id);expect(balance(state)).toEqual(before);
    const saved=new SaveSystem().parse(JSON.stringify(state));expect(saved.living!.facilities.map(f=>f.workOrder)).toEqual(state.living!.facilities.map(f=>f.workOrder));
  });
  it('leaves an already loaded lower-priority delivery, worker and cargo at their physical location',()=>{
    const {sim,state,g,sites}=twoGuns(),[low,urgent]=sites,p=state.soldiers.find(p=>p.id===low.workOrder!.workerIds[0])!;
    for(const person of state.soldiers)person.equipment!.tools=person===p;
    urgent.workOrder!.workerIds=[];low.workOrder!.workerIds=[p.id];transfer(g.cache,p.carried!,'materials',8);
    p.duty={kind:'haul',stage:'deliver',facilityId:low.id,destination:{x:low.x,z:low.z},route:[{x:low.x,z:low.z}],routeIndex:0,since:0,until:100,reason:'Loaded delivery',blockedFor:0};p.needs!.energy=20;
    const before=structuredClone(p),stock=balance(state);sim.garrisons.setWorkPriority(urgent.id,'critical');sim.garrisons.autoWorkers(low.id);sim.garrisons.autoWorkers(urgent.id);
    expect(low.workOrder!.workerIds).toContain(p.id);expect(urgent.workOrder!.workerIds).not.toContain(p.id);expect(p).toEqual(before);expect(balance(state)).toEqual(stock);
  });
  it('person orders preserve auto staffing; the explicit OFF choice and old saves remain manual',()=>{
    const {sim,state,sites}=twoGuns(),f=sites[0],p=state.soldiers.find(p=>p.id===f.workOrder!.workerIds[0])!;
    expect(sim.garrisons.orderPerson(p.id,'rest').accepted).toBe(true);expect(f.workOrder!.autoWorkers).toBe(true);
    sim.garrisons.setAutoWorkers(f.id,false);delete sites[1].workOrder!.autoWorkers;
    const restored=new SaveSystem().parse(JSON.stringify(state));expect(restored.living!.facilities.find(o=>o.id===f.id)!.workOrder!.autoWorkers).toBe(false);expect(restored.living!.facilities.find(o=>o.id===sites[1].id)!.workOrder!.autoWorkers).toBeUndefined();
  });
});
