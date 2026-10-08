import {beforeAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {parseWeaponAssets,type WeaponAssets} from './WeaponAssets';
import {UnitRenderer} from './UnitRenderer';
import {LivingRenderer} from './LivingRenderer';
import {fieldGunPresentation} from './FieldGunPresentation';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {inventory,type Facility} from '../garrison/types';
import {mountedGeometry} from '../combat/MountedGeometry';
import {mountedGunPresentation} from './MountedGunPresentation';
import {shovelPresentation} from './ShovelPresentation';
import {releaseLostContextResources} from './ContextRecovery';
import {parseSoldierAsset,type SoldierAsset} from './SoldierAsset';
import {RiggedSoldiers} from './RiggedSoldiers';

let assets:WeaponAssets;
let soldierAsset:SoldierAsset;
beforeAll(async()=>{const b=readFileSync('src/assets/weapons.glb');assets=await parseWeaponAssets(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));const s=readFileSync('src/assets/soldier.glb');soldierAsset=await parseSoldierAsset(s.buffer.slice(s.byteOffset,s.byteOffset+s.byteLength));});
function fixture(){
  const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),s=state.soldiers[0];
  const f={id:9091,garrisonId:s.garrisonId,kind:'mortar',x:s.x,z:s.z,progress:1,facing:.4,stock:inventory(),artillery:{},installation:{kind:'field-gun'},weaponCrewIds:[s.id]} as unknown as Facility;
  state.living!.facilities=[f];state.living!.trucks=[];state.living!.crates=[];
  return {state,sim,s,f};
}
describe('supplied rifle, MG, SMG, BAR and cannon presentation',()=>{
  it('retains source hashes and every triangle in a bounded offline-friendly asset',()=>{
    const m=JSON.parse(readFileSync('assets/weapons-manifest.json','utf8'));
    expect(m.bytes).toBeLessThan(1_000_000);expect(m.materials).toBe(1);expect(m.textures).toBe(0);
    for(const source of m.sources)expect(createHash('sha256').update(readFileSync(`assets/${source.source}`)).digest('hex')).toBe(source.sourceSha256);
    const triangles=(g:THREE.BufferGeometry)=>(g.index?.count??g.getAttribute('position').count)/3;
    expect(triangles(assets.rifle)).toBe(850);expect(triangles(assets.machinegun)).toBe(2500);
    expect(triangles(assets.submachinegun)).toBe(2100);
    expect(triangles(assets.automaticRifle)).toBe(2100);expect(triangles(assets.automaticRifleDeployed)).toBe(2100);
    expect(triangles(assets.cannonBarrel)+triangles(assets.cannonCarriage)).toBe(4100);
    expect(triangles(assets.mgMountBase)+triangles(assets.mgMountHead)).toBe(4100);
    expect(triangles(assets.shovel)).toBe(700);expect(assets.shovel.boundingBox!.getSize(new THREE.Vector3()).y).toBeCloseTo(1.05,5);
    for(const g of [assets.rifle,assets.submachinegun,assets.automaticRifle,assets.automaticRifleDeployed,assets.machinegun,assets.machinegunDeployed,assets.mgMountBase,assets.mgMountHead,assets.shovel,assets.cannonCarriage,assets.cannonBarrel])for(const name of ['position','normal','color'])expect(Array.from(g.getAttribute(name).array).every(Number.isFinite)).toBe(true);
  });
  it('sets metre scale, +Z muzzle sockets and a lower-profile folded bipod',()=>{
    expect(assets.rifle.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(1.1,4);
    expect(assets.machinegunDeployed.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(1.23,4);
    expect(assets.rifle.boundingBox!.max.z).toBeCloseTo(.6,5);
    expect(assets.submachinegun.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(.82,4);
    expect(assets.submachinegun.boundingBox!.max.z).toBeCloseTo(.29,5);
    expect(assets.automaticRifle.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(1.2,4);
    expect(assets.automaticRifle.boundingBox!.max.z).toBeCloseTo(.6,5);
    expect(assets.automaticRifle.boundingBox!.min.y).toBeGreaterThan(assets.automaticRifleDeployed.boundingBox!.min.y);
    expect(assets.machinegun.boundingBox!.max.z).toBeCloseTo(.6,5);
    expect(assets.machinegun.boundingBox!.min.y).toBeGreaterThan(assets.machinegunDeployed.boundingBox!.min.y);
    expect(assets.cannonCarriage.boundingBox!.min.y).toBeCloseTo(0,5);
    expect(assets.mgMountBase.boundingBox!.min.y).toBeCloseTo(0,5);
    expect(assets.mgMountBase.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(1.4,4);
    expect(assets.cannonMuzzle.y).toBeGreaterThan(1.4);expect(assets.cannonMuzzle.y).toBeLessThan(1.7);
  });
  it('uses close instanced equipment, preserves muzzle/shot alignment and distant fallback',()=>{
    for(const weapon of ['m1','mg42','smg','bar'] as const){
      const {state,sim,s}=fixture();state.soldiers=[s];s.equipment!.weapon=weapon;s.duty=undefined;s.garrisonId=undefined;s.heading=.3;state.elapsed=4;
      const from={x:s.x+.5,y:10,z:s.z+.8},to={x:from.x+30,y:from.y+15,z:from.z+40};
      state.operation!.shotEvents=[{id:17,shooterId:s.id,squadId:s.squadId,at:4,from,to,energy:1}];
      const before=JSON.stringify(state),r=new UnitRenderer(state,sim.terrain,null,assets);r.update(new Set(),1/60,20);
      const geometry=weapon==='m1'?assets.rifle:weapon==='smg'?assets.submachinegun:weapon==='bar'?assets.automaticRifle:assets.machinegun,mesh=r.group.children.find(o=>o instanceof THREE.InstancedMesh&&o.geometry===geometry) as THREE.InstancedMesh;
      expect(mesh.count).toBe(1);const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
      const muzzle=new THREE.Vector3(0,0,weapon==='smg'?.29:.6).applyMatrix4(matrix);expect(muzzle.distanceTo(new THREE.Vector3(from.x,from.y,from.z))).toBeLessThan(.001);
      r.update(new Set(),1/60,700);expect(mesh.geometry).not.toBe(geometry);expect(JSON.stringify(state)).toBe(before);
    }
  });
  it.each(['smg','bar'] as const)('attaches the supplied %s grip to the animated carrying hand without changing equipment or saves',weapon=>{
    for(const action of ['holding','following drawn path']){
      const {state,sim,s}=fixture();state.soldiers=[s];s.equipment!.weapon=weapon;s.duty=undefined;s.garrisonId=undefined;s.action=action;s.heading=.4;state.elapsed=4;
      const before=JSON.stringify(state),r=new UnitRenderer(state,sim.terrain,soldierAsset,assets);r.update(new Set(),1/60,20);
      const mesh=r.group.getObjectByName(weapon==='smg'?'Held smg':'Held automatic') as THREE.InstancedMesh,matrix=new THREE.Matrix4();expect(mesh.count).toBe(1);expect(mesh.geometry).toBe(weapon==='smg'?assets.submachinegun:assets.automaticRifle);mesh.getMatrixAt(0,matrix);
      const rig=new RiggedSoldiers(soldierAsset);rig.begin(1,true);rig.add(s,new THREE.Vector3(s.x,sim.terrain.heightAt(s.x,s.z),s.z),state.elapsed,false,0,new THREE.Color(0xffffff));
      const grip=(weapon==='smg'?assets.submachinegunGrip:assets.automaticRifleGrip).clone().applyMatrix4(matrix);expect(grip.distanceTo(rig.attachment('HandR',new THREE.Vector3()))).toBeLessThan(.001);
      expect(JSON.stringify(state)).toBe(before);r.update(new Set(),1/60,20);expect(JSON.stringify(state)).toBe(before);
    }
  });
  it.each(['smg','bar'] as const)('uses the %s slot only for matching equipment and retains the fallback after context restore',weapon=>{
    const {state,sim,s}=fixture();state.soldiers=[s];s.equipment!.weapon=weapon;s.duty=undefined;s.garrisonId=undefined;
    const name=weapon==='smg'?'Held smg':'Held automatic',geometry=weapon==='smg'?assets.submachinegun:assets.automaticRifle;
    const r=new UnitRenderer(state,sim.terrain,null,assets);r.update(new Set(),1/60,20);const mesh=r.group.getObjectByName(name) as THREE.InstancedMesh;expect(mesh.count).toBe(1);
    releaseLostContextResources(r.group);r.update(new Set(),1/60,20);expect(mesh.geometry).toBe(geometry);expect(mesh.count).toBe(1);
    s.equipment!.weapon='unarmed';r.update(new Set(),1/60,20);expect(mesh.count).toBe(0);s.equipment!.weapon='m1';r.update(new Set(),1/60,20);expect(mesh.count).toBe(0);
    s.equipment!.weapon=weapon;const fallback=new UnitRenderer(state,sim.terrain,null,null);fallback.update(new Set(),1/60,20);const old=fallback.group.getObjectByName(name) as THREE.InstancedMesh;expect(old.count).toBe(1);expect(old.geometry).not.toBe(geometry);
  });
  it('deploys the BAR only while active and stationary prone, with shot alignment and no duplicate gun',()=>{
    const {state,sim,s}=fixture();state.soldiers=[s];s.equipment!.weapon='bar';s.posture='prone';s.duty=undefined;s.garrisonId=undefined;s.action='watching';state.elapsed=4;
    const from={x:s.x,y:1,z:s.z},to={x:s.x+20,y:2,z:s.z+50};state.operation!.shotEvents=[{id:19,shooterId:s.id,squadId:s.squadId,at:4,from,to,energy:1}];
    const before=JSON.stringify(state),r=new UnitRenderer(state,sim.terrain,soldierAsset,assets);r.update(new Set(),1/60,20);
    const deployed=r.group.getObjectByName('Bipod automatic rifles') as THREE.InstancedMesh,held=r.group.getObjectByName('Held automatic') as THREE.InstancedMesh,m=new THREE.Matrix4();
    expect(deployed.count).toBe(1);expect(held.count).toBe(0);expect(deployed.geometry).toBe(assets.automaticRifleDeployed);deployed.getMatrixAt(0,m);
    expect(new THREE.Vector3(0,0,.6).applyMatrix4(m).distanceTo(new THREE.Vector3(from.x,from.y,from.z))).toBeLessThan(.001);expect(JSON.stringify(state)).toBe(before);
    releaseLostContextResources(r.group);r.update(new Set(),1/60,20);expect(deployed.count).toBe(1);
    state.operation!.shotEvents=[];
    for(const action of ['crawling to cover','sleeping']){s.action=action;r.update(new Set(),1/60,20);expect(deployed.count).toBe(0);expect(held.count).toBe(1);}
    s.action='watching';s.needs!.life='incapacitated';r.update(new Set(),1/60,20);expect(deployed.count).toBe(0);
    s.needs!.life='active';s.posture='standing';r.update(new Set(),1/60,20);expect(deployed.count).toBe(0);expect(held.count).toBe(1);
    s.posture='prone';r.update(new Set(),1/60,700);expect(deployed.count).toBe(1);expect(deployed.geometry).not.toBe(assets.automaticRifleDeployed);
  });
  it('keeps a mounted MG physical without a crew and aligns it with real mounted shots',()=>{
    const {state,sim,s,f}=fixture();f.kind='emplacement';f.artillery=undefined;f.installation!.kind='crew-mg';state.elapsed=3;
    s.duty={kind:'watch',facilityId:f.id,arrivedAt:0} as typeof s.duty;
    const r=new LivingRenderer(()=>state,sim.terrain,assets);r.spectator=true;const before=JSON.stringify(state);r.update(100,false);
    const mesh=r.group.getObjectByName('Mounted machine guns') as THREE.InstancedMesh,m=new THREE.Matrix4();expect(mesh.count).toBe(1);mesh.getMatrixAt(0,m);
    const expected=mountedGeometry(state,sim.terrain,f).muzzle;expect(new THREE.Vector3(0,0,.6).applyMatrix4(m).distanceTo(new THREE.Vector3(expected.x,expected.y,expected.z))).toBeLessThan(.001);
    expect(JSON.stringify(state)).toBe(before);
    const from={x:f.x+.4,y:4,z:f.z+.5},to={x:f.x+40,y:14,z:f.z+200};state.operation!.shotEvents=[{id:3,at:3,from,to,shooterId:s.id,squadId:s.squadId,energy:1}];r.update(116,false);mesh.getMatrixAt(0,m);
    expect(new THREE.Vector3(0,0,.6).applyMatrix4(m).distanceTo(new THREE.Vector3(from.x,from.y,from.z))).toBeLessThan(.001);
    f.weaponCrewIds=[];r.update(200,false);expect(mesh.count).toBe(1);
  });
  it('deploys the bipod only for a prone active gunner, with shared geometry and no state writes',()=>{
    const {state,sim,s}=fixture();state.soldiers=[s];s.equipment!.weapon='mg42';s.posture='prone';s.duty=undefined;s.garrisonId=undefined;
    const before=JSON.stringify(state),r=new UnitRenderer(state,sim.terrain,null,assets);r.update(new Set(),1/60,20);
    const deployed=r.group.getObjectByName('Bipod machine guns') as THREE.InstancedMesh;
    expect(deployed.count).toBe(1);expect(deployed.geometry).toBe(assets.machinegunDeployed);expect(JSON.stringify(state)).toBe(before);
    s.posture='standing';r.update(new Set(),1/60,20);expect(deployed.count).toBe(0);
  });
  it('keeps the mount feet stationary through traverse, elevation, crew movement and shot error',()=>{
    const {state,sim,s,f}=fixture();f.kind='emplacement';f.artillery=undefined;f.installation!.kind='crew-mg';state.elapsed=3;
    s.combat={shotSequence:0};const original=mountedGunPresentation(state,sim.terrain,f,assets);
    for(const yaw of [-.7,.4,1.1])for(const height of [-10,4,18]){
      f.traverse={yaw} as typeof f.traverse;s.combat!.aim={point:{x:f.x+40,y:height,z:f.z+60}} as typeof s.combat.aim;
      s.x+=.2;s.z-=.1;const before=JSON.stringify(state),pose=mountedGunPresentation(state,sim.terrain,f,assets),geometry=mountedGeometry(state,sim.terrain,f,yaw);
      expect(pose.base!.elements).toEqual(original.base!.elements);expect(pose.head!.elements).toEqual(pose.gun.elements);
      expect(new THREE.Vector3(0,0,.6).applyMatrix4(pose.gun).distanceTo(new THREE.Vector3(geometry.muzzle.x,geometry.muzzle.y,geometry.muzzle.z))).toBeLessThan(.001);
      const bottom=assets.mgMountBaseNeck.clone().applyMatrix4(pose.base!),top=assets.mgMountHeadNeck.clone().applyMatrix4(pose.head!);
      expect(new THREE.Vector3(0,-.5,0).applyMatrix4(pose.riser!).distanceTo(bottom)).toBeLessThan(.001);
      expect(new THREE.Vector3(0,.5,0).applyMatrix4(pose.riser!).distanceTo(top)).toBeLessThan(.001);
      expect(pose.riser!.elements.every(Number.isFinite)).toBe(true);expect(JSON.stringify(state)).toBe(before);
      const shot={from:geometry.muzzle,to:{x:f.x+48,y:height+4,z:f.z+66}},fired=mountedGunPresentation(state,sim.terrain,f,assets,shot);
      expect(fired.base!.elements).toEqual(original.base!.elements);
      expect(new THREE.Vector3(0,0,.6).applyMatrix4(fired.gun).distanceTo(new THREE.Vector3(shot.from.x,shot.from.y,shot.from.z))).toBeLessThan(.001);
    }
  });
  it('renders one installed mount without ammo or crew, falls back at distance, and clears stale instances',()=>{
    const {state,sim,f}=fixture();f.kind='emplacement';f.artillery=undefined;f.installation!.kind='crew-mg';f.weaponCrewIds=[];
    const r=new LivingRenderer(()=>state,sim.terrain,assets,null);r.spectator=true;
    const meshes=['MG mount bases','MG mount cradles','MG mount risers'].map(n=>r.group.getObjectByName(n) as THREE.InstancedMesh);
    const before=JSON.stringify(state);r.update(100,false,{x:f.x,z:f.z,zoom:20});expect(meshes.map(m=>m.count)).toEqual([1,1,1]);expect(meshes[0].geometry).toBe(assets.mgMountBase);expect(meshes[1].geometry).toBe(assets.mgMountHead);
    releaseLostContextResources(r.group);r.update(200,false);expect(meshes.map(m=>m.count)).toEqual([1,1,1]);
    r.update(300,false,{x:f.x,z:f.z,zoom:700});expect(meshes.map(m=>m.count)).toEqual([0,0,0]);expect((r.group.getObjectByName('Mounted machine guns') as THREE.InstancedMesh).count).toBe(1);
    r.update(400,false,{x:f.x,z:f.z,zoom:20});expect(meshes.map(m=>m.count)).toEqual([1,1,1]);expect(JSON.stringify(state)).toBe(before);
    f.progress=.9;r.update(500,false);expect(meshes.map(m=>m.count)).toEqual([0,0,0]);f.progress=1;f.installation=undefined;r.update(600,false);expect(meshes.map(m=>m.count)).toEqual([0,0,0]);
    state.living=undefined;r.update(700,false);r.update(716,false);expect(meshes.map(m=>m.count)).toEqual([0,0,0]);
    const fallback=new LivingRenderer(()=>state,sim.terrain,null,null);fallback.update(100,false);expect((fallback.group.getObjectByName('MG mount bases') as THREE.InstancedMesh).count).toBe(0);
  });
  it('does not expose a hidden enemy mount or duplicate the operator weapon',()=>{
    const {state,sim,s,f}=fixture();f.kind='emplacement';f.artillery=undefined;f.installation!.kind='crew-mg';s.equipment!.weapon='mg42';s.duty={kind:'watch',facilityId:f.id,arrivedAt:0} as typeof s.duty;state.soldiers=[s];
    const units=new UnitRenderer(state,sim.terrain,null,assets);units.update(new Set(),1/60,20);
    expect((units.group.getObjectByName('Held machinegun') as THREE.InstancedMesh).count).toBe(0);
    const renderer=new LivingRenderer(()=>state,sim.terrain,assets,null);renderer.update(100,false);expect((renderer.group.getObjectByName('MG mount bases') as THREE.InstancedMesh).count).toBe(1);
    state.squads.find(q=>q.id===s.squadId)!.faction='enemy';state.living!.garrisons.find(g=>g.id===f.garrisonId)!.faction='enemy';state.operation!.contacts={player:[],enemy:[]};renderer.update(200,false);
    expect((renderer.group.getObjectByName('MG mount bases') as THREE.InstancedMesh).count).toBe(0);expect((renderer.group.getObjectByName('Mounted machine guns') as THREE.InstancedMesh).count).toBe(0);
  });
  it('animates only ammunition-consuming discharges on simulation time, including throttled render frames',()=>{
    const {state,sim,f}=fixture();state.elapsed=10;
    const mission={id:3,squadId:state.squads[0].id,positionId:f.id,weapon:'field-gun' as const,kind:'mortarHE' as const,target:{x:f.x+100,z:f.z+400},impact:{x:9,z:999},requestedAt:0,launchAt:10,impactAt:14,stage:'preparing' as 'preparing'|'flight'|'cancelled',reason:'',dangerRadius:60,confirmedRisk:false,ammoConsumed:0};
    state.operation!.supportMissions=[mission];expect(fieldGunPresentation(state,f,0,assets).recoil).toBe(0);mission.stage='cancelled';expect(fieldGunPresentation(state,f,0,assets).recoil).toBe(0);
    mission.stage='flight';mission.ammoConsumed=1;
    const r=new LivingRenderer(()=>state,sim.terrain,assets);r.spectator=true;r.update(100,false);
    const tube=r.group.getObjectByName('Field gun barrels') as THREE.InstancedMesh,carriage=r.group.getObjectByName('Field gun carriages') as THREE.InstancedMesh;
    const initial=Array.from(tube.instanceMatrix.array),fixed=Array.from(carriage.instanceMatrix.array);state.elapsed=10.06;r.update(116,false);
    expect(Array.from(tube.instanceMatrix.array)).not.toEqual(initial);expect(Array.from(carriage.instanceMatrix.array)).toEqual(fixed);
    const freeze=Array.from(tube.instanceMatrix.array),before=JSON.stringify(state);r.update(132,false);expect(Array.from(tube.instanceMatrix.array)).toEqual(freeze);expect(JSON.stringify(state)).toBe(before);
    const a=fieldGunPresentation(state,f,0,assets);mission.impact={x:-900,z:-900};expect(fieldGunPresentation(state,f,0,assets).barrel.elements).toEqual(a.barrel.elements);
    releaseLostContextResources(r.group);r.update(250,false);expect(tube.count).toBe(1);
    const restored=JSON.parse(JSON.stringify(state));expect(fieldGunPresentation(restored,restored.living.facilities[0],0,assets).barrel.elements).toEqual(a.barrel.elements);
  });
  it('attaches the shovel grip to the GPU-sampled lower hand and keeps the shaft through both hands',()=>{
    const {state,sim,s}=fixture();state.soldiers=[s];s.garrisonId=undefined;s.duty=undefined;s.action='digging';s.posture='standing';s.combat=undefined;s.aimTargetId=undefined;
    const r=new UnitRenderer(state,sim.terrain,soldierAsset,assets),rig=new RiggedSoldiers(soldierAsset),m=new THREE.Matrix4();
    for(const heading of [0,.7,Math.PI,-Math.PI/2])for(const t of [.2,.6,1,1.4]){
      s.heading=heading;state.elapsed=t;const before=JSON.stringify(state);r.update(new Set(),1/60,20);
      const tool=r.group.getObjectByName('Working shovels') as THREE.InstancedMesh;expect(tool.count).toBe(1);expect(tool.geometry).toBe(assets.shovel);tool.getMatrixAt(0,m);
      rig.begin(1,true);rig.add(s,new THREE.Vector3(s.x,sim.terrain.heightAt(s.x,s.z),s.z),t,false,0,new THREE.Color());
      const lower=rig.attachment('HandL',new THREE.Vector3()),upper=rig.attachment('HandR',new THREE.Vector3());
      expect(assets.shovelGrip.clone().applyMatrix4(m).distanceTo(lower)).toBeLessThan(.001);
      const local=upper.clone().applyMatrix4(m.clone().invert());expect(Math.abs(local.x)).toBeLessThan(.001);expect(Math.abs(local.z)).toBeLessThan(.001);expect(local.y).toBeGreaterThan(.1);expect(local.y).toBeLessThan(.51);
      const pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();m.decompose(pos,q,scale);expect(scale.distanceTo(new THREE.Vector3(1,1,1))).toBeLessThan(.0001);
      expect(JSON.stringify(state)).toBe(before);r.update(new Set(),1/60,20);const paused=new THREE.Matrix4();tool.getMatrixAt(0,paused);expect(paused.elements).toEqual(m.elements);
    }
    for(const upper of [new THREE.Vector3(),new THREE.Vector3(0,0,1)])expect(shovelPresentation(new THREE.Vector3(),upper,0).elements.every(Number.isFinite)).toBe(true);
  });
  it('shows working tools only for active digging/spoil work and preserves hiding, fallback and context recovery',()=>{
    const {state,sim,s}=fixture();state.soldiers=[s];s.garrisonId=undefined;s.duty=undefined;s.action='digging';s.posture='standing';
    const r=new UnitRenderer(state,sim.terrain,soldierAsset,assets);r.update(new Set(),1/60,20);
    const tool=r.group.getObjectByName('Working shovels') as THREE.InstancedMesh,rifle=r.group.children[5] as THREE.InstancedMesh;
    expect(tool.count).toBe(1);expect(rifle.count).toBe(0);s.action='clearing spoil';r.update(new Set(),1/60,20);expect(tool.count).toBe(1);expect(rifle.count).toBe(0);
    releaseLostContextResources(r.group);r.update(new Set(),1/60,20);expect(tool.geometry).toBe(assets.shovel);expect(tool.count).toBe(1);
    r.update(new Set(),1/60,700);expect(tool.count).toBe(0);expect(tool.geometry).not.toBe(assets.shovel);
    for(const action of ['holding','walking','sleeping','resting','treating','building support']){s.action=action;r.update(new Set(),1/60,20);expect(tool.count).toBe(0);}
    s.action='digging';for(const life of ['dead','incapacitated'] as const){s.needs!.life=life;r.update(new Set(),1/60,20);expect(tool.count).toBe(0);}
    s.needs!.life='active';const fallback=new UnitRenderer(state,sim.terrain,null,null);fallback.update(new Set(),1/60,20);const old=fallback.group.getObjectByName('Working shovels') as THREE.InstancedMesh;expect(old.count).toBe(1);expect(old.geometry).not.toBe(assets.shovel);
    state.squads.find(q=>q.id===s.squadId)!.faction='enemy';state.operation!.contacts={player:[],enemy:[]};r.update(new Set(),1/60,20);expect(tool.count).toBe(0);
    state.squads.find(q=>q.id===s.squadId)!.faction='player';const saved=JSON.stringify(state);r.replaceState(JSON.parse(saved));r.update(new Set(),1/60,20);expect((r.group.getObjectByName('Working shovels') as THREE.InstancedMesh).count).toBe(1);expect(JSON.stringify(state)).toBe(saved);
  });
});
