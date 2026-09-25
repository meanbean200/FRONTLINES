import {describe,it,expect,vi} from 'vitest';
import {createBattlefield} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {distance,type TrenchState} from '../core/types';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance} from './Inventory';

function fixture(){
  const state=createBattlefield(),q=state.squads[0];state.squads=[q];state.soldiers=state.soldiers.filter(s=>s.squadId===q.id).slice(0,4);state.craters=[];
  q.soldierIds=state.soldiers.map(s=>s.id);
  const trench=(z:number):TrenchState=>({id:state.nextEntityId++,points:[{x:-1840,z},{x:-1760,z}],width:4.2,depth:1.75,progress:1,status:'complete'});
  const source=trench(-1700),target=trench(-1740);state.trenches=[source,target];
  state.soldiers.forEach((s,i)=>{s.x=-1800+i*2;s.z=-1700;});q.x=-1797;q.z=-1700;
  const sim=new BattlefieldSimulation(state);expect(sim.assignGarrison([q.id],source.id)).toBe(true);
  for(const g of state.living!.garrisons)g.nextSupport=1e9;
  return {state,sim,q,source,target};
}

describe('explicit reassignment between disconnected trenches',()=>{
  it('walks out, crosses clear ground and joins the new network without teleporting',()=>{
    const {state,sim,q,target}=fixture(),before=state.soldiers.map(s=>({x:s.x,z:s.z}));
    expect(sim.assignGarrison([q.id],target.id)).toBe(true);
    state.soldiers.forEach((s,i)=>expect(distance(s,before[i])).toBe(0));
    for(const g of state.living!.garrisons)g.nextSupport=1e9;
    let openGround=false;const arrived=new Set<number>();
    for(let i=0;i<1800;i++){
      const positions=state.soldiers.map(s=>({x:s.x,z:s.z}));sim.step(.05);
      state.soldiers.forEach((s,j)=>expect(distance(s,positions[j])).toBeLessThan(.12));
      if(state.soldiers.some(s=>!sim.garrisons.network.corridorContains(s)))openGround=true;
      for(const s of state.soldiers)if(!s.duty?.relocationExit&&Math.abs(s.z+1740)<2.2)arrived.add(s.id);
    }
    expect(openGround).toBe(true);
    // After physical arrival the nearer new road can dispatch legitimate haulers.
    expect(arrived.size).toBe(state.soldiers.length);
    for(const s of state.soldiers)expect(s.duty?.relocationExit).toBeUndefined();
    for(const n of Object.values(balance(state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('preserves an in-progress transfer and inventory exactly through save/load',()=>{
    const {state,sim,q,target}=fixture();expect(sim.assignGarrison([q.id],target.id)).toBe(true);
    for(const g of state.living!.garrisons)g.nextSupport=1e9;
    for(let i=0;i<160;i++)sim.step(.05);
    expect(state.soldiers.some(s=>s.duty?.relocationExit)).toBe(true);
    const loaded=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    for(let i=0;i<900;i++){sim.step(.05);loaded.step(.05);}
    expect(loaded.state).toEqual(state);
    expect(state.soldiers.every(s=>!s.duty?.relocationExit)).toBe(true);
  });
  it('leaves the original assignment untouched when no crossing route exists',()=>{
    const {state,sim,q,target}=fixture(),before=structuredClone(state);
    vi.spyOn(sim.navigation,'plan').mockReturnValue([]);
    expect(sim.assignGarrison([q.id],target.id)).toBe(false);expect(state).toEqual(before);
  });
  it('keeps explicit travel stable during alerts and a connected geometry expansion',()=>{
    const {state,sim,q,target}=fixture();expect(sim.assignGarrison([q.id],target.id)).toBe(true);
    const g=state.living!.garrisons.find(g=>g.trenchId===target.id)!;g.nextSupport=1e9;
    for(const other of state.living!.garrisons)other.nextSupport=1e9;
    for(let i=0;i<80;i++)sim.step(.05);
    const changes=state.soldiers.map(s=>s.needs!.taskChanges);
    sim.garrisons.setReadiness(g.id,'stand-to');
    state.trenches.push({id:state.nextEntityId++,points:[{x:-1780,z:-1740},{x:-1780,z:-1760}],width:4.2,depth:1.75,progress:1,status:'complete'});
    for(let i=0;i<100;i++)sim.step(.05);
    state.soldiers.forEach((s,i)=>{expect(s.needs!.taskChanges).toBe(changes[i]);expect(s.duty?.relocationExit).toBeDefined();});
    for(let i=0;i<1200;i++)sim.step(.05);
    expect(state.soldiers.every(s=>!s.duty?.relocationExit)).toBe(true);
  });
  it.each([0,8])('honors withdrawal after %s seconds of a transfer instead of stranding arrivals',(delay)=>{
    const {state,sim,q,target}=fixture();expect(sim.assignGarrison([q.id],target.id)).toBe(true);
    for(const other of state.living!.garrisons)other.nextSupport=1e9;
    const g=state.living!.garrisons.find(g=>g.trenchId===target.id)!;g.forward={x:-1800,z:-1755};
    for(let i=0;i<delay/.05;i++)sim.step(.05);
    sim.garrisons.resolveEmergency(g.id,'withdraw');
    for(let i=0;i<3600;i++)sim.step(.05);
    for(const s of state.soldiers){expect(distance(s,g.forward)).toBeLessThan(3);expect(s.duty?.relocationExit).toBeUndefined();}
  });
  it('validates transfer portals; Hold preserves the destination while Move cancels the trip',()=>{
    const {state,sim,q,target}=fixture();expect(sim.assignGarrison([q.id],target.id)).toBe(true);
    const invalid=structuredClone(state);invalid.soldiers[0].duty!.relocationExit={x:NaN,z:0};
    expect(()=>new SaveSystem().parse(JSON.stringify(invalid))).toThrow();
    const duties=structuredClone(state.soldiers.map(s=>s.duty));
    sim.issueHold([q.id]);expect(state.soldiers.map(s=>s.duty)).toEqual(duties);expect(q.order.trenchId).toBe(target.id);
    sim.issueMove([q.id],{x:q.x,z:q.z-20});expect(state.soldiers.every(s=>!s.duty&&!s.garrisonId)).toBe(true);
  });
});
