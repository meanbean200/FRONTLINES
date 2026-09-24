import {describe,it,expect} from 'vitest';
import {bankPoint,defensivePost} from './DefensivePositions';
import {TrenchNetwork} from './TrenchNetwork';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {createPlayableSandbox} from '../simulation/createBattlefield';
import {createOperation} from '../operations/createOperation';
import {distance} from '../core/types';
describe('front-oriented defensive posts',()=>{
  it('uses the same facing bank when a trench is drawn in reverse',()=>{
    const network=new TrenchNetwork(),t={id:1,points:[{x:0,z:0},{x:0,z:100}],width:7.2,depth:1.75,progress:1,status:'complete' as const};network.sync([t]);const east=bankPoint(network,{x:0,z:50},Math.PI/2);network.sync([{...t,points:[...t.points].reverse()}]);expect(bankPoint(network,{x:0,z:50},Math.PI/2)).toEqual(east);expect(east.x).toBeGreaterThan(0);expect(bankPoint(network,{x:0,z:50},-Math.PI/2).x).toBeLessThan(0);
  });
  it('still finds a post when every available corridor runs along the requested front',()=>{
    const state=createPlayableSandbox();state.trenches=[{id:state.nextEntityId++,points:[{x:-2000,z:-2200},{x:-2000,z:-1900}],width:7.2,depth:1.75,progress:1,status:'complete'}];const sim=new BattlefieldSimulation(state),s=state.soldiers[0];s.x=-2000;s.z=-2090;const network=sim.garrisons.network;expect(defensivePost(network,sim.terrain,network.component(state.trenches[0].id)!,0,s,[s],state.trenches[0].points[0],[])).toBeDefined();
  });
  it('disperses campaign guards, keeps their posts stable, and walks to a changed front',()=>{
    const sim=new BattlefieldSimulation(createOperation('campaign')),g=sim.state.living!.garrisons[0];g.nextSupport=10000;sim.step(.05);sim.step(.5);
    const guards=sim.garrisons.people(g).filter(s=>s.duty?.kind==='watch');expect(guards.length).toBe(12);
    for(const a of guards)for(const b of guards)if(a!==b)expect(distance(a.duty!.destination,b.duty!.destination)).toBeGreaterThan(1.2);
    const before=guards.map(s=>({id:s.id,x:s.x,z:s.z,post:{...s.duty!.destination}}));sim.garrisons.setFront(g.id,-Math.PI/2);
    expect(guards.map(s=>({id:s.id,x:s.x,z:s.z}))).toEqual(before.map(({id,x,z})=>({id,x,z})));expect(guards.every(s=>!s.duty)).toBe(true);
    sim.step(.05);expect(sim.garrisons.people(g).some(s=>s.duty?.kind==='watch'&&s.duty.arrivedAt===undefined)).toBe(true);
  });
});
