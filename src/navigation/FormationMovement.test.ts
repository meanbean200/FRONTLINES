import {describe,it,expect} from 'vitest';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {createBattlefield,addSquad} from '../simulation/createBattlefield';
import {distance} from '../core/types';
import {SaveSystem} from '../persistence/SaveSystem';

export function formationFixture(count:number,start={x:-1220,z:-1390}){
  const state=createBattlefield();state.soldiers=[];state.squads=[];state.trenches=[];state.craters=[];
  for(let i=0;i<count;i++)addSquad(state,'rifle',8,start.x-Math.floor(i/3)*20,start.z+(i%3-1)*24,`Test ${i+1}`);
  return new BattlefieldSimulation(state);
}
describe('formation-scale movement',()=>{
  for(const count of [1,3,5])it(`${count} squads clear the village without stranded followers`,()=>{
    const sim=formationFixture(count),goal={x:-930,z:-1390};
    sim.issueMove(sim.state.squads.map(q=>q.id),goal);
    const targets=new Map(sim.state.squads.map(q=>[q.id,{...q.order.target!}]));
    for(let i=0;i<9000&&sim.state.squads.some(q=>q.order.type==='move');i++)sim.step(.05);
    const stranded=sim.state.soldiers.filter(s=>distance(s,targets.get(s.squadId)!)>18);
    expect(stranded.map(s=>({id:s.id,x:s.x,z:s.z,action:s.action}))).toEqual([]);
    expect(sim.state.squads.every(q=>q.order.type==='hold')).toBe(true);
  },20000);
  for(const count of [1,3,5])for(const z of [-1660,-1150])it(`${count} squads clear trees at z=${z}`,()=>{
    const sim=formationFixture(count,{x:-1800,z}),goal={x:-1470,z};sim.issueMove(sim.state.squads.map(q=>q.id),goal);
    const targets=new Map(sim.state.squads.map(q=>[q.id,{...q.order.target!}]));
    for(let i=0;i<7000&&sim.state.squads.some(q=>q.order.type==='move');i++)sim.step(.05);
    expect(sim.state.soldiers.filter(s=>distance(s,targets.get(s.squadId)!)>18).map(s=>({id:s.id,x:s.x,z:s.z,action:s.action,travel:s.formationTravel,near:sim.state.soldiers.filter(p=>p!==s&&distance(p,s)<4).map(p=>({id:p.id,x:p.x,z:p.z})),tree:sim.terrain.objects.trunkAt(s.x,s.z,2)}))).toEqual([]);
    expect(sim.state.squads.every(q=>q.order.type==='hold')).toBe(true);
  },20000);
  it('saves personal progress through a village corner exactly and resumes interruptions',()=>{
    const sim=formationFixture(3);sim.issueMove(sim.state.squads.map(q=>q.id),{x:-930,z:-1390});
    for(let i=0;i<350;i++)sim.step(.05);
    const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    for(let i=0;i<20;i++){sim.step(.05);copy.step(.05);}expect(copy.state).toEqual(sim.state);
    const q=sim.state.squads[0],order=structuredClone(q.order),p=sim.state.soldiers[0];
    p.combat??={shotSequence:0};p.combat.reaction='pinned';p.combat.reactionUntil=sim.state.elapsed+6;p.suppression=90;
    for(let i=0;i<40;i++)sim.step(.05);expect(q.order).toEqual(order);
    p.suppression=0;p.combat.reactionUntil=0;
    for(let i=0;i<7000&&sim.state.squads.some(q=>q.order.type==='move');i++)sim.step(.05);
    expect(sim.state.squads.every(q=>q.order.type==='hold')).toBe(true);
  },20000);
  it('two opposing friendly groups pass each other and retain separate destinations',()=>{
    const sim=formationFixture(3,{x:-1200,z:-1390}),state=sim.state;
    for(let i=0;i<3;i++)addSquad(state,'rifle',8,-940,-1390+i*12,`Opposite ${i}`);
    sim.issueMove(state.squads.slice(0,3).map(q=>q.id),{x:-940,z:-1390});
    sim.issueMove(state.squads.slice(3).map(q=>q.id),{x:-1200,z:-1390});
    for(let i=0;i<9000&&state.squads.some(q=>q.order.type==='move');i++)sim.step(.05);
    expect(state.squads.filter(q=>q.order.type==='move').map(q=>q.name)).toEqual([]);
  },20000);
  it('five squads queue through a four-metre shared gap without entering the walls',()=>{
    const sim=formationFixture(5,{x:-1840,z:-1700});
    sim.terrain.buildings=[-1742,-1658].map(z=>({x:-1720,z,width:120,depth:80,height:6,angle:0}));
    sim.issueMove(sim.state.squads.map(q=>q.id),{x:-1570,z:-1700});
    // An explicit common bottleneck isolates individual passage behavior from
    // high-level route choice. Arrival goals retain the ordinary squad offsets.
    for(const q of sim.state.squads)q.route=[{x:-1800,z:-1700},{x:-1640,z:-1700},{...q.order.target!}];
    const passed=new Set<number>();
    for(let i=0;i<9000&&sim.state.squads.some(q=>q.order.type==='move');i++){
      sim.step(.05);
      for(const s of sim.state.soldiers){expect(sim.terrain.obstacleAt(s.x,s.z,.5)).toBe(false);if(s.x>-1780&&s.x<-1660){expect(Math.abs(s.z+1700)).toBeLessThan(1.5);passed.add(s.id);}}
    }
    expect(passed.size).toBe(40);expect(sim.state.squads.every(q=>q.order.type==='hold')).toBe(true);
  },20000);
});
