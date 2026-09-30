import {describe,it,expect,vi} from 'vitest';
import {createOperation} from './createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {bankPoint} from '../garrison/DefensivePositions';
import {updateContacts,visibilitySignal,playerVisibleEnemies,diagnoseObservation} from './Visibility';
import {SaveSystem} from '../persistence/SaveSystem';

/** Real completed earth/LOS; flat, treeless daylight is the controlled variable.
 * This reproduces a bounded-scan failure, not the unavailable player save. */
function gap(){
  const state=createOperation('advance'),sim=new BattlefieldSimulation(state),terrain=sim.terrain;
  const squads=state.squads.filter(q=>q.faction!=='enemy').slice(0,2),guards=[];
  for(const s of state.soldiers){s.x=-1800;s.z=-1800;s.nextShotAt=1e9;}
  state.trenches=[];state.living!.facilities=[];terrain.buildings=[];
  vi.spyOn(terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(terrain.objects,'trees').mockReturnValue([]);
  state.living!.campaignHours=12;
  for(const [index,q] of squads.entries()){
    const sign=index?1:-1;
    const trench={id:state.nextEntityId++,points:[{x:sign*220,z:0},{x:sign*60,z:0}],width:4.2,depth:1.75,progress:1,status:'complete' as const};state.trenches.push(trench);
    sim.garrisons.network.sync(state.trenches);
    const people=state.soldiers.filter(s=>s.squadId===q.id);
    for(const [i,s] of people.entries()){
      s.x=sign*(65+i*3);s.z=0;s.heading=0;s.action='resting';s.posture='standing';s.suppression=0;s.needs!.energy=100;
      s.duty={kind:'rest',since:0,until:100,arrivedAt:0,route:[],routeIndex:0,blockedFor:0,destination:{x:s.x,z:s.z},reason:'Protected reserve'};
    }
    const guard=people[6];Object.assign(guard,bankPoint(sim.garrisons.network,{x:sign*110,z:0},0),{action:'watching'});guard.duty!.kind='watch';guard.duty!.destination={x:guard.x,z:guard.z};guards.push(guard);
    const duties=people.map(s=>structuredClone(s.duty!));
    expect(sim.garrisons.assign([q.id],trench.id)).toBe(true);
    people.forEach((s,i)=>s.duty=duties[i]);
  }
  terrain.syncModifications();const target=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
  Object.assign(target,{x:0,z:320,action:'following drawn path',heading:Math.PI,posture:'standing'});delete target.duty;
  const scan=()=>{state.elapsed+=.5;target.z-=.5;updateContacts(state,terrain,target.id%10);};
  return {state,sim,terrain,guards,target,scan};
}

describe('staffed trench observation across an open gap',()=>{
  it('accumulates a legitimate distant guard observation instead of losing it between bounded scans',()=>{
    const {state,terrain,guards,target,scan}=gap();
    for(const guard of guards){const signal=visibilitySignal(state,terrain,guard,target);expect(signal).toBeGreaterThan(.24);expect(signal).toBeLessThan(.62);}
    for(let i=0;i<16;i++)scan();
    expect(playerVisibleEnemies(state).has(target.id)).toBe(true);
    expect(state.operation!.contacts!.player.find(c=>c.soldierId===target.id)?.z).toBe(target.z);
  });
  it.each(['night','smoke','ridge','building','pinned','uncovered'] as const)('keeps %s masking meaningful and explains it without adding a contact',condition=>{
    const {state,terrain,guards,target,scan}=gap();
    if(condition==='night')state.living!.campaignHours=23;
    if(condition==='smoke')state.operation!.smokeFields=[{id:state.nextEntityId++,x:0,z:160,radius:95,born:0,until:60}];
    if(condition==='ridge')vi.mocked(terrain.baseHeightAt).mockImplementation((_x,z)=>z>140&&z<170?15:0);
    if(condition==='building')terrain.buildings=[{x:0,z:150,width:300,depth:20,height:8,angle:0}];
    if(condition==='pinned')for(const s of guards){s.suppression=95;s.posture='prone';s.combat={shotSequence:0,reaction:'pinned'};}
    if(condition==='uncovered')for(const s of guards)s.heading=Math.PI;
    terrain.revision++;
    for(let i=0;i<16;i++)scan();
    expect(playerVisibleEnemies(state).has(target.id)).toBe(false);
    const before=JSON.stringify(state.operation!.intelligence),why=diagnoseObservation(state,terrain,guards[0],target);
    expect(why.signal).toBeLessThan(.24);expect(why.reason).toMatch(/Night|Smoke|Terrain|Building|suppressed|exhausted|sector/);
    expect(JSON.stringify(state.operation!.intelligence)).toBe(before);
  });
  it('exhaustion slows recognition rather than making a soldier arbitrarily blind',()=>{
    const ready=gap(),tired=gap();for(const s of tired.guards)s.needs!.energy=0;
    const signal=visibilitySignal(tired.state,tired.terrain,tired.guards[0],tired.target),rested=visibilitySignal(ready.state,ready.terrain,ready.guards[0],ready.target);
    expect(signal).toBeLessThan(rested*.6);
    let firstReady=0,firstTired=0;
    for(let i=0;i<16;i++){ready.scan();tired.scan();if(!firstReady&&playerVisibleEnemies(ready.state).has(ready.target.id))firstReady=ready.state.elapsed;if(!firstTired&&playerVisibleEnemies(tired.state).has(tired.target.id))firstTired=tired.state.elapsed;}
    expect(firstTired).toBeGreaterThan(firstReady);
  });
  it('preserves partial recognition and its actual observer across a save',()=>{
    const {state,terrain,target,scan}=gap();scan();
    const original=state.operation!.intelligence!,progress=original.squads.flatMap(q=>q.exposure).filter(e=>e.soldierId===target.id);
    expect(progress.some(p=>p.exposure>0&&p.exposure<.6&&p.observerId!==undefined)).toBe(true);
    const copy=new SaveSystem().parse(JSON.stringify(state));
    expect(copy.operation!.intelligence).toEqual(original);
    for(let i=0;i<8;i++){
      state.elapsed+=.5;copy.elapsed+=.5;
      updateContacts(state,terrain,target.id%10);updateContacts(copy,terrain,target.id%10);
      expect(copy.operation!.intelligence).toEqual(state.operation!.intelligence);
    }
  });
});
