import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from './BattlefieldSimulation';
import {stepSelfPreservation} from './SelfPreservation';
import {prepareActions} from '../combat/Reactions';
import {updateNeeds} from '../garrison/NeedsSystem';
import {balance} from '../garrison/Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {createBattlefield,addSquad} from './createBattlefield';
import {distance} from '../core/types';

function fixture(){
  const sim=new BattlefieldSimulation(createOperation('campaign',1944)),state=sim.state;
  const g=state.living!.garrisons.find(g=>g.faction!=='enemy')!;
  const p=state.soldiers.find(s=>s.garrisonId===g.id)!,q=state.squads.find(q=>q.id===p.squadId)!;
  p.combat={shotSequence:0};p.suppression=0;p.morale=100;
  p.duty={kind:'haul',destination:{x:p.x+500,z:p.z},route:[{x:p.x+500,z:p.z}],routeIndex:0,since:0,until:0,reason:'Long delivery',blockedFor:0,stage:'deliver'};
  p.action='walking · haul';p.needs!.energy=90;p.needs!.hunger=65;p.needs!.thirst=70;
  return {sim,state,p,q};
}
function tick(f:ReturnType<typeof fixture>){
  f.state.elapsed+=.05;
  prepareActions(f.state,f.sim.terrain,f.sim.navigation,.05);
  stepSelfPreservation(f.state,f.sim.terrain,f.sim.navigation,.05);
  updateNeeds(f.state,f.p,.05);
}
describe('P0 march survival',()=>{
  it('uses a carried ration during garrison travel without losing the duty or stock',()=>{
    const f=fixture(),{state,p,q}=f,before=balance(state),order=structuredClone(q.order),duty=structuredClone(p.duty);
    const food=p.carried!.food,water=p.carried!.water;
    for(let i=0;i<200;i++)tick(f);
    expect(p.carried!.food).toBeLessThan(food);expect(p.carried!.water).toBeLessThan(water);
    expect(p.needs!.hunger).toBeLessThan(55);expect(p.needs!.thirst).toBeLessThan(50);
    expect(p.duty).toEqual(duty);expect(q.order).toEqual(order);
    for(const key of Object.keys(before) as (keyof typeof before)[])expect(balance(state)[key]).toBeCloseTo(before[key],7);
  });
  it('recovers before collapse while retaining a travelling work assignment',()=>{
    const f=fixture(),{p}=f;p.needs!.energy=24;p.needs!.hunger=p.needs!.thirst=10;
    const duty=structuredClone(p.duty);tick(f);
    expect(p.selfCare?.kind).toBe('sleep');expect(p.combat?.owner).toBe('self-care');
    for(let i=0;i<4000&&p.selfCare;i++)tick(f);
    expect(p.needs!.energy).toBeGreaterThan(44.99);expect(p.needs!.life).toBe('active');expect(p.duty).toEqual(duty);
  });
  it('continues an interrupted ration deterministically after save/load',()=>{
    const f=fixture();tick(f);expect(f.p.selfCare).toBeDefined();
    const state=new SaveSystem().parse(JSON.stringify(f.state)),sim=new BattlefieldSimulation(state);
    const copy={state,sim,p:state.soldiers.find(s=>s.id===f.p.id)!,q:state.squads.find(q=>q.id===f.q.id)!};
    for(let i=0;i<200;i++){tick(f);tick(copy);}expect(copy.state).toEqual(f.state);
  });
  it.each([1,5])('completes real travel at %s× after food, water and fatigue breaks',speed=>{
    const state=createBattlefield();state.soldiers=[];state.squads=[];state.trenches=[];state.craters=[];
    const q=addSquad(state,'rifle',8,-1840,-1700,'March fixture'),sim=new BattlefieldSimulation(state);
    state.living!.lethalNeeds=true;state.simSpeed=speed;
    // Full fixed-step pipeline, not a needs-only probe. No opponents or replenishment.
    for(const s of state.soldiers){s.needs!.energy=24;s.needs!.hunger=65;s.needs!.thirst=70;}
    const before=balance(state),target={x:-1510,z:-1700};sim.issueMove([q.id],target);
    let meal=false,rest=false,resumed=false;
    for(let i=0;i<12000/speed&&q.order.type==='move';i++){
      sim.step(.05);meal ||=state.soldiers.some(s=>s.action==='eating');rest ||=state.soldiers.some(s=>s.action==='sleeping');
      resumed ||=rest&&state.soldiers.some(s=>s.needs!.energy>44&&s.action==='advancing');
    }
    expect({meal,rest,resumed}).toEqual({meal:true,rest:true,resumed:true});
    expect(state.soldiers.map(s=>s.needs!.life)).toEqual(Array(8).fill('active'));
    expect(q.order.type).toBe('hold');expect(state.soldiers.every(s=>distance(s,target)<18)).toBe(true);
    expect(state.living!.ledger.consumed.food).toBeGreaterThan(0);expect(state.living!.ledger.consumed.water).toBeGreaterThan(0);
    for(const key of Object.keys(before) as (keyof typeof before)[])expect(balance(state)[key]).toBeCloseTo(before[key],7);
  },30000);
  it.each([1,5])('crosses 3.7km at %s× with finite starting rations and no needs resets',speed=>{
    const state=createBattlefield();state.soldiers=[];state.squads=[];state.trenches=[];state.craters=[];
    const q=addSquad(state,'rifle',8,-1850,-1750,'Long march'),sim=new BattlefieldSimulation(state),target={x:1850,z:-1750};
    state.living!.lethalNeeds=true;state.simSpeed=speed;
    if(speed===5)q.faction='enemy'; // Same survival path for either faction.
    sim.issueMove([q.id],target,true);const before=balance(state);let rest=false;
    for(let i=0;i<65000/speed&&q.order.type==='move';i++){
      sim.step(.05);rest ||=state.soldiers.some(s=>s.action==='sleeping');
    }
    expect(q.order.type,JSON.stringify(state.soldiers.map(s=>({id:s.id,x:s.x,z:s.z,action:s.action,needs:s.needs,care:s.selfCare})))).toBe('hold');
    expect(rest).toBe(true);expect(state.soldiers.every(s=>s.needs!.life==='active'&&distance(s,target)<18)).toBe(true);
    expect(state.living!.metrics.deaths).toBe(0);expect(state.living!.ledger.consumed.water).toBeGreaterThan(0);
    for(const key of Object.keys(before) as (keyof typeof before)[])expect(balance(state)[key]).toBeCloseTo(before[key],7);
  },30000);
  it('stops critically dry travel at a blocked supply route and resumes after physical delivery',()=>{
    const f=fixture(),{p,sim,state}=f;p.needs!.thirst=90;p.needs!.hunger=10;
    const water=p.carried!.water;p.carried!.water=0;state.living!.rearStock.water+=water;
    for(const g of state.living!.garrisons)for(const stock of [g.cache,g.forwardStock]){state.living!.rearStock.water+=stock.water;stock.water=0;}
    for(const f of state.living!.facilities){state.living!.rearStock.water+=f.stock.water;f.stock.water=0;}
    p.duty!.networkBound=true;const duty=structuredClone(p.duty),point={x:p.x,z:p.z};
    for(let i=0;i<200;i++)tick(f);
    expect(p.selfCare?.kind).toBe('supply-wait');expect(p.survivalReason).toContain('SUPPLY ROUTE BLOCKED');
    expect({x:p.x,z:p.z}).toEqual(point);expect(p.duty).toEqual(duty);expect(p.needs!.thirst).toBeGreaterThan(90);
    const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    expect(copy.state.soldiers.find(s=>s.id===p.id)!.selfCare).toEqual(p.selfCare);
    // The fixture hands over an accounted ration at the person, not a refill.
    state.living!.rearStock.water--;p.carried!.water++;
    for(let i=0;i<240;i++)tick(f);
    expect(p.needs!.thirst).toBeLessThan(50);expect(p.selfCare).toBeUndefined();expect(p.duty).toEqual(duty);
    expect(sim.state.soldiers.find(s=>s.id===p.id)).toBe(p);
  });
});
