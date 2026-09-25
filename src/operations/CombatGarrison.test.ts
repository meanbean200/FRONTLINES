import { describe, expect, it } from 'vitest';
import { createOperation } from './createOperation';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';
import { SaveSystem } from '../persistence/SaveSystem';
import { inventory } from '../garrison/types';
import { balance } from '../garrison/Inventory';

function sleepingGarrison() {
  const state=createOperation('advance'),sim=new BattlefieldSimulation(state),squad=state.squads[0];
  state.operation!.casualtyRules=false; // Retain explicit old health-boundary fixtures.
  const trench={id:state.nextEntityId++,points:[{x:-2000,z:-2000},{x:-1900,z:-2000}],width:4.2,depth:1.75,progress:1,status:'complete' as const};
  state.trenches.push(trench);
  const people=state.soldiers.filter(s=>s.squadId===squad.id);
  people.forEach((s,i)=>{s.x=-1990+i*5;s.z=-2000;});
  squad.x=-1970;squad.z=-2000;
  expect(sim.assignGarrison([squad.id],trench.id)).toBe(true);
  const g=state.living!.garrisons[0];g.nextDecision=10000;g.nextSupport=10000;
  state.living!.campaignHours=23;
  for(const s of state.soldiers)s.nextShotAt=10000;
  for(const s of people){
    s.action='sleeping';s.needs!.energy=60;
    s.duty={kind:'sleep',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:500,reason:'Night rest',blockedFor:0,networkBound:true};
  }
  const enemy=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
  // A sleeping person below a trench lip is no longer visible through earth.
  // Put the intruder inside the corridor to test the actual-shot alarm path.
  enemy.x=-1989;enemy.z=-2000;enemy.nextShotAt=0;
  state.operation!.nextOrders=10000;
  return {state,sim,g,people,enemy};
}

describe('combat and living-garrison transitions',()=>{
  it.each([[70,'incapacitated'],[20,'dead']] as const)('releases duty reservations when a shot leaves a %i-health soldier %s',(health,life)=>{
    const {state,sim,people,enemy}=sleepingGarrison();
    for(const person of people)person.health=health;
    for(let i=0;i<200&&!people.some(s=>s.needs!.life===life);i++){
      state.elapsed+=.5;enemy.nextShotAt=0;
      sim.operations.step(.5,()=>{},()=>{});
    }
    const casualty=people.find(s=>s.needs!.life===life);
    expect(casualty).toBeDefined();
    expect(casualty!.duty).toBeUndefined();
    expect(casualty!.carried).toEqual(inventory());
    for(const value of Object.values(balance(state)))expect(Math.abs(value)).toBeLessThan(1e-6);
  });
  it('clears an older saved casualty reservation on the next simulation step',()=>{
    const {state,people}=sleepingGarrison(),person=people[0];
    person.health=0;person.needs!.life='dead';person.action='dead';
    const saved=JSON.stringify(state),restored=new BattlefieldSimulation(new SaveSystem().parse(saved));
    restored.step(.05);
    expect(restored.state.soldiers.find(s=>s.id===person.id)!.duty).toBeUndefined();
    expect(JSON.stringify(state)).toBe(saved);
    for(const value of Object.values(balance(restored.state)))expect(Math.abs(value)).toBeLessThan(1e-6);
  });
  it('wakes fit sleepers when fired on, without replacing the chosen readiness',()=>{
    const {state,sim,g,people}=sleepingGarrison();
    for(let i=0;i<60&&state.operation!.shots===0;i++)sim.step(.05);
    expect(state.operation!.shots).toBeGreaterThan(0);
    expect(g.underFireUntil).toBeGreaterThan(state.elapsed);
    sim.step(.05);
    expect(g.readiness).toBe('routine');
    expect(g.watchRequired).toBe(4);
    expect(people.some(s=>s.duty?.kind==='watch')).toBe(true);
    expect(people.reduce((n,s)=>n+s.needs!.interruptedSleep,0)).toBeGreaterThan(0);
    expect(people.every(s=>s.carried!==undefined)).toBe(true);
  });
  it('expires the temporary alert, preserves save continuation, and releases explicit player orders',()=>{
    const {state,sim,g,people,enemy}=sleepingGarrison();
    for(let i=0;i<60&&state.operation!.shots===0;i++)sim.step(.05);
    enemy.nextShotAt=10000;sim.step(.05);
    expect(g.underFireUntil).toBeGreaterThan(state.elapsed);
    for(const s of state.soldiers)s.nextShotAt=10000;
    const restored=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    for(let i=0;i<620;i++){sim.step(.05);restored.step(.05);}
    expect(restored.state).toEqual(state);
    expect(g.underFireUntil).toBeUndefined();expect(g.readiness).toBe('routine');expect(g.watchRequired).toBe(2);
    sim.issueHold([people[0].squadId]);
    expect(people.every(s=>s.garrisonId===g.id)).toBe(true);
    sim.issueMove([people[0].squadId],{x:people[0].x,z:people[0].z-20});
    expect(people.every(s=>s.garrisonId===undefined&&s.duty===undefined)).toBe(true);
  });
  it('does not wake a garrison without actual ammunition or overwrite an authorized withdrawal',()=>{
    const {state,sim,g,people,enemy}=sleepingGarrison();
    const ammo=enemy.carried!.ammo;state.living!.ledger.consumed.ammo+=ammo;enemy.carried=inventory();
    sim.step(.05);expect(g.underFireUntil).toBeUndefined();expect(people.every(s=>s.duty?.kind==='sleep')).toBe(true);
    sim.garrisons.resolveEmergency(g.id,'withdraw');
    enemy.carried.ammo=1;state.living!.ledger.initial.ammo++;
    state.operation!.nextCombat=0;
    for(let i=0;i<60&&state.operation!.shots===0;i++)sim.step(.05);
    expect(state.operation!.shots).toBeGreaterThan(0);
    expect(g.cutoff).toBe('withdraw');expect(g.underFireUntil).toBeUndefined();
  },15000);
  it('rejects malformed saved alert timers',()=>{
    const {state,g}=sleepingGarrison();g.underFireUntil=-1;
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow();
  });
  it('does not snap an aiming guard back to the selected front between combat ticks',()=>{
    const {sim,g,people,enemy}=sleepingGarrison(),guard=people[0];
    guard.duty!.kind='watch';guard.action='watching';guard.aimTargetId=enemy.id;guard.heading=0;g.front=Math.PI;
    (guard.combat??={shotSequence:0}).aim={targetId:enemy.id,since:sim.state.elapsed,lastSeen:sim.state.elapsed,point:{x:enemy.x,y:0,z:enemy.z},lastHeading:0,lastPosition:{x:guard.x,z:guard.z},settlingUntil:0};
    sim.garrisons.step(.05);expect(guard.heading).toBe(0);
    // A depleted/reloading weapon cannot pin a guard to an ancient target forever.
    sim.state.elapsed+=2.1;sim.garrisons.step(.05);expect(guard.aimTargetId).toBeUndefined();expect(guard.heading).toBe(Math.PI);
  });
  it('alarms sleepers when nearby unassigned troops exchange fire',()=>{
    const {state,sim,g,people,enemy}=sleepingGarrison();
    const target=state.soldiers.find(s=>s.squadId===state.squads[1].id)!;
    enemy.x=-1975;enemy.z=-1970; // Outside the trench: the lip shields the sleepers.
    target.x=enemy.x+4;target.z=enemy.z;target.nextShotAt=10000;
    for(let i=0;i<60&&state.operation!.shots===0;i++)sim.step(.05);
    expect(state.operation!.shots).toBeGreaterThan(0);expect(target.garrisonId).toBeUndefined();
    expect(enemy.aimTargetId).toBe(target.id);expect(g.underFireUntil).toBeGreaterThan(state.elapsed);
    sim.step(.05);expect(people.some(s=>s.duty?.kind==='watch')).toBe(true);
  });
});
