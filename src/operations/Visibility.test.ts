import {describe,expect,it,vi} from 'vitest';
import {createOperation} from './createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {canSpot,observedEnemySquad,playerVisibleEnemies,updateContacts,visibilitySignal} from './Visibility';
import {UnitRenderer} from '../render/UnitRenderer';
import {LivingRenderer} from '../render/LivingRenderer';
import {dropCargo} from '../garrison/NeedsSystem';
import {inventory} from '../garrison/types';
import * as THREE from 'three';

function fixture(){
  const state=createOperation('advance'),sim=new BattlefieldSimulation(state),observer=state.soldiers[0],target=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
  for(const s of state.soldiers){s.x=state.squads.find(q=>q.id===s.squadId)?.faction==='enemy'?3000:-3000;s.z=3000;s.nextShotAt=10000;}
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
    expect(hidden[2]).toBe(0);expect(hidden[3]).toBe(48*2);expect(hidden[5]).toBe(48);expect(hidden[6]).toBe(0);
    updateContacts(state,sim.terrain);render.update(selection);
    expect((render.group.children[2] as unknown as {count:number}).count).toBe(1);
    target.x=600;target.lastShotAt=.9;state.elapsed=1;updateContacts(state,sim.terrain);render.update(selection);
    expect((render.group.children[2] as unknown as {count:number}).count).toBe(0);
    expect((render.group.children[5] as unknown as {count:number}).count).toBe(48);
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
});
