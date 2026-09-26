import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from './BattlefieldSimulation';
import {stepSelfPreservation} from './SelfPreservation';
import {stepBuildings} from './BuildingSystem';
import {prepareActions} from '../combat/Reactions';
import {updateNeeds} from '../garrison/NeedsSystem';
import {balance,transfer} from '../garrison/Inventory';
import {doorPoint,firingPoints,floorHeight} from '../terrain/BuildingGeometry';
import {SaveSystem} from '../persistence/SaveSystem';
import {distance} from '../core/types';

function fixture(floor:0|1=0){
  const sim=new BattlefieldSimulation(createOperation('advance',1944)),s=sim.state,q=s.squads[0],p=s.soldiers[0],id=48,b=sim.terrain.buildings[id];
  for(const other of s.soldiers){other.x=1800;other.z=1800;if(other!==p&&other.squadId===q.id)other.needs!.life='incapacitated';}
  sim.issueBuilding([q.id],id,floor);const target=firingPoints(b)[0];Object.assign(p,target);
  p.building={id,floor,vertical:floorHeight(b)*floor,route:[],index:0,stage:'station',target:{...target},targetFloor:floor,stairTime:0};
  const rear=sim.navigation.freeDestination(doorPoint(b,28));s.living!.rear={...rear};transfer(p.carried!,s.living!.rearStock,'food',p.carried!.food);transfer(p.carried!,s.living!.rearStock,'water',p.carried!.water);
  p.needs!.hunger=65;p.needs!.thirst=70;p.needs!.energy=90;
  return {sim,s,q,p,target};
}
function tick(sim:BattlefieldSimulation){const s=sim.state;s.elapsed+=.05;prepareActions(s,sim.terrain,sim.navigation,.05);stepSelfPreservation(s,sim.terrain,sim.navigation,.05);stepBuildings(s,sim.terrain,sim.navigation,.05);for(const p of s.soldiers)updateNeeds(s,p,.05);}
describe('general survival without losing standing orders',()=>{
  it.each([0,1] as const)('physically leaves floor %s, collects stock and returns to the same firing point',floor=>{
    const {sim,s,q,p,target}=fixture(floor),before=balance(s),order=structuredClone(q.order);let collected=false,saved=false;
    for(let i=0;i<6000;i++){
      const old={x:p.x,z:p.z};tick(sim);expect(distance(p,old)).toBeLessThan(.12);
      if(p.selfCare?.stage==='outbound'&&!saved){expect(new SaveSystem().parse(JSON.stringify(s))).toEqual(s);saved=true;}
      if(p.carried!.food>0&&p.carried!.water>0)collected=true;
      if(collected&&!p.selfCare&&p.building?.stage==='station')break;
    }
    expect(collected,JSON.stringify({p,stock:s.living!.rearStock})).toBe(true);expect(saved).toBe(true);
    expect(p.selfCare,JSON.stringify(p)).toBeUndefined();expect(p.building?.floor).toBe(floor);expect(distance(p,target)).toBeLessThan(.1);expect(q.order).toEqual(order);
    expect(p.needs!.hunger).toBeLessThan(55);expect(p.needs!.thirst).toBeLessThan(50);
    for(const k of Object.keys(before) as (keyof typeof before)[])expect(balance(s)[k]).toBeCloseTo(before[k],7);
  },20000);
  it('sleeps outside a trench and resumes a prepared standing intention without healing wounds',()=>{
    const {sim,s,q,p}=fixture();delete p.building;delete q.order.building;p.x=s.living!.rear.x;p.z=s.living!.rear.z-5;p.needs!.energy=12;p.needs!.hunger=10;p.needs!.thirst=10;
    (p.combat??={shotSequence:0}).wound={severity:'legacy',at:0,stabilized:true,care:'stabilized'};p.health=60;const order=structuredClone(q.order);
    tick(sim);expect(p.action).toBe('sleeping');const at={x:p.x,z:p.z};
    for(let i=0;i<5200&&p.selfCare;i++)tick(sim);
    expect(p.selfCare).toBeUndefined();expect(p.needs!.energy).toBeGreaterThan(44.99);expect({x:p.x,z:p.z}).toEqual(at);expect(p.health).toBe(60);expect(q.order).toEqual(order);
  });
  it('does not invent food, abandon a post under fire, or keep a break after a new order',()=>{
    const {sim,s,q,p}=fixture();p.suppression=30;tick(sim);expect(p.selfCare).toBeUndefined();expect(p.carried!.food).toBe(0);
    p.suppression=0;p.combat!.reaction='steady';p.nextSelfCareReview=0;tick(sim);expect(p.selfCare).toBeDefined();
    q.order={type:'hold',issuedAt:s.elapsed};tick(sim);expect(p.selfCare).toBeUndefined();expect(p.carried!.food).toBe(0);
    const malformed=structuredClone(s);malformed.soldiers[0].selfCare={kind:'sleep',stage:'use',orderAt:0,since:0,until:3,blockedFor:0,home:{x:0,z:0},route:[],index:-1};expect(()=>new SaveSystem().parse(JSON.stringify(malformed))).toThrow();
  });
  it('uses individual clearance from the real house 21 doorway instead of rejecting a safe supply route',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance',1944)),b=sim.terrain.buildings[20],from=doorPoint(b,8),to={x:-1390,z:-1344.879089424514};
    expect(sim.navigation.plan(from,to)).toEqual([]);
    expect(sim.navigation.planFormation(from,to).length).toBeGreaterThan(0);
    const route=sim.navigation.plan(from,to,undefined,true);expect(route.length).toBeGreaterThan(0);
    expect(route.every((p,i)=>sim.navigation.segmentClear(i?route[i-1]:from,p,.5))).toBe(true);
  });
  it('staggers ordinary rest and gives severe thirst priority while physically resting on a long supply journey',()=>{
    const {sim,s,q,p}=fixture();
    for(const other of s.soldiers.filter(o=>o.squadId===q.id)){other.needs!.life='active';other.needs!.energy=16;other.needs!.hunger=10;other.needs!.thirst=10;other.x=p.x+30+other.id;other.z=p.z;delete other.garrisonId;delete other.duty;}
    delete q.order.building;delete p.building;q.order.type='hold';
    stepSelfPreservation(s,sim.terrain,sim.navigation,.05);
    expect(s.soldiers.filter(o=>o.squadId===q.id&&o.selfCare?.kind==='sleep').length).toBe(Math.ceil(q.soldierIds.length/4));
    delete p.selfCare;p.nextSelfCareReview=0;p.needs!.thirst=85;p.needs!.energy=16;p.carried!.water=0;
    stepSelfPreservation(s,sim.terrain,sim.navigation,.05);expect(s.soldiers.find(o=>o.id===p.id)!.selfCare?.kind).toBe('resupply');
    p.needs!.energy=11;p.selfCare!.stage='outbound';const before={x:p.x,z:p.z};
    for(let i=0;i<100;i++)tick(sim);
    expect(s.soldiers.find(o=>o.id===p.id)!.selfCare?.recovering).toBe(true);expect(p.action).toBe('sleeping');expect(p.needs!.energy).toBeGreaterThan(11);expect({x:p.x,z:p.z}).toEqual(before);
  });
});
