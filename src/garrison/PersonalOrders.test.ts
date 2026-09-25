import {describe,it,expect} from 'vitest';
import {createBattlefield} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {distance} from '../core/types';

function fixture(){
  const state=createBattlefield(),q=state.squads.find(q=>q.kind==='rifle')!;
  state.squads=[q];state.soldiers=state.soldiers.filter(s=>s.squadId===q.id);state.craters=[];
  const t={id:state.nextEntityId++,points:[{x:-1880,z:-1700},{x:-1680,z:-1700}],width:4.2,depth:1.75,progress:1,status:'complete' as const};state.trenches=[t];
  q.x=-1800;q.z=-1700;state.soldiers.forEach((s,i)=>{s.x=-1820+i*3;s.z=-1701;});
  const sim=new BattlefieldSimulation(state);expect(sim.assignGarrison([q.id],t.id)).toBe(true);const g=state.living!.garrisons[0];g.nextSupport=10000;
  return {state,sim,q,t,g,s:state.soldiers[0]};
}
const run=(sim:BattlefieldSimulation,seconds:number)=>{for(let n=0;n<seconds*20;n++)sim.step(.05);};

describe('individual trench orders',()=>{
  it('moves only the chosen person continuously inside the network and continues from a travel save',()=>{
    const {state,sim,q,s}=fixture(),target={x:-1805,z:-1699},others=structuredClone(state.soldiers.slice(1)),order=structuredClone(q.order);
    expect(sim.garrisons.orderPerson(s.id,'move',target).accepted).toBe(true);
    expect(state.soldiers.slice(1)).toEqual(others);expect(q.order).toEqual(order);expect(s.duty?.playerOrdered).toBe(true);
    run(sim,2);const loaded=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    for(let n=0;n<800;n++){const before={x:s.x,z:s.z};sim.step(.05);loaded.step(.05);expect(distance(s,before)).toBeLessThan(.12);expect(sim.garrisons.network.corridorContains(s)).toBe(true);}
    expect(loaded.state).toEqual(state);expect(distance(s,target)).toBeLessThan(.7);
  });
  it('keeps a personal rest assignment when area watch staffing changes',()=>{
    const {sim,s,g}=fixture();s.needs!.energy=65;
    expect(sim.garrisons.orderPerson(s.id,'rest').accepted).toBe(true);sim.garrisons.setReadiness(g.id,'stand-to');run(sim,35);
    expect(s.duty?.kind).toBe('sleep');expect(s.duty?.playerOrdered).toBe(true);expect(s.action).toBe('sleeping');
    expect(g.watchPresent).toBeLessThan(g.watchRequired);
  });
  it('honors an individual watch post despite routine surplus, then returns to relief scheduling',()=>{
    const {sim,s,state}=fixture();
    expect(sim.garrisons.orderPerson(s.id,'watch').accepted).toBe(true);run(sim,15);
    expect(s.duty?.kind).toBe('watch');expect(s.duty?.playerOrdered).toBe(true);
    expect(sim.garrisons.orderPerson(s.id,'auto').accepted).toBe(true);expect(s.duty?.playerOrdered).toBeUndefined();
    expect(s.duty?.until).toBe(state.elapsed);
  });
  it('eats actual carried supplies rather than granting free recovery',()=>{
    const {sim,s,state}=fixture();s.needs!.hunger=70;s.needs!.thirst=70;const food=s.carried!.food,water=s.carried!.water,consumed=state.living!.ledger.consumed.food;
    expect(sim.garrisons.orderPerson(s.id,'meal').accepted).toBe(true);run(sim,25);
    expect(s.carried!.food).toBeLessThan(food);expect(s.carried!.water).toBeLessThan(water);expect(state.living!.ledger.consumed.food).toBeGreaterThan(consumed);expect(s.needs!.hunger).toBeLessThan(60);
  });
  it('rejects open ground and disconnected trenches without overwriting a valid order',()=>{
    const {sim,s,state}=fixture();sim.garrisons.orderPerson(s.id,'rest');const before=JSON.stringify(s);
    state.trenches.push({id:state.nextEntityId++,points:[{x:-1700,z:-1800},{x:-1600,z:-1800}],width:4.2,depth:1.75,progress:1,status:'complete'});
    for(const p of [{x:-1800,z:-1720},{x:-1650,z:-1800},{x:NaN,z:0}])expect(sim.garrisons.orderPerson(s.id,'move',p).accepted).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('does not interrupt a delivery or override casualty/side authority',()=>{
    const {sim,s,q}=fixture();sim.garrisons.orderPerson(s.id,'rest');s.duty!.kind='haul';const before=JSON.stringify(s);
    expect(sim.garrisons.orderPerson(s.id,'watch').accepted).toBe(false);expect(JSON.stringify(s)).toBe(before);
    delete s.duty;s.needs!.life='incapacitated';expect(sim.garrisons.orderPerson(s.id,'rest').accepted).toBe(false);
    s.needs!.life='active';q.faction='enemy';expect(sim.garrisons.orderPerson(s.id,'rest').accepted).toBe(false);
  });
  it('later squad movement cancels a personal assignment without losing identity or inventory',()=>{
    const {sim,s,q}=fixture();sim.garrisons.orderPerson(s.id,'rest');const kit=structuredClone(s.equipment),cargo=structuredClone(s.carried);
    sim.issueMove([q.id],{x:-1790,z:-1680});expect(s.duty).toBeUndefined();expect(s.garrisonId).toBeUndefined();expect(s.equipment).toEqual(kit);expect(s.carried).toEqual(cargo);
  });
  it('rejects malformed personal-duty flags while old saves without them remain valid',()=>{
    const {sim,s,state}=fixture();sim.garrisons.orderPerson(s.id,'rest');const save=new SaveSystem();expect(()=>save.parse(JSON.stringify(state))).not.toThrow();
    const bad=JSON.parse(JSON.stringify(state));bad.soldiers[0].duty.playerOrdered='yes';expect(()=>save.parse(JSON.stringify(bad))).toThrow();
    delete s.duty!.playerOrdered;state.combatRules='combat-26-autonomy-world2';expect(()=>save.parse(JSON.stringify(state))).not.toThrow();
  });
});
