import * as THREE from 'three';
import type {SoldierState} from '../core/types';
import {isWalkingAction} from '../core/SoldierActions';
import {postureOf} from '../combat/Posture';
import {loadSoldierAsset,type SoldierAsset,type SoldierPose} from './SoldierAsset';

export function soldierPose(s:SoldierState,aiming=false):SoldierPose{
  if(s.needs?.life==='dead')return 'dead';
  if(s.needs?.life==='incapacitated'||s.action==='being carried')return 'wounded';
  if(s.action==='sleeping')return 'sleep';
  if(s.action==='resting'||s.selfCare?.kind==='field-rest'&&s.selfCare.stage==='use')return 'rest';
  if(s.action==='eating'||s.action==='drinking')return 'eat';
  if(s.action.startsWith('treating'))return 'treat';
  const walking=isWalkingAction(s.action);
  if(postureOf(s)==='prone')return walking?'crawl':'prone';
  if(s.action==='digging'||s.action==='clearing spoil')return 'dig';
  if(s.action==='carrying casualty')return 'carry';
  if(postureOf(s)==='crouched')return walking?'crouchWalk':aiming?'crouchAim':'crouch';
  if(walking)return 'walk';
  if(aiming)return 'aim';
  return (s.equipment?.weapon??s.combat?.weapon?.id)==='unarmed'?'unarmed':'idle';
}

const shaderHeader=`
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute vec4 troopPose;
attribute float _uniform;
uniform sampler2D troopAtlas;
uniform vec2 troopAtlasSize;
mat4 troopBone(float joint, float frame) {
  float x=joint*4.0;
  return mat4(texture2D(troopAtlas,vec2(x+.5,frame+.5)/troopAtlasSize),
              texture2D(troopAtlas,vec2(x+1.5,frame+.5)/troopAtlasSize),
              texture2D(troopAtlas,vec2(x+2.5,frame+.5)/troopAtlasSize),
              texture2D(troopAtlas,vec2(x+3.5,frame+.5)/troopAtlasSize));
}
mat4 troopFrame(float frame) {
  return skinWeight.x*troopBone(skinIndex.x,frame)+skinWeight.y*troopBone(skinIndex.y,frame)
       + skinWeight.z*troopBone(skinIndex.z,frame)+skinWeight.w*troopBone(skinIndex.w,frame);
}
mat4 troopSkin() {return (1.0-troopPose.z)*troopFrame(troopPose.x)+troopPose.z*troopFrame(troopPose.y);}
`;

function animatedMaterial<T extends THREE.Material>(material:T,asset:SoldierAsset):T{
  // Direct property makes the atlas discoverable by the existing context-loss disposer.
  Object.assign(material,{troopAtlas:asset.atlas});
  material.onBeforeCompile=shader=>{
    shader.uniforms.troopAtlas={value:asset.atlas};shader.uniforms.troopAtlasSize={value:new THREE.Vector2(asset.boneCount*4,asset.atlas.image.height)};
    shader.vertexShader=shaderHeader+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=mat3(troopSkin())*objectNormal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=(troopSkin()*vec4(transformed,1.0)).xyz;');
    shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',`#include <color_vertex>
      #ifdef USE_COLOR
      vec3 clothTint=troopPose.w<.5?vec3(1.0):troopPose.w<1.5?vec3(.73,.76,1.23):vec3(1.28,.98,1.08);
      vColor.rgb*=mix(vec3(1.0),clothTint,_uniform);
      #endif`);
  };
  material.customProgramCacheKey=()=> 'frontlines-weighted-soldier-v1';return material;
}

interface PoseHistory {pose:SoldierPose;since:number;previous:number;frame:number;last:number}
export class RiggedSoldiers{
  readonly group=new THREE.Group();
  asset?:SoldierAsset;
  error?:string;
  mesh?:THREE.InstancedMesh;
  private poses?:THREE.InstancedBufferAttribute;
  private histories=new Map<number,PoseHistory>();
  private retained=new Set<number>();
  private count=0;
  private frames=new THREE.Vector4();
  private a=new THREE.Matrix4();private b=new THREE.Matrix4();private root=new THREE.Matrix4();
  private rotation=new THREE.Quaternion();private scale=new THREE.Vector3(1,1,1);
  constructor(asset?:SoldierAsset|null){
    this.group.name='User soldier model';this.asset=asset??undefined;
    if(asset===undefined&&typeof window!=='undefined')void loadSoldierAsset().then(a=>{this.asset=a;}).catch(e=>{this.error=String(e);console.warn('Soldier model unavailable; using built-in soldiers.',e);});
  }
  begin(capacity:number,visible:boolean){
    this.group.visible=visible&&!!this.asset;this.count=0;this.retained.clear();
    if(!this.group.visible)return false;
    if(!this.mesh||this.mesh.instanceMatrix.count<capacity){
      if(this.mesh){this.mesh.dispose();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();this.mesh.customDepthMaterial?.dispose();this.group.remove(this.mesh);}
      const asset=this.asset!,geometry=asset.geometry.clone();
      this.poses=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4);this.poses.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('troopPose',this.poses);
      const material=animatedMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}),asset);
      this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='Animated infantry';this.mesh.castShadow=true;this.mesh.frustumCulled=false;
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.customDepthMaterial=animatedMaterial(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),asset);
      this.group.add(this.mesh);
    }
    return true;
  }
  add(s:SoldierState,position:THREE.Vector3,elapsed:number,aiming:boolean,variant:number,tint:THREE.Color){
    const asset=this.asset!,pose=soldierPose(s,aiming),range=asset.poses[pose],phase=pose==='dead'?0:s.id*.173;
    const sample=((elapsed+phase)%range.duration)/range.duration*range.frames;
    const frame=range.offset+Math.floor(sample),next=range.offset+(Math.floor(sample)+1)%range.frames;
    let history=this.histories.get(s.id);
    if(!history||elapsed<history.last){history={pose,since:elapsed-.2,previous:frame,frame,last:elapsed};this.histories.set(s.id,history);}
    if(history.pose!==pose){history.previous=history.frame;history.since=elapsed;history.pose=pose;}
    const blend=Math.min(1,Math.max(0,(elapsed-history.since)/.16));
    this.frames.set(blend<1?history.previous:frame,blend<1?frame:next,blend<1?blend:sample%1,variant);
    history.frame=frame;history.last=elapsed;this.retained.add(s.id);
    this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,s.heading);this.root.compose(position,this.rotation,this.scale);
    this.mesh!.setMatrixAt(this.count,this.root);this.mesh!.setColorAt(this.count,tint);
    this.poses!.setXYZW(this.count++,this.frames.x,this.frames.y,this.frames.z,variant);
  }
  /** Current person's attachment, sampled from exactly the same palette as the GPU. */
  attachment(name:string,target:THREE.Vector3):THREE.Vector3{
    const asset=this.asset!,joint=asset.joints[name];
    this.a.fromArray(asset.matrices,(this.frames.x*asset.boneCount+joint.index)*16);
    this.b.fromArray(asset.matrices,(this.frames.y*asset.boneCount+joint.index)*16);
    for(let i=0;i<16;i++)this.a.elements[i]+=(this.b.elements[i]-this.a.elements[i])*this.frames.z;
    return target.copy(joint.bind).applyMatrix4(this.a).applyMatrix4(this.root);
  }
  end(){
    if(this.mesh){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;this.poses!.needsUpdate=true;}
    for(const id of this.histories.keys())if(!this.retained.has(id))this.histories.delete(id);
  }
  reset(){this.histories.clear();}
}
