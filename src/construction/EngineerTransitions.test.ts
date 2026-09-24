import {describe,it,expect,vi} from 'vitest';
import {addSquad,createBattlefield} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {distance,type TrenchState} from '../core/types';
import {updateNeeds,NEED_RULES,CAMPAIGN_HOURS_PER_SECOND} from '../garrison/NeedsSystem';
import {SaveSystem} from '../persistence/SaveSystem';

function fixture(){
  const state=createBattlefield(),q=state.squads.find(q=>q.kind==='engineer')!;
  state.squads=[q];state.soldiers=state.soldiers.filter(s=>s.squadId===q.id);state.trenches=[];state.craters=[];
  q.x=-1837;q.z=-1702;state.soldiers.forEach((s,i)=>{s.x=q.x+(i%4-1.5);s.z=q.z+Math.floor(i/4);});
  return {state,q,sim:new BattlefieldSimulation(state)};
}
describe('engineer interruptions and partial networks',()=>{
  it('resumes the closest unfinished face, including a left-hand face',()=>{
    const {state,q,sim}=fixture();
    const main:TrenchState={id:state.nextEntityId++,points:[{x:-1880,z:-1700},{x:-1720,z:-1700}],progress:.5,status:'planned',width:4.2,depth:1.75,engineerSquadId:q.id,excavation:{start:40,end:120,origin:80}};
    state.trenches.push(main);
    const farther=sim.createTrench([{x:-1860,z:-1735},{x:-1820,z:-1735}])!;
    expect(sim.resumeConstruction([q.id])).toBe(1);expect(q.order.trenchId).toBe(main.id);
    expect(q.order.trenchId).not.toBe(farther);expect(distance(q.route.at(-1)!,{x:-1840,z:-1700})).toBeLessThan(.01);
  });
  it('charges travel exertion while engineers approach or change working faces',()=>{
    const {state}=fixture(),s=state.soldiers[0];
    for(const action of ['moving to work front','moving along work front']){
      s.action=action;s.needs!.energy=100;updateNeeds(state,s,1);
      expect(s.needs!.energy).toBeCloseTo(100-NEED_RULES.travelLossPerHour*CAMPAIGN_HOURS_PER_SECOND,10);
    }
  });
  it('tries another reachable job when the nearest faces have no valid route',()=>{
    const {state,q,sim}=fixture();
    const first=sim.createTrench([{x:-1850,z:-1700},{x:-1810,z:-1700}])!;
    const second=sim.createTrench([{x:-1850,z:-1740},{x:-1810,z:-1740}])!;
    const plan=sim.navigation.plan.bind(sim.navigation);
    vi.spyOn(sim.navigation,'plan').mockImplementation((from,to)=>to.z===-1700?[]:plan(from,to));
    expect(sim.resumeConstruction([q.id])).toBe(1);expect(q.order.trenchId).toBe(second);
    expect(state.trenches.find(t=>t.id===first)!.progress).toBe(0);
  });
  it('does not treat a completed end as an available work face',()=>{
    const {state,q,sim}=fixture();
    const t:TrenchState={id:state.nextEntityId++,points:[{x:-1840,z:-1700},{x:-1640,z:-1700}],progress:.75,status:'planned',width:4.2,depth:1.75,excavation:{start:0,end:150,origin:100}};
    state.trenches.push(t);expect(sim.engineers.workFaces(t,q)).toEqual([{x:-1690,z:-1700}]);
    expect(sim.resumeConstruction([q.id])).toBe(1);expect(q.route.at(-1)).toEqual({x:-1690,z:-1700});
  });
  it('assigns a middle-dug network without moving the entrance into unfinished ground',()=>{
    const {state,q,sim}=fixture();
    q.z=-1690;state.soldiers.forEach(s=>s.z=-1690);
    const t:TrenchState={id:state.nextEntityId++,points:[{x:-1880,z:-1700},{x:-1720,z:-1700}],progress:.5,status:'planned',width:4.2,depth:1.75,excavation:{start:40,end:120,origin:80}};state.trenches.push(t);
    expect(sim.assignGarrison([q.id],t.id)).toBe(true);sim.step(.05);
    const g=state.living!.garrisons[0];g.nextSupport=10000;
    expect(g.entrance).toEqual({x:-1800,z:-1700});
    expect(state.soldiers.every(s=>s.duty?.entryPoint&&s.duty.entryPoint.x>=-1840&&s.duty.entryPoint.x<=-1760)).toBe(true);
    const loaded=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    for(let i=0;i<500;i++){sim.step(.05);loaded.step(.05);}
    expect(loaded.state).toEqual(state);expect(sim.garrisons.network.corridorContains(state.soldiers[0])).toBe(true);
  });
  it('keeps infantry travel continuous as engineers expand an occupied partial network',()=>{
    const {state,q,sim}=fixture();
    const trench=sim.createTrench([{x:-1880,z:-1700},{x:-1720,z:-1700}],q.id)!;
    for(let i=0;i<1100;i++)sim.step(.05);
    const rifle=addSquad(state,'rifle',4,-1800,-1690,'Test entry'),people=state.soldiers.filter(s=>s.squadId===rifle.id);
    expect(sim.assignGarrison([rifle.id],trench)).toBe(true);sim.step(.05);
    state.living!.garrisons[0].nextSupport=10000;
    const loaded=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    for(let i=0;i<600;i++){
      const positions=people.map(s=>({x:s.x,z:s.z}));sim.step(.05);loaded.step(.05);
      people.forEach((s,j)=>expect(distance(s,positions[j])).toBeLessThan(.2));
    }
    expect(loaded.state).toEqual(state);expect(people.every(s=>sim.garrisons.network.corridorContains(s))).toBe(true);
    expect(state.trenches[0].progress).toBeGreaterThan(.6);
  });
});
