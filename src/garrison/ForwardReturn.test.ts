import {describe,it,expect,vi} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {transfer,balance} from './Inventory';
import {reconcileSupplyDemands} from './SupplyDemand';
import {SaveSystem} from '../persistence/SaveSystem';
import type {SoldierState} from '../core/types';
import {inventory,type Garrison} from './types';

describe('loaded forward carriers after a failed return plan',()=>{
  it('does not leave urgently claimed gun rounds behind on an ammunition run',()=>{
    const sim=createStudyScenario(1944,0,8),s=sim.state,w=s.living!,g=w.garrisons[0],p=s.soldiers[4];
    const origin={x:g.entrance.x+20,z:g.entrance.z};
    const id=sim.garrisons.requestFacility(g.id,'mortar',{x:origin.x,z:origin.z-10},origin,0,true)!;
    const gun=w.facilities.find(f=>f.id===id)!;gun.progress=1;gun.paid=true;gun.stock=inventory();gun.weaponCrewIds=s.soldiers.slice(0,2).map(p=>p.id);
    for(const crew of s.soldiers.slice(0,2)){crew.carried!.mortarHE=0;crew.carried!.mortarSmoke=0;}
    // Explicit finite fixture manifest. The consumer priority and physical pickup
    // below are production code, not a synthetic result or a runtime refill.
    g.forwardStock.mortarHE=4;g.forwardStock.mortarSmoke=2;w.ledger.initial.mortarHE+=4;w.ledger.initial.mortarSmoke+=2;
    g.underFireUntil=60;s.elapsed=4;Object.assign(p,g.forward);p.carried=inventory();p.combat={shotSequence:0,owner:'duty'};
    p.duty={kind:'haul',stage:'pickup',urgentAmmo:true,destination:{...g.forward},route:[],routeIndex:0,arrivedAt:0,since:0,until:180,blockedFor:0,reason:'Collect critical ammunition'};
    reconcileSupplyDemands(s);const accounting=balance(s);
    expect(w.supplyDemands!.some(d=>d.consumerId===gun.id&&d.priority===0&&d.claims.some(c=>c.source==='forward'))).toBe(true);
    const internal=sim.garrisons as unknown as {assignDuty:()=>boolean;execute:(p:SoldierState,g:Garrison,dt:number)=>void};
    const denied=vi.spyOn(internal,'assignDuty').mockReturnValue(false);
    internal.execute(p,g,.05);
    expect(p.carried.mortarHE).toBe(2);expect(p.carried.mortarSmoke).toBe(1);
    expect(g.forwardStock.mortarHE).toBe(2);expect(g.forwardStock.mortarSmoke).toBe(1);
    expect(balance(s)).toEqual(accounting);denied.mockRestore();
  });
  it('explains the blocked return and retains one physical pickup across retries and save/load',()=>{
    const sim=createStudyScenario(1944,0,8),s=sim.state,w=s.living!,g=w.garrisons[0],p=s.soldiers[0];g.nextSupport=1e9;
    const origin={x:g.entrance.x+20,z:g.entrance.z};
    expect(sim.garrisons.requestFacility(g.id,'store',{x:origin.x,z:origin.z-10},origin,0,true)).toBeDefined();
    transfer(g.cache,w.rearStock,'materials',g.cache.materials);transfer(w.rearStock,g.forwardStock,'materials',16);
    s.elapsed=4;Object.assign(p,g.forward);p.combat={shotSequence:0,owner:'duty'};
    p.duty={kind:'haul',stage:'pickup',destination:{...g.forward},route:[],routeIndex:0,arrivedAt:0,since:0,until:180,blockedFor:0,reason:'Fetch delivered construction materials'};
    reconcileSupplyDemands(s);const accounting=balance(s);
    const internal=sim.garrisons as unknown as {assignDuty:()=>boolean;execute:(p:SoldierState,g:Garrison,dt:number)=>void};
    const denied=vi.spyOn(internal,'assignDuty').mockReturnValue(false);
    internal.execute(p,g,.05);expect(p.carried!.materials).toBeGreaterThan(0);
    expect(p.duty!.reason).toContain('RETURN ROUTE BLOCKED');expect(p.action).toBe('supply route blocked');
    const held={...p.carried},source={...g.forwardStock},position={x:p.x,z:p.z};
    for(let i=0;i<100;i++){s.elapsed+=.05;internal.execute(p,g,.05);}
    expect(p.carried).toEqual(held);expect(g.forwardStock).toEqual(source);expect({x:p.x,z:p.z}).toEqual(position);
    expect(denied.mock.calls.length).toBeLessThan(5);expect(balance(s)).toEqual(accounting);
    reconcileSupplyDemands(s);expect(new SaveSystem().parse(JSON.stringify(s)).soldiers.find(v=>v.id===p.id)!.duty).toEqual(p.duty);
    denied.mockRestore();s.elapsed+=4;internal.execute(p,g,.05);
    expect(p.duty!.stage).toBe('deliver');expect(p.carried).toEqual(held);
  });
});
