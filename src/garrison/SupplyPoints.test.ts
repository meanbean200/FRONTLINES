import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {inventory} from './types';
import {balance,transfer,total} from './Inventory';
import {changeSupplyPoint,supplyPointAccess} from './SupplyPoints';
import {reconcileSupplyDemands} from './SupplyDemand';
import {SaveSystem} from '../persistence/SaveSystem';
import {controlReadout} from '../operations/ObjectiveControl';
import {networkSupply} from '../ui/PositionReadout';
import {createStudyScenario} from './StudyScenario';
import type {Garrison} from './types';
import type {SoldierState} from '../core/types';

function fixture(){
  const sim=new BattlefieldSimulation(createOperation('open-front')),s=sim.state,w=s.living!,g=w.garrisons.find(g=>g.faction!=='enemy')!,town=s.operation!.objectives[0];
  town.owner='player';town.control=1;town.contested=false;
  return {sim,s,w,g,town};
}
describe('secured town supply points and physical changeover',()=>{
  it('does not move a loaded shipment, its destination, cargo or forward stock when a new point is requested',()=>{
    const {s,w,g,town}=fixture(),truck=w.trucks.find(t=>t.role==='shuttle'&&t.faction!=='enemy')!;
    transfer(w.rearStock,g.forwardStock,'materials',20);transfer(w.rearStock,truck.cargo,'materials',10);
    Object.assign(truck,{garrisonId:g.id,state:'outbound',destination:{...g.forward},route:[{...g.forward}]});
    const at={...g.forward},cargo={...truck.cargo},oldStock={...g.forwardStock},vehicles=w.trucks.length;
    g.pendingSupplyPoint={townId:town.id,point:{x:at.x+50,z:at.z}};
    changeSupplyPoint(s,g,()=>true);expect(g.forward).toEqual(at);expect(g.forwardStock).toEqual(oldStock);expect(truck.destination).toEqual(at);expect(truck.cargo).toEqual(cargo);expect(g.supplyPointIssue).toContain('handoff');
    reconcileSupplyDemands(s);const restored=new SaveSystem().parse(JSON.stringify(s));expect(restored.living!.garrisons.find(p=>p.id===g.id)?.pendingSupplyPoint).toEqual(g.pendingSupplyPoint);
    truck.state='returning';
    changeSupplyPoint(s,g,()=>true);expect(g.supplyTownId).toBe(town.id);expect(total(g.forwardStock)).toBe(0);expect(g.forward.x).toBe(at.x+50);
    expect(w.crates.find(c=>c.x===at.x&&c.z===at.z)?.stock).toEqual(oldStock);expect(w.trucks).toHaveLength(vehicles);
    for(const n of Object.values(balance(s)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('waits for a foot pickup and pauses changes if the town is contested',()=>{
    const {s,g,town}=fixture(),person=s.soldiers.find(s=>s.garrisonId===g.id)!;
    person.duty={kind:'haul',stage:'pickup',destination:{...g.forward},route:[],routeIndex:0,since:0,until:180,blockedFor:0,reason:'Collect shipment'};
    g.pendingSupplyPoint={townId:town.id,point:{x:g.forward.x+50,z:g.forward.z}};
    changeSupplyPoint(s,g,()=>true);expect(g.pendingSupplyPoint).toBeDefined();expect(g.supplyPointIssue).toContain('handoff');
    delete person.duty;town.contested=true;changeSupplyPoint(s,g,()=>true);expect(g.supplyPointIssue).toBe('AREA NOT SECURED');expect(g.pendingSupplyPoint).toBeDefined();
    expect(supplyPointAccess(s,town.id)).toBe('AREA NOT SECURED');
    town.contested=false;changeSupplyPoint(s,g,()=>true);expect(g.pendingSupplyPoint).toBeUndefined();
  });
  it('rejects neutral towns and offers only a real road and last-mile route',()=>{
    const {sim,s,g}=fixture();let accessible=0;
    for(const town of s.operation!.objectives){
      town.owner='neutral';expect(sim.garrisons.logistics.setSupplyPoint(g.id,town.id).reason).toBe('AREA NOT SECURED');
      town.owner='player';town.contested=false;
      const preview=sim.garrisons.logistics.previewSupplyPoint(g.id,town.id);
      if(preview.accepted){accessible++;expect(preview.point).toBeDefined();expect(sim.garrisons.logistics.setSupplyPoint(g.id,town.id).accepted).toBe(true);}
      else expect(preview.reason).toMatch(/ROAD ACCESS|LAST-MILE/);
    }
    expect(accessible).toBeGreaterThan(0);
  });
  it('finishes existing foot pickups without continually creating new ones during a changeover',()=>{
    const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0],people=s.soldiers;
    transfer(g.cache,g.forwardStock,'food',g.cache.food);transfer(g.cache,g.forwardStock,'water',g.cache.water);
    g.watchRequired=0;
    for(const p of people){delete p.duty;p.needs!.energy=90;p.needs!.hunger=0;p.needs!.thirst=0;}
    const coordinate=()=> (sim.garrisons as unknown as {coordinate:(g:Garrison,people:SoldierState[])=>void}).coordinate(g,people);
    coordinate();const pickup=people.find(p=>p.duty?.kind==='haul'&&p.duty.stage==='pickup')!;
    expect(pickup).toBeDefined();const original=structuredClone(pickup.duty);
    for(const p of people)if(p!==pickup)delete p.duty;
    g.pendingSupplyPoint={townId:'future-town',point:{x:g.forward.x+100,z:g.forward.z}};
    coordinate();
    expect(pickup.duty).toEqual(original);
    expect(people.filter(p=>p.duty?.kind==='haul'&&p.duty.stage==='pickup')).toEqual([pickup]);
    // Once the already-committed trip finishes, the scheduler must not replace it
    // before the next logistics tick can perform the physical changeover.
    delete pickup.duty;coordinate();
    expect(people.some(p=>p.duty?.kind==='haul'&&p.duty.stage==='pickup')).toBe(false);
  });
  it('does not advertise depleted stock, refill captured towns, or create trucks for several hubs',()=>{
    const {s,w,town}=fixture(),crate=w.crates.find(c=>c.id===town.cacheId)!;
    crate.stock=inventory();expect(controlReadout(s,town).reason).toContain('depleted');
    const vehicles=w.trucks.length;
    for(const [i,g]of w.garrisons.filter(g=>g.faction!=='enemy').entries()){g.pendingSupplyPoint={townId:town.id,point:{x:g.forward.x+10+i,z:g.forward.z}};changeSupplyPoint(s,g,()=>true);}
    expect(w.trucks).toHaveLength(vehicles);expect(total(crate.stock)).toBe(0);
  });
  it('does not promise inaccessible town stock and preserves it through contesting and save/load',()=>{
    const {s,w,g,town}=fixture();g.supplyTownId=town.id;
    transfer(w.rearStock,g.forwardStock,'ammo',100);g.cache.ammo=0;
    reconcileSupplyDemands(s);expect(w.supplyDemands!.some(d=>d.garrisonId===g.id&&d.claims.some(c=>c.source==='forward'))).toBe(true);
    const stock={...g.forwardStock};town.contested=true;changeSupplyPoint(s,g,()=>true);reconcileSupplyDemands(s);
    expect(g.supplyPointIssue).toBe('AREA NOT SECURED');
    expect(w.supplyDemands!.some(d=>d.garrisonId===g.id&&d.claims.some(c=>c.source==='forward'))).toBe(false);
    const row=networkSupply(s,[g]).rows.find(r=>r.key==='ammo')!;expect(row.inaccessible).toBe(100);expect(row.inbound).toBe(0);expect(row.reason).toContain('AREA NOT SECURED');
    expect(new SaveSystem().parse(JSON.stringify(s)).living!.garrisons.find(p=>p.id===g.id)!.forwardStock).toEqual(stock);
    town.contested=false;changeSupplyPoint(s,g,()=>true);reconcileSupplyDemands(s);expect(g.supplyPointIssue).toBeUndefined();expect(g.forwardStock).toEqual(stock);
  });
});
