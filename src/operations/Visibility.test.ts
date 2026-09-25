import {describe,expect,it,vi} from 'vitest';
import {createOperation} from './createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {canSpot,observedEnemySquad,playerVisibleEnemies,squadContacts,updateContacts,visibilitySignal,SIGHT_RULES} from './Visibility';
import {UnitRenderer} from '../render/UnitRenderer';
import {LivingRenderer} from '../render/LivingRenderer';
import {dropCargo} from '../garrison/NeedsSystem';
import {inventory} from '../garrison/types';
import * as THREE from 'three';

function fixture(){
  const state=createOperation('advance'),sim=new BattlefieldSimulation(state),observer=state.soldiers[0],target=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
  for(const s of state.soldiers){s.x=state.squads.find(q=>q.id===s.squadId)?.faction==='enemy'?1800:-1800;s.z=1800;s.nextShotAt=10000;}
  Object.assign(observer,{x:0,z:0,heading:Math.PI/2});Object.assign(target,{x:150,z:0,heading:-Math.PI/2});
  state.living!.campaignHours=12;state.operation!.nextOrders=10000;
  vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);
  vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(sim.terrain,'coverAt').mockReturnValue('open');vi.spyOn(sim.terrain,'obstacleAt').mockReturnValue(false);
  sim.terrain.buildings=[];vi.spyOn(sim.terrain.objects,'trees').mockReturnValue([]);
  return {state,sim,observer,target};
}
describe('human sight and remembered contacts',()=>{
  it('reduces sight at night, while exhausted, behind the observer, or asleep',()=>{
    const {state,sim,observer,target}=fixture();expect(canSpot(state,sim.terrain,observer,target)).toBe(true);
    state.living!.campaignHours=23;expect(canSpot(state,sim.terrain,observer,target)).toBe(false);
    state.living!.campaignHours=12;const rested=visibilitySignal(state,sim.terrain,observer,target);observer.needs!.energy=0;expect(visibilitySignal(state,sim.terrain,observer,target)).toBeLessThan(rested);
    observer.needs!.energy=100;observer.heading=-Math.PI/2;expect(canSpot(state,sim.terrain,observer,target)).toBe(false);
    target.x=20;expect(canSpot(state,sim.terrain,observer,target)).toBe(true);
    observer.action='sleeping';expect(canSpot(state,sim.terrain,observer,target)).toBe(false);
  });
  it('blocks observation through buildings, intervening ridges and dense woods',()=>{
    const {state,sim,observer,target}=fixture();
    sim.terrain.buildings=[{x:70,z:0,width:20,depth:20,height:8,angle:0}];
    expect(canSpot(state,sim.terrain,observer,target)).toBe(false);
    sim.terrain.buildings=[];
    sim.terrain.revision++;
    vi.mocked(sim.terrain.heightAt).mockImplementation((x)=>x>60&&x<80?10:0);
    expect(canSpot(state,sim.terrain,observer,target)).toBe(false);
    vi.mocked(sim.terrain.heightAt).mockReturnValue(0);vi.mocked(sim.terrain.groundTypeAt).mockReturnValue('forest');sim.terrain.revision++;
    expect(canSpot(state,sim.terrain,observer,target)).toBe(false);
  });
  it('keeps a lost contact at its last seen position, then forgets it',()=>{
    const {state,sim,target}=fixture();updateContacts(state,sim.terrain);
    expect(playerVisibleEnemies(state).has(target.id)).toBe(true);
    const seen=observedEnemySquad(state,target.squadId)!;expect(seen.x).toBe(150);
    target.x=600;state.elapsed=1;updateContacts(state,sim.terrain);
    expect(playerVisibleEnemies(state).has(target.id)).toBe(false);
    const lost=observedEnemySquad(state,target.squadId)!;expect(lost.x).toBe(150);expect(lost.visible).toBe(false);
    state.elapsed=19;updateContacts(state,sim.terrain);expect(observedEnemySquad(state,target.squadId)).toBeUndefined();
  });
  it('does not render hidden enemy bodies or legs',()=>{
    const {state,sim,target}=fixture(),render=new UnitRenderer(state,sim.terrain),selection=new Set<number>();
    render.update(selection);const hidden=render.group.children.map(o=>(o as unknown as {count:number}).count);
    expect(hidden[2]).toBe(0);expect(hidden[3]).toBe(48*2);expect(hidden[5]+hidden[9]+hidden[10]+hidden[11]).toBe(48);expect(hidden[6]).toBe(0);
    updateContacts(state,sim.terrain);render.update(selection);
    expect((render.group.children[2] as unknown as {count:number}).count).toBe(1);
    // A flash in an open field may remain tracked briefly; use actual loss of
    // sight (beyond the search bound) to verify hidden geometry is not drawn.
    target.x=900;target.lastShotAt=.9;state.elapsed=1;updateContacts(state,sim.terrain);render.update(selection);
    expect((render.group.children[2] as unknown as {count:number}).count).toBe(0);
    expect([5,10,11,12].reduce((n,i)=>n+(render.group.children[i] as unknown as {count:number}).count,0)).toBe(48);
    expect((render.group.children[6] as unknown as {count:number}).count).toBe(0);
  });
  it('persists observations and aim timing, validates them, and accepts older saves',()=>{
    const {state,sim,observer,target}=fixture();updateContacts(state,sim.terrain);observer.aimTargetId=target.id;observer.aimReadyAt=1.5;
    const saves=new SaveSystem();expect(saves.parse(JSON.stringify(state))).toEqual(state);
    state.operation!.contacts!.player[0].lastSeen=100;expect(()=>saves.parse(JSON.stringify(state))).toThrow();
    delete state.operation!.contacts;delete observer.aimTargetId;delete observer.aimReadyAt;
    expect(()=>saves.parse(JSON.stringify(state))).not.toThrow();
  });
  it('does not reveal hidden carriers or casualty packs, including older untagged drops',()=>{
    const {state,sim,observer,target}=fixture(),w=state.living!;
    w.trucks=[];w.garrisons=[];w.facilities=[];w.crates=[];w.rearStock=inventory();
    const render=new LivingRenderer(()=>state,sim.terrain),boxes=render.group.children[0] as THREE.InstancedMesh;
    target.duty={kind:'haul',destination:{x:target.x,z:target.z},route:[{x:target.x+10,z:target.z}],routeIndex:0,since:0,until:120,reason:'Visibility fixture',blockedFor:0};
    render.update(100,true);expect(boxes.count).toBe(0);
    expect((render.group.children[1] as THREE.LineSegments).geometry.attributes.position.count).toBe(0);
    updateContacts(state,sim.terrain);render.update(200,true);expect(boxes.count).toBe(1);
    target.health=0;target.needs!.life='dead';delete target.duty;dropCargo(state,target);
    expect(w.crates[0].droppedBy).toBe(target.id);
    render.update(300,false);expect(boxes.count).toBe(1);
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();boxes.getMatrixAt(0,m);m.decompose(p,q,scale);
    expect(scale.y).toBeLessThan(.3);expect(Math.hypot(p.x-target.x,p.z-target.z)).toBeGreaterThan(.6);
    observer.x=-3000;state.elapsed=1;updateContacts(state,sim.terrain);render.update(400,false);expect(boxes.count).toBe(0);
    delete w.crates[0].droppedBy;render.update(500,false);expect(boxes.count).toBe(0);
  });
  it('validates drop ownership while accepting old untagged cargo',()=>{
    const {state,target}=fixture();dropCargo(state,target);const drop=state.living!.crates.at(-1)!;
    const save=new SaveSystem();expect(()=>save.parse(JSON.stringify(state))).not.toThrow();
    drop.droppedBy=999999;expect(()=>save.parse(JSON.stringify(state))).toThrow();
    delete drop.droppedBy;expect(()=>save.parse(JSON.stringify(state))).not.toThrow();
  });
  it('keeps a recognized soldier in clear open ground through a brief weak signal, without improving fire control',()=>{
    const {state,sim,observer,target}=fixture();updateContacts(state,sim.terrain);
    const known=()=>squadContacts(state,observer.squadId).find(c=>c.soldierId===target.id)!;
    expect(known()).toMatchObject({observerId:observer.id,trackedUntil:SIGHT_RULES.trackingSeconds});
    target.x=450;
    expect(canSpot(state,sim.terrain,observer,target)).toBe(false);
    for(let t=.5;t<6;t+=.5){
      state.elapsed=t;updateContacts(state,sim.terrain,target.id%10);
      expect(known()).toMatchObject({visible:true,x:450,trackedUntil:6,lastSeen:t});
    }
    state.elapsed=6;target.x=460;updateContacts(state,sim.terrain,target.id%10);
    expect(known()).toMatchObject({visible:false,x:450,lastSeen:5.5});
    state.elapsed=7;updateContacts(state,sim.terrain,target.id%10);
    expect(known().visible).toBe(false); // Weak tracking never refreshes its own deadline.
  });
  it('does not acquire an unknown enemy from the weaker tracking signal',()=>{
    const {state,sim,observer,target}=fixture();target.x=450;
    for(let t=0;t<=8;t+=.5){state.elapsed=t;updateContacts(state,sim.terrain);}
    expect(squadContacts(state,observer.squadId)).toEqual([]);
    expect(playerVisibleEnemies(state).has(target.id)).toBe(false);
  });
  it('refreshes the tracking window only after clear recognition returns',()=>{
    const {state,sim,observer,target}=fixture();updateContacts(state,sim.terrain);
    target.x=450;state.elapsed=4;updateContacts(state,sim.terrain);
    target.x=150;state.elapsed=5;updateContacts(state,sim.terrain);
    target.x=450;state.elapsed=7;updateContacts(state,sim.terrain);
    expect(squadContacts(state,observer.squadId).find(c=>c.soldierId===target.id)).toMatchObject({visible:true,trackedUntil:11});
  });
  it('retains the actual observer when the distant-squad sweep rotates away from them',()=>{
    const {state,sim,observer,target}=fixture();
    const scouts=state.soldiers.filter(s=>s.squadId===observer.squadId).slice(0,4);
    scouts.forEach((s,i)=>Object.assign(s,{x:i,z:0,heading:Math.PI/2}));
    const selected=scouts[1];
    const trace=vi.spyOn(sim.terrain.objects,'trace').mockImplementation(a=>({clear:a===selected,transmission:1} as ReturnType<typeof sim.terrain.objects.trace>));
    for(let t=0;t<3;t+=.5){state.elapsed=t;updateContacts(state,sim.terrain,target.id%10);}
    expect(squadContacts(state,observer.squadId).find(c=>c.soldierId===target.id)?.observerId).toBe(selected.id);
    for(let t=3;t<10;t+=.5){
      state.elapsed=t;trace.mockClear();updateContacts(state,sim.terrain,target.id%10);
      expect(squadContacts(state,observer.squadId).find(c=>c.soldierId===target.id)?.visible).toBe(true);
      expect(trace.mock.calls.filter(([a,b])=>scouts.includes(a as typeof observer)&&b===target)).toHaveLength(1);
    }
  });
  it.each(['building','ridge','woods','smoke'] as const)('loses live tracking at the next scan behind %s and freezes the last-known position',obstacle=>{
    const {state,sim,observer,target}=fixture();updateContacts(state,sim.terrain);
    if(obstacle==='building')sim.terrain.buildings=[{x:70,z:0,width:20,depth:20,height:8,angle:0}];
    if(obstacle==='ridge')vi.mocked(sim.terrain.heightAt).mockImplementation(x=>x>60&&x<80?10:0);
    if(obstacle==='woods')vi.mocked(sim.terrain.groundTypeAt).mockReturnValue('forest');
    if(obstacle==='smoke')state.operation!.smokeFields=[{id:9000,x:70,z:0,radius:40,born:0,until:60}];
    sim.terrain.revision++;
    target.x=450;state.elapsed=.5;updateContacts(state,sim.terrain);
    const c=squadContacts(state,observer.squadId).find(c=>c.soldierId===target.id)!;
    expect(c).toMatchObject({visible:false,x:150,z:0,lastSeen:0});
    target.x=470;state.elapsed=1;updateContacts(state,sim.terrain);
    expect(squadContacts(state,observer.squadId).find(c=>c.soldierId===target.id)).toMatchObject({visible:false,x:150});
  });
  it.each(['sleeping','incapacitated','dead'] as const)('does not retain tracking through a %s observer',condition=>{
    const {state,sim,observer,target}=fixture();updateContacts(state,sim.terrain);
    if(condition==='sleeping')observer.action='sleeping';else observer.needs!.life=condition;
    target.x=450;state.elapsed=.5;updateContacts(state,sim.terrain);
    expect(playerVisibleEnemies(state).has(target.id)).toBe(false);
  });
  it('uses the same bounded tracking rules for the enemy faction',()=>{
    const {state,sim,observer,target}=fixture();updateContacts(state,sim.terrain);
    expect(squadContacts(state,target.squadId).find(c=>c.soldierId===observer.id)?.visible).toBe(true);
    observer.x=-300;state.elapsed=.5;updateContacts(state,sim.terrain);
    expect(squadContacts(state,target.squadId).find(c=>c.soldierId===observer.id)).toMatchObject({visible:true,x:-300,trackedUntil:6});
    state.elapsed=6;updateContacts(state,sim.terrain);
    expect(squadContacts(state,target.squadId).find(c=>c.soldierId===observer.id)?.visible).toBe(false);
  });
  it('continues tracking identically after save/load and rejects forged observers or extended windows',()=>{
    const {state,sim,observer,target}=fixture();updateContacts(state,sim.terrain);
    target.x=450;state.elapsed=2;updateContacts(state,sim.terrain);
    const saves=new SaveSystem(),copy=saves.parse(JSON.stringify(state));
    expect(copy).toEqual(state);
    for(let t=2.5;t<=7;t+=.5){state.elapsed=copy.elapsed=t;updateContacts(state,sim.terrain);updateContacts(copy,sim.terrain);expect(copy.operation!.intelligence).toEqual(state.operation!.intelligence);expect(copy.operation!.contacts).toEqual(state.operation!.contacts);}
    const valid=JSON.stringify(state);
    for(const mutation of [(c:{trackedUntil?:number})=>{c.trackedUntil=1000;},(c:{observerId?:number})=>{c.observerId=target.id;}]){
      const bad=JSON.parse(valid);mutation(bad.operation.contacts.player[0]);expect(()=>saves.parse(JSON.stringify(bad))).toThrow();
      const badLocal=JSON.parse(valid);mutation(badLocal.operation.intelligence.squads.find((q:{squadId:number})=>q.squadId===observer.squadId).contacts[0]);expect(()=>saves.parse(JSON.stringify(badLocal))).toThrow();
    }
  });
});
