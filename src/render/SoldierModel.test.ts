import {beforeAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {parseSoldierAsset,type SoldierAsset} from './SoldierAsset';
import {RiggedSoldiers,soldierPose} from './RiggedSoldiers';
import {UnitRenderer} from './UnitRenderer';
import {createOperation} from '../operations/createOperation';
import {createBattlefield} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {releaseLostContextResources} from './ContextRecovery';

let asset:SoldierAsset;
beforeAll(async()=>{const bytes=readFileSync('src/assets/soldier.glb');asset=await parseSoldierAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));});
function person(){const s=createBattlefield().soldiers[0];s.x=s.z=0;s.heading=0;s.needs={energy:100,hunger:0,thirst:0,life:'active',hungryHours:0,thirstyHours:0,sleepHours:0,day:0,watchHours:0,interruptedSleep:0,taskChanges:0};return s;}

describe('user soldier asset and batched animation',()=>{
  it('preserves source provenance and ships a bounded single-material rig',()=>{
    const manifest=JSON.parse(readFileSync('assets/soldier-manifest.json','utf8'));
    expect(createHash('sha256').update(readFileSync('assets/source/troops.obj')).digest('hex')).toBe(manifest.sourceSha256);
    expect(manifest.triangles).toBe(1700);expect(manifest.materials).toBe(1);expect(manifest.bytes).toBeLessThan(600_000);
    expect(asset.boneCount).toBe(17);expect(Object.keys(asset.poses)).toHaveLength(17);
    const g=asset.geometry,w=g.getAttribute('skinWeight'),j=g.getAttribute('skinIndex');
    for(let i=0;i<w.count;i++){
      expect(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)).toBeCloseTo(1,5);
      for(const joint of [j.getX(i),j.getY(i),j.getZ(i),j.getW(i)])expect(joint).toBeLessThan(asset.boneCount);
    }
    for(const name of ['position','normal','color','_uniform']){const a=g.getAttribute(name);for(let i=0;i<a.count;i++)expect(Number.isFinite(a.getX(i))).toBe(true);}
    const p=g.getAttribute('position');let height=0,min=Infinity;for(let i=0;i<p.count;i++){height=Math.max(height,p.getY(i));min=Math.min(min,p.getY(i));}
    expect(height).toBeCloseTo(1.8,4);expect(min).toBeCloseTo(0,4);expect(asset.matrices.every(Number.isFinite)).toBe(true);
  });
  it('uses distinct real action states and never rests while still approaching a break',()=>{
    const s=person();s.action='moving to work front';expect(soldierPose(s)).toBe('walk');
    s.selfCare={kind:'field-rest',stage:'outbound',since:0,until:45,orderAt:0,blockedFor:0,home:{x:0,z:0},route:[],index:0};expect(soldierPose(s)).toBe('walk');
    s.selfCare.stage='use';expect(soldierPose(s)).toBe('rest');delete s.selfCare;
    for(const [action,pose]of [['digging','dig'],['resting','rest'],['sleeping','sleep'],['eating','eat'],['treating','treat'],['carrying casualty','carry']] as const){s.action=action;expect(soldierPose(s)).toBe(pose);}
    s.needs!.life='incapacitated';expect(soldierPose(s)).toBe('wounded');s.needs!.life='dead';expect(soldierPose(s)).toBe('dead');
  });
  it('batches 512 people in one mesh without per-person mixers or skeletons',()=>{
    const batch=new RiggedSoldiers(asset),s=person(),p=new THREE.Vector3(),tint=new THREE.Color();batch.begin(512,true);
    for(let i=0;i<512;i++){s.id=i+1;p.x=i*2;batch.add(s,p,2,false,i%3,tint);}batch.end();
    expect(batch.group.children).toHaveLength(1);expect(batch.mesh!.count).toBe(512);expect(batch.mesh!.type).toBe('Mesh');expect((batch.mesh as unknown as {skeleton?:unknown}).skeleton).toBeUndefined();
    const geometry=batch.mesh!.geometry,matrices=batch.mesh!.instanceMatrix;
    batch.begin(512,true);batch.add(s,p,3,false,0,tint);batch.end();expect(batch.mesh!.geometry).toBe(geometry);expect(batch.mesh!.instanceMatrix).toBe(matrices);expect(batch.mesh!.count).toBe(1);
  });
  it('freezes animation when simulation is paused and blends activity changes',()=>{
    const batch=new RiggedSoldiers(asset),s=person(),p=new THREE.Vector3(),tint=new THREE.Color();s.action='walking';
    const step=(time:number)=>{batch.begin(1,true);batch.add(s,p,time,false,0,tint);batch.end();return Array.from(batch.mesh!.geometry.getAttribute('troopPose').array);};
    const before=step(2);expect(step(2)).toEqual(before);s.action='digging';const transition=step(2);expect(transition[0]).toBe(before[0]);expect(transition[2]).toBe(0);
    const after=step(2.3);expect(after[0]).toBeGreaterThanOrEqual(asset.poses.dig.offset);expect(after[0]).toBeLessThan(asset.poses.dig.offset+asset.poses.dig.frames);
    const dead=asset.poses.dead,stride=asset.boneCount*16;const reference=asset.matrices.slice(dead.offset*stride,(dead.offset+1)*stride);
    for(let i=1;i<dead.frames;i++)expect(asset.matrices.slice((dead.offset+i)*stride,(dead.offset+i+1)*stride)).toEqual(reference);
  });
  it('uses the same palette for held equipment and GPU/shadow deformation',()=>{
    const batch=new RiggedSoldiers(asset),s=person(),p=new THREE.Vector3(4,-1.75,8);batch.begin(1,true);batch.add(s,p,1,true,0,new THREE.Color());batch.end();
    const hand=batch.attachment('HandR',new THREE.Vector3());expect(hand.x).toBeGreaterThan(3.5);expect(hand.x).toBeLessThan(4.5);expect(hand.y).toBeGreaterThan(-.5);expect(hand.z).toBeGreaterThan(8);
    for(const mat of [batch.mesh!.material as THREE.Material,batch.mesh!.customDepthMaterial!]){
      const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <color_vertex>',fragmentShader:''};
      mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
      expect(shader.vertexShader).toContain('transformed=(troopSkin()*vec4(transformed,1.0)).xyz;');expect(shader.uniforms).toHaveProperty('troopAtlas');
    }
  });
  it('preserves exact floor contact, visibility filtering, distant fallback and simulation state',()=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),before=JSON.stringify(state),renderer=new UnitRenderer(state,sim.terrain,asset);
    renderer.update(new Set(),1/60,25);const group=renderer.group.getObjectByName('User soldier model')!,body=group.children[0] as THREE.InstancedMesh;
    expect(body.count).toBe(48);expect(group.visible).toBe(true);expect(renderer.group.children[0].visible).toBe(false);
    renderer.update(new Set(),1/60,700);expect(group.visible).toBe(false);expect(renderer.group.children[0].visible).toBe(true);expect(JSON.stringify(state)).toBe(before);
    const s=person();state.soldiers=[s];state.operation=undefined;const r=new UnitRenderer(state,{heightAt:()=>-1.75} as unknown as TerrainSystem,asset);r.update(new Set(),1/60,25);
    const g=r.group.getObjectByName('User soldier model')!.children[0] as THREE.InstancedMesh,m=new THREE.Matrix4();g.getMatrixAt(0,m);expect(m.elements[13]).toBe(-1.75);
    const saved=JSON.stringify(state);r.replaceState(JSON.parse(saved));r.update(new Set(),1/60,25);expect(JSON.stringify(state)).toBe(saved);
    releaseLostContextResources(r.group);r.update(new Set(),1/60,25);expect(g.count).toBe(1);
  });
});
