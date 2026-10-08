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
describe('supplied rifle, MG, SMG and cannon presentation',()=>{
  it('retains source hashes and every triangle in a bounded offline-friendly asset',()=>{
    const m=JSON.parse(readFileSync('assets/weapons-manifest.json','utf8'));
    expect(m.bytes).toBeLessThan(1_000_000);expect(m.materials).toBe(1);expect(m.textures).toBe(0);
    for(const source of m.sources)expect(createHash('sha256').update(readFileSync(`assets/${source.source}`)).digest('hex')).toBe(source.sourceSha256);
    const triangles=(g:THREE.BufferGeometry)=>(g.index?.count??g.getAttribute('position').count)/3;
    expect(triangles(assets.rifle)).toBe(850);expect(triangles(assets.machinegun)).toBe(2500);
    expect(triangles(assets.submachinegun)).toBe(2100);
    expect(triangles(assets.cannonBarrel)+triangles(assets.cannonCarriage)).toBe(4100);
    for(const g of [assets.rifle,assets.submachinegun,assets.machinegun,assets.machinegunDeployed,assets.cannonCarriage,assets.cannonBarrel])for(const name of ['position','normal','color'])expect(Array.from(g.getAttribute(name).array).every(Number.isFinite)).toBe(true);
  });
  it('sets metre scale, +Z muzzle sockets and a lower-profile folded bipod',()=>{
    expect(assets.rifle.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(1.1,4);
    expect(assets.machinegunDeployed.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(1.23,4);
    expect(assets.rifle.boundingBox!.max.z).toBeCloseTo(.6,5);
    expect(assets.submachinegun.boundingBox!.getSize(new THREE.Vector3()).z).toBeCloseTo(.82,4);
    expect(assets.submachinegun.boundingBox!.max.z).toBeCloseTo(.29,5);
    expect(assets.machinegun.boundingBox!.max.z).toBeCloseTo(.6,5);
    expect(assets.machinegun.boundingBox!.min.y).toBeGreaterThan(assets.machinegunDeployed.boundingBox!.min.y);
    expect(assets.cannonCarriage.boundingBox!.min.y).toBeCloseTo(0,5);
    expect(assets.cannonMuzzle.y).toBeGreaterThan(1.4);expect(assets.cannonMuzzle.y).toBeLessThan(1.7);
  });
  it('uses close instanced equipment, preserves muzzle/shot alignment and distant fallback',()=>{
    for(const weapon of ['m1','mg42','smg'] as const){
      const {state,sim,s}=fixture();state.soldiers=[s];s.equipment!.weapon=weapon;s.duty=undefined;s.garrisonId=undefined;s.heading=.3;state.elapsed=4;
      const from={x:s.x+.5,y:10,z:s.z+.8},to={x:from.x+30,y:from.y+15,z:from.z+40};
      state.operation!.shotEvents=[{id:17,shooterId:s.id,squadId:s.squadId,at:4,from,to,energy:1}];
      const before=JSON.stringify(state),r=new UnitRenderer(state,sim.terrain,null,assets);r.update(new Set(),1/60,20);
      const geometry=weapon==='m1'?assets.rifle:weapon==='smg'?assets.submachinegun:assets.machinegun,mesh=r.group.children.find(o=>o instanceof THREE.InstancedMesh&&o.geometry===geometry) as THREE.InstancedMesh;
      expect(mesh.count).toBe(1);const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
      const muzzle=new THREE.Vector3(0,0,weapon==='smg'?.29:.6).applyMatrix4(matrix);expect(muzzle.distanceTo(new THREE.Vector3(from.x,from.y,from.z))).toBeLessThan(.001);
      r.update(new Set(),1/60,700);expect(mesh.geometry).not.toBe(geometry);expect(JSON.stringify(state)).toBe(before);
    }
  });
  it('attaches the supplied SMG grip to the animated carrying hand without changing equipment or saves',()=>{
    for(const action of ['holding','following drawn path']){
      const {state,sim,s}=fixture();state.soldiers=[s];s.equipment!.weapon='smg';s.duty=undefined;s.garrisonId=undefined;s.action=action;s.heading=.4;state.elapsed=4;
      const before=JSON.stringify(state),r=new UnitRenderer(state,sim.terrain,soldierAsset,assets);r.update(new Set(),1/60,20);
      const mesh=r.group.getObjectByName('Held smg') as THREE.InstancedMesh,matrix=new THREE.Matrix4();expect(mesh.count).toBe(1);expect(mesh.geometry).toBe(assets.submachinegun);mesh.getMatrixAt(0,matrix);
      const rig=new RiggedSoldiers(soldierAsset);rig.begin(1,true);rig.add(s,new THREE.Vector3(s.x,sim.terrain.heightAt(s.x,s.z),s.z),state.elapsed,false,0,new THREE.Color(0xffffff));
      const grip=assets.submachinegunGrip.clone().applyMatrix4(matrix);expect(grip.distanceTo(rig.attachment('HandR',new THREE.Vector3()))).toBeLessThan(.001);
      expect(JSON.stringify(state)).toBe(before);r.update(new Set(),1/60,20);expect(JSON.stringify(state)).toBe(before);
    }
  });
  it('uses the SMG slot only for actual SMG equipment and retains the fallback after context restore',()=>{
    const {state,sim,s}=fixture();state.soldiers=[s];s.equipment!.weapon='smg';s.duty=undefined;s.garrisonId=undefined;
    const r=new UnitRenderer(state,sim.terrain,null,assets);r.update(new Set(),1/60,20);const mesh=r.group.getObjectByName('Held smg') as THREE.InstancedMesh;expect(mesh.count).toBe(1);
    releaseLostContextResources(r.group);r.update(new Set(),1/60,20);expect(mesh.geometry).toBe(assets.submachinegun);expect(mesh.count).toBe(1);
    s.equipment!.weapon='unarmed';r.update(new Set(),1/60,20);expect(mesh.count).toBe(0);s.equipment!.weapon='m1';r.update(new Set(),1/60,20);expect(mesh.count).toBe(0);
    s.equipment!.weapon='smg';const fallback=new UnitRenderer(state,sim.terrain,null,null);fallback.update(new Set(),1/60,20);const old=fallback.group.getObjectByName('Held smg') as THREE.InstancedMesh;expect(old.count).toBe(1);expect(old.geometry).not.toBe(assets.submachinegun);
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
});
