import {describe,it,expect} from 'vitest';
import {createBattlefield,addSquad} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {waitingSpace} from './WaitingSpace';
import {distance} from '../core/types';
import {createStudyScenario} from './StudyScenario';
import {SaveSystem} from '../persistence/SaveSystem';

function fixture(){
  const state=createBattlefield(1944);state.soldiers=[];state.squads=[];state.craters=[];
  for(let i=0;i<12;i++)addSquad(state,'rifle',8,-1940,-1700,`Reserve ${i}`);
  const junction={x:-1800,z:-1740},entrance={x:-1870,z:-1740},facility={x:-1800,z:-1680};
  state.trenches=[{id:state.nextEntityId++,points:[entrance,{x:-1730,z:-1740}],width:8,depth:1.75,progress:1,status:'complete'},
    {id:state.nextEntityId++,points:[junction,{x:-1800,z:-1660}],width:8,depth:1.75,progress:1,status:'complete'}];
  const sim=new BattlefieldSimulation(state),network=sim.garrisons.network,component=network.component(state.trenches[0].id)!;
  return {state,sim,network,component,junction,entrance,facility};
}
describe('temporary trench waiting space',()=>{
  it('physically clears a 96-person resting pile from a real junction and keeps floor reservations distinct',()=>{
    const sim=createStudyScenario(1944,2,96),state=sim.state,g=state.living!.garrisons[0],junction=state.trenches[1].points[0];g.nextSupport=1e9;
    for(const p of state.soldiers){p.x=junction.x;p.z=junction.z;p.needs!.energy=35;p.needs!.hunger=p.needs!.thirst=10;delete p.duty;}
    sim.step(.05);
    const destinations=state.soldiers.map(p=>p.duty!.destination);
    expect(destinations).toHaveLength(96);
    for(const [i,p] of destinations.entries()){
      expect(distance(p,junction)).toBeGreaterThanOrEqual(3);
      for(const other of destinations.slice(0,i))expect(distance(p,other)).toBeGreaterThanOrEqual(1.1);
    }
    const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    for(let tick=0;tick<2600;tick++){sim.step(.05);copy.step(.05);}
    expect(JSON.parse(JSON.stringify(copy.state))).toEqual(JSON.parse(JSON.stringify(state)));
    expect(state.soldiers.every(p=>p.duty?.kind==='sleep'&&p.duty.arrivedAt!==undefined&&p.duty.facilityId===undefined)).toBe(true);
    for(const p of state.soldiers)expect(distance(p,junction)).toBeGreaterThan(3);
  },20000);
  it('spreads 96 reservations into usable width instead of recycling crowded coarse samples',()=>{
    const {state,sim,network,component,junction,entrance,facility}=fixture(),destinations=[];
    for(const person of state.soldiers){
      const p=waitingSpace(network,sim.terrain,component,0,person,state.soldiers,entrance,[facility]);expect(p).toBeDefined();
      expect(network.corridorContains(p!)).toBe(true);expect(distance(p!,junction)).toBeGreaterThanOrEqual(3);expect(distance(p!,entrance)).toBeGreaterThanOrEqual(3);expect(distance(p!,facility)).toBeGreaterThanOrEqual(3);
      for(const old of destinations)expect(distance(old,p!)).toBeGreaterThanOrEqual(1.1);
      destinations.push(p!);person.duty={kind:'rest',destination:p!,route:[],routeIndex:0,since:0,until:30,reason:'Waiting-space reservation fixture',blockedFor:0};
      expect(person.duty.facilityId).toBeUndefined();
    }
    expect(destinations.length).toBe(96);
  });
  it('reports no floor instead of assigning an occupied entrance or junction',()=>{
    const {state,sim,network,component,entrance}=fixture(),person=state.soldiers[0];
    // Real exclusions exhaust every sample, without replacing geometry queries.
    const excluded=network.samples(component,1).flatMap(p=>[-3,0,3].flatMap(dx=>[-3,0,3].map(dz=>({x:p.x+dx,z:p.z+dz}))));
    expect(waitingSpace(network,sim.terrain,component,0,person,state.soldiers,entrance,excluded)).toBeUndefined();
  });
  it('does not select footprint interiors even in a malformed legacy trench',()=>{
    const {state,sim,network}=fixture(),b=sim.terrain.buildings[0];
    state.trenches=[{id:state.nextEntityId++,points:[{x:b.x-b.width/2+1,z:b.z},{x:b.x+b.width/2-1,z:b.z}],width:2.2,depth:1.75,progress:1,status:'complete'}];network.sync(state.trenches);
    expect(waitingSpace(network,sim.terrain,network.component(state.trenches[0].id)!,0,state.soldiers[0],state.soldiers,{x:b.x-30,z:b.z},[])).toBeUndefined();
  });
});
