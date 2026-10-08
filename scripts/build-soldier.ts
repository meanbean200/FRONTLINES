/** Repeatable source -> coloured, weighted, animated GLB. Source stays untouched. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Document,NodeIO} from '@gltf-transform/core';
import {dedup,prune,weld,resample} from '@gltf-transform/functions';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {JOINTS,CLIPS,createRig,poseRig,type SoldierClip} from './assets/soldier-rig';

const source=await readFile(new URL('../assets/source/troops.obj',import.meta.url),'utf8');
const obj=new OBJLoader().parse(source),mesh=obj.children[0] as THREE.Mesh;
const geometry=mesh.geometry;geometry.computeBoundingBox();
const bounds=geometry.boundingBox!,scale=1.8/(bounds.max.y-bounds.min.y),floor=bounds.min.y;
geometry.translate(0,-floor,0);geometry.scale(scale,scale,scale);
const pos=geometry.getAttribute('position'),count=pos.count;
const colors=new Float32Array(count*3),joints=new Uint16Array(count*4),weights=new Float32Array(count*4),uniform=new Float32Array(count);
const palette={cloth:0x747957,helmet:0x4b5540,web:0x9c916d,skin:0xb79a7c,boot:0x443b32,wrap:0x77715b};
const color=new THREE.Color();
function skin(x:number,y:number,z:number){
  const side=x<0?-1:1,ax=Math.abs(x);let chain:number[];
  const arm=y>.70&&y<1.47&&ax>Math.min(.32,.20+Math.max(0,1.35-y)*.24);
  if(arm)chain=side<0?[5,6,7]:[8,9,10];
  else if(y<.88)chain=side<0?[11,12,13]:[14,15,16];
  else if(y>1.48)return [[4,1]];
  else chain=[1,2,3,4];
  const point=new THREE.Vector3(x,y,z);
  const candidates=chain.slice(0,-1).map((id,i)=>{
    const a=new THREE.Vector3(...JOINTS[id].slice(2) as [number,number,number]);
    const b=new THREE.Vector3(...JOINTS[chain[i+1]].slice(2) as [number,number,number]);
    const segment=new THREE.Line3(a,b),t=segment.closestPointToPointParameter(point,true);
    return {id,next:chain[i+1],t,d:segment.at(t,new THREE.Vector3()).distanceTo(point)};
  }).sort((a,b)=>a.d-b.d);
  const best=candidates[0];
  // Bend over a short band around a joint instead of collapsing an entire limb.
  const blend=THREE.MathUtils.smoothstep(best.t,.72,1)*.5;
  return [[best.id,1-blend],[best.next,blend]];
}
for(let i=0;i<count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),ax=Math.abs(x);
  let region:keyof typeof palette='cloth';
  if(y>1.645||(y>1.60&&ax>.115))region='helmet';
  else if((y>1.46&&ax<.13)||(ax>.447&&y<.92&&y>.71))region='skin';
  else if(y<.15)region='boot';else if(y<.43)region='wrap';
  else if((y>1.035&&y<1.115&&ax<.30)||(y>1.115&&y<1.39&&z>.06&&Math.abs(ax-(.10+(1.36-y)*.15))<.030))region='web';
  color.setHex(palette[region]);colors.set([color.r,color.g,color.b],i*3);
  uniform[i]=region==='cloth'||region==='helmet'?1:0;
  for(const [n,[id,w]] of skin(x,y,z).entries()){joints[i*4+n]=id;weights[i*4+n]=w;}
}
const doc=new Document(),buffer=doc.createBuffer();
const accessor=(name:string,type:'SCALAR'|'VEC3'|'VEC4'|'MAT4',array:Float32Array|Uint16Array)=>doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
const primitive=doc.createPrimitive().setAttribute('POSITION',accessor('Metre positions','VEC3',new Float32Array(pos.array)))
  .setAttribute('NORMAL',accessor('Faceted normals','VEC3',new Float32Array(geometry.getAttribute('normal').array)))
  .setAttribute('COLOR_0',accessor('Uniform palette','VEC3',colors))
  .setAttribute('_UNIFORM',accessor('Faction cloth mask','SCALAR',uniform))
  .setAttribute('JOINTS_0',accessor('Joint influences','VEC4',joints))
  .setAttribute('WEIGHTS_0',accessor('Normalized weights','VEC4',weights))
  .setMaterial(doc.createMaterial('Cloth leather and painted steel').setRoughnessFactor(.95).setMetallicFactor(0));
const rig=createRig(),nodes=JOINTS.map(([name])=>doc.createNode(name));
JOINTS.forEach(([,parent],i)=>{nodes[i].setTranslation(rig.bones[i].position.toArray());if(parent>=0)nodes[parent].addChild(nodes[i]);});
const inverse=new Float32Array(JOINTS.length*16);rig.skeleton.boneInverses.forEach((m,i)=>inverse.set(m.elements,i*16));
const skinDoc=doc.createSkin('FRONTLINES infantry rig').setSkeleton(nodes[0]).setInverseBindMatrices(accessor('Inverse bind','MAT4',inverse));nodes.forEach(n=>skinDoc.addJoint(n));
const body=doc.createNode('Troops').setMesh(doc.createMesh('User supplied soldier').addPrimitive(primitive)).setSkin(skinDoc);
doc.createScene('FRONTLINES Soldier').addChild(nodes[0]).addChild(body);
for(const [name,duration] of Object.entries(CLIPS)){
  const frames=Math.max(2,Math.round(duration*24)),times=Array.from({length:frames+1},(_,i)=>i/frames*duration);
  const input=accessor(`${name} seconds`,'SCALAR',new Float32Array(times)),animation=doc.createAnimation(name);
  const rotations=JOINTS.map(()=>[] as number[]),translations=JOINTS.map(()=>[] as number[]);
  times.forEach(t=>{poseRig(rig.bones,name as SoldierClip,t);rig.bones.forEach((b,i)=>{rotations[i].push(...b.quaternion.toArray());translations[i].push(...b.position.toArray());});});
  for(let i=0;i<nodes.length;i++)for(const [path,values,type] of [['rotation',rotations[i],'VEC4'],['translation',translations[i],'VEC3']] as const){
    const sampler=doc.createAnimationSampler().setInput(input).setOutput(accessor(`${name} ${JOINTS[i][0]} ${path}`,type,new Float32Array(values))).setInterpolation('LINEAR');
    animation.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes[i]).setTargetPath(path).setSampler(sampler));
  }
}
doc.getRoot().setExtras({source:'User supplied troops OBJ',sourceSha256:createHash('sha256').update(source).digest('hex'),metres:1,height:1.8,forward:'+Z',rigVersion:1});
await doc.transform(weld(),resample(),dedup(),prune());
const io=new NodeIO(),out=new URL('../src/assets/soldier.glb',import.meta.url);await io.write(fileURLToPath(out),doc);
const bytes=await readFile(out);
await writeFile(new URL('../assets/soldier-manifest.json',import.meta.url),JSON.stringify({source:'source/troops.obj',sourceSha256:createHash('sha256').update(source).digest('hex'),runtime:'src/assets/soldier.glb',bytes:bytes.length,triangles:count/3,bones:JOINTS.length,clips:Object.keys(CLIPS),height:1.8,forward:'+Z',materials:1,textures:0},null,2)+'\n');
console.log(`Soldier: ${count/3} triangles, ${JOINTS.length} bones, ${Object.keys(CLIPS).length} clips, ${bytes.length} bytes.`);
