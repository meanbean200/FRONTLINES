import {describe,it,expect,vi} from 'vitest';
import {createOperationalBattle} from '../operations/createOperationalBattle';
import {defaultOpenFrontSetup,resolveBattleSetup} from '../operations/BattleSetup';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {inventory} from './types';
import {transfer,total,balance} from './Inventory';
import {reconcileSupplyDemands} from './SupplyDemand';
import {SaveSystem} from '../persistence/SaveSystem';
import {pointOnRoad,ROADS} from '../terrain/WorldLayout';

function fixture(){
  const setup=resolveBattleSetup({...defaultOpenFrontSetup(),map:'seed',advanced:{...defaultOpenFrontSetup().advanced,direction:'east'}},1944);
  const state=createOperationalBattle('open-front',1944,setup,true),sim=new BattlefieldSimulation(state),w=state.living!,terrain=sim.terrain;
  vi.spyOn(terrain,'heightAt').mockReturnValue(0);vi.spyOn(terrain,'obstacleAt').mockReturnValue(false);vi.spyOn(terrain,'deformationAt').mockReturnValue(0);vi.spyOn(terrain,'groundTypeAt').mockReturnValue('road');vi.spyOn(terrain.objects,'trace').mockReturnValue({clear:true,transmission:1});
  const factions=new Map(state.squads.map(q=>[q.id,q.faction]));
  for(const s of state.soldiers){s.x=factions.get(s.squadId)==='enemy'?900:-900;s.z=900;}
  const areas=[-600,-850].map((x,i)=>{
    const t={id:state.nextEntityId++,points:[{x,z:30},{x,z:90}],width:7.2,depth:1.75,progress:1,status:'complete' as const};state.trenches.push(t);
    const g=sim.garrisons.ensureArea(t.id)!,q=state.squads.filter(q=>q.faction==='player')[i];g.squadIds=[q.id];q.order={type:'occupy-trench',trenchId:t.id,issuedAt:0};
    for(const [n,p] of state.soldiers.filter(p=>p.squadId===q.id).entries()){p.x=x;p.z=40+n*2;p.garrisonId=g.id;p.duty={kind:'watch',destination:{x:p.x,z:p.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:1000,blockedFor:0,reason:'Staffed fixture'};}
    return g;
  });
  for(const t of w.trucks){t.state='loading';t.timer=1e6;}w.nextDelivery=w.enemySupply!.nextDelivery=1e6;
  const [a,b]=areas,[lost,spare]=w.trucks.filter(t=>t.role==='shuttle'&&t.faction!=='enemy');
  const work=(g:typeof a)=>{const f={id:state.nextEntityId++,garrisonId:g.id,kind:'emplacement' as const,...g.entrance,connectorId:g.trenchId,progress:0,capacity:2,paid:false,stock:inventory(),materialCost:16,workOrder:{explicit:true,workerIds:[],createdAt:state.elapsed}};w.facilities.push(f);return f;};
  const first=work(a);transfer(w.rearStock,lost.cargo,'materials',16);a.lastDispatchAt=0;
  Object.assign(lost,{...pointOnRoad(ROADS[2],-620),garrisonId:a.id,state:'outbound',route:[a.forward],destination:a.forward,routeIndex:0});
  const hostile=state.soldiers.filter(p=>factions.get(p.squadId)==='enemy').slice(0,3);
  // Match the end-of-garrison-tick reconciliation while isolating transport
  // from people being rescheduled in this controlled staffing fixture.
  const tick=()=>{state.elapsed+=.05;state.operation!.elapsed=state.elapsed;sim.garrisons.logistics.step(.05);reconcileSupplyDemands(state);};
  return {state,sim,w,a,b,lost,spare,hostile,first,work,tick};
}

describe('abandoned trip versus independent salvage and dispatch',()=>{
  it('releases the trip, retains its physical load, and supplies B with no carrier available to salvage A',()=>{
    const {state,sim,w,a,b,lost,spare,hostile,first,work,tick}=fixture();
    for(const [i,p] of hostile.entries()){p.x=lost.x+6;p.z=lost.z+i;}
    reconcileSupplyDemands(state);expect(w.supplyDemands!.find(d=>d.consumerId===first.id)!.claims).toContainEqual({source:'truck',id:lost.id,amount:16});
    for(let i=0;i<180;i++)tick();
    expect(lost.abandoned).toBe(true);expect(total(lost.cargo)).toBe(0);
    expect(lost.garrisonId).toBeUndefined();expect(lost.destination).toBeUndefined();expect(lost.route).toEqual([]);
    expect(w.supplyDemands!.every(d=>d.claims.every(c=>c.source!=='truck'||c.id!==lost.id))).toBe(true);
    const crate=w.crates.find(c=>c.id===lost.salvageId)!;expect(crate.stock.materials).toBe(16);
    for(const p of hostile){p.x=900;p.z=900;}
    expect(sim.garrisons.recoverSupplies(crate.id,a.id)).toMatchObject({accepted:false,reason:expect.stringContaining('NO CARRIER')});
    work(b);spare.state='idle';spare.timer=0;tick();expect(spare.garrisonId).toBe(b.id);
    for(let i=0;i<2000&&b.forwardStock.materials<16;i++)tick();
    expect(b.forwardStock.materials).toBe(16);expect(crate.stock.materials).toBe(16);
    expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-6)).toBe(true);
    expect(new SaveSystem().parse(JSON.stringify(state)).living!.trucks).toEqual(w.trucks);
  });
  it('only a physical rear contest pauses loading, then automatically resumes with cargo intact',()=>{
    const {state,w,b,spare,hostile,work,tick}=fixture();work(b);spare.state='idle';tick();expect(spare.state).toBe('loading');
    const cargo={...spare.cargo},timer=spare.timer;
    for(const [i,p] of hostile.entries()){p.x=w.rear.x+8;p.z=w.rear.z+i;}
    for(let i=0;i<40;i++)tick();expect(spare.reason).toBe('REAR DEPOT CONTESTED · DISPATCH SUSPENDED');expect(spare.timer).toBe(timer);expect(spare.cargo).toEqual(cargo);
    for(const p of hostile){p.x=900;p.z=900;}
    for(let i=0;i<150&&String(spare.state)==='loading';i++)tick();expect(spare.state).toBe('outbound');expect(spare.cargo).toEqual(cargo);
    expect(new SaveSystem().parse(JSON.stringify(state)).living!.trucks).toEqual(w.trucks);
  });
});
