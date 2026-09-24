import {describe,expect,it,vi} from 'vitest';
import {distance,type SoldierState,type Vec2} from '../core/types';
import {createBattlefield} from '../simulation/createBattlefield';
import {freshNeeds} from './NeedsSystem';
import {firstAvailablePoint} from './DutyReservations';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import type {Garrison} from './types';

const template=createBattlefield().soldiers[0];
const person=(x:number,z:number,destination?:Vec2):SoldierState=>({...structuredClone(template),x,z,needs:freshNeeds(),duty:destination?{kind:'meal',destination,route:[],routeIndex:0,since:0,until:30,reason:'Reservation test',blockedFor:0}:undefined});
const reference=(points:Vec2[],self:SoldierState,people:SoldierState[],body:number,reservation:number)=>points.find(p=>!people.some(o=>o!==self&&o.needs?.life!=='dead'&&(distance(o,p)<body||o.duty&&distance(o.duty.destination,p)<reservation)));

describe('temporary service destination queries',()=>{
  it('respects candidate order, self exclusion, bodies and distant incoming reservations',()=>{
    const points=[{x:0,z:0},{x:3,z:0},{x:6,z:0}],self=person(6,0),body=person(0,0),incoming=person(4000,4000,points[1]);
    expect(firstAvailablePoint(points,self,[self,body,incoming],.8,1.1)).toBe(points[2]);
    body.needs!.life='dead';expect(firstAvailablePoint(points,self,[self,body,incoming],.8,1.1)).toBe(points[0]);
    body.needs!.life='incapacitated';expect(firstAvailablePoint(points,self,[self,body,incoming],.8,1.1)).toBe(points[2]);
  });
  it('reads movement and new, changed or deleted reservations on every query',()=>{
    const points=[{x:-4000,z:-4000},{x:-3997,z:-4000}],self=person(0,0),other=person(1000,1000,points[0]);
    expect(firstAvailablePoint(points,self,[other],.8,1.1)).toBe(points[1]);
    other.duty!.destination=points[1];expect(firstAvailablePoint(points,self,[other],.8,1.1)).toBe(points[0]);
    delete other.duty;other.x=-4000;other.z=-4000;expect(firstAvailablePoint(points,self,[other],.8,1.1)).toBe(points[1]);
    other.x=1000;expect(firstAvailablePoint(points,self,[other],.8,1.1)).toBe(points[0]);
    expect(firstAvailablePoint([],self,[other],.8,1.1)).toBeUndefined();
  });
  it('keeps strict distance thresholds at bounding edges',()=>{
    const points=[{x:0,z:0}],self=person(1000,1000);
    for(const x of [-.80000001,-.8,-.79999999,.79999999,.8,.80000001]){
      const people=[person(x,0)];expect(firstAvailablePoint(points,self,people,.8,1.1)).toBe(reference(points,self,people,.8,1.1));
    }
    for(const z of [-1.10000001,-1.1,-1.09999999,1.09999999,1.1,1.10000001]){
      const people=[person(3000,3000,{x:0,z})];expect(firstAvailablePoint(points,self,people,.8,1.1)).toBe(reference(points,self,people,.8,1.1));
    }
  });
  it('matches the original full scan across seeded crowded layouts',()=>{
    let seed=1944;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let sample=0;sample<100;sample++){
      const origin={x:random()*7000-3500,z:random()*7000-3500},points=Array.from({length:30},()=>({x:origin.x+random()*10,z:origin.z+random()*10})),self=person(0,0);
      const people=Array.from({length:180},(_,i)=>{const p=person(origin.x+random()*80-35,origin.z+random()*80-35,i%2?points[Math.floor(random()*points.length)]:undefined);if(i%13===0)p.needs!.life='dead';return p;});
      people.push(self);
      for(const [body,reservation] of [[.8,1.1],[1.1,1.1],[.8,1]])expect(firstAvailablePoint(points,self,people,body,reservation)).toBe(reference(points,self,people,body,reservation));
    }
  });
  it('does not repeat exact distance checks against distant camps for each candidate',()=>{
    const points=Array.from({length:20},(_,i)=>({x:i*3,z:0})),self=person(-2000,-2000),people=[...Array.from({length:1000},()=>person(2000,2000)),...points.map(p=>person(p.x,p.z))];
    const hypot=vi.spyOn(Math,'hypot');
    try{expect(firstAvailablePoint(points,self,people,.8,1.1)).toBeUndefined();expect(hypot.mock.calls.length).toBeLessThan(1000);}finally{hypot.mockRestore();}
  });
});

describe('forward truck pickup reservations',()=>{
  const setup=()=>{
    const sim=new BattlefieldSimulation(createBattlefield()),self=person(0,0);
    const g={forward:{x:0,z:0},entrance:{x:0,z:20}} as Garrison;
    const query=()=> (sim.garrisons as unknown as {forwardServicePoint(g:Garrison,s:SoldierState):Vec2|undefined}).forwardServicePoint(g,self);
    const points=Array.from({length:28},(_,i)=>({x:(i%7-3)*1.4,z:2+Math.floor(i/7)*1.4})).sort((a,b)=>distance(self,a)-distance(self,b));
    return {sim,self,g,query,points};
  };
  it('retains nearest-first order, terrain exclusions and reservations from far away',()=>{
    const {sim,self,query,points}=setup();
    const obstacle=vi.spyOn(sim.terrain,'obstacleAt').mockImplementation(x=>x<0),ground=vi.spyOn(sim.terrain,'groundTypeAt').mockImplementation((_x,z)=>z<3?'river':'field');
    sim.state.soldiers=[self,person(4000,4000,{x:0,z:3.4}),person(1.4,3.4)];
    const referencePoint=points.find(p=>!sim.terrain.obstacleAt(p.x,p.z,.5)&&sim.terrain.groundTypeAt(p.x,p.z)!=='river'&&reference([p],self,sim.state.soldiers,.8,1));
    expect(query()).toEqual(referencePoint);expect(referencePoint).toBeDefined();
    sim.state.soldiers[1].duty!.destination={x:4000,z:4000};
    expect(query()).toEqual({x:0,z:3.4});obstacle.mockRestore();ground.mockRestore();
  });
  it('does not rescan distant camps with exact distances for every occupied pickup berth',()=>{
    const {sim,query,points}=setup();
    const obstacle=vi.spyOn(sim.terrain,'obstacleAt').mockReturnValue(false),ground=vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');
    sim.state.soldiers=[...Array.from({length:1000},()=>person(3000,3000)),...points.map(p=>person(p.x,p.z))];
    const hypot=vi.spyOn(Math,'hypot');
    try{expect(query()).toBeUndefined();expect(hypot.mock.calls.length).toBeLessThan(2000);}finally{hypot.mockRestore();obstacle.mockRestore();ground.mockRestore();}
  });
});
