/** Repeatable preparation; original untextured user mesh stays untouched. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {Document,NodeIO} from '@gltf-transform/core';
import {weld,dedup,prune} from '@gltf-transform/functions';

const source=await readFile(new URL('../assets/source/truck.obj',import.meta.url));
const object=new OBJLoader().parse(source.toString()),geometry=(object.children[0] as THREE.Mesh).geometry;
geometry.computeBoundingBox();const bounds=geometry.boundingBox!,scale=6.5/(bounds.max.z-bounds.min.z),cx=(bounds.min.x+bounds.max.x)/2,cz=(bounds.min.z+bounds.max.z)/2;
const transform=(x:number,y:number,z:number)=>[(x-cx)*scale,(y-bounds.min.y)*scale,(z-cz)*scale] as [number,number,number];
// Source has no named parts. These six measured axle centres and bounded tyre
// regions isolate road wheels, leaving fenders/chassis on the static body.
const axles=[.723,-.286,-.653],wheelY=-.253,radius=.147*scale;
const pivots=([-1,1] as const).flatMap(side=>axles.map(z=>transform(cx+side*.253,wheelY,z)));
const parts=Array.from({length:7},()=>({positions:[] as number[],colors:[] as number[]})),p=geometry.getAttribute('position'),color=new THREE.Color();
for(let i=0;i<p.count;i+=3){
  const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
  const axle=axles.reduce((a,v,j)=>Math.abs(v-z)<Math.abs(axles[a]-z)?j:a,0),r=Math.hypot(y-wheelY,z-axles[axle]);
  const wheel=Math.abs(x-cx)>.184&&r<.154&&y<-.104,index=wheel?1+(x<cx?0:3)+axle:0;
  let tint=0x626b49;
  if(wheel)tint=r>.088?0x343732:0x737b58;
  else if(z<.115&&y>.075)tint=0x8b8363; // Weathered canvas over the cargo bed.
  else if(z>.435&&z<.54&&y>.115&&y<.245&&Math.abs(x-cx)<.207)tint=0x3f5350; // Cab glazing.
  else if(Math.abs(x-cx)>.198&&z>.17&&z<.41&&y>.118&&y<.223)tint=0x455751;
  else if(z>.90&&y>-.21&&y<-.042&&Math.abs(x-cx)<.18)tint=0x394439;
  else if(z>.925&&y>-.086&&y<-.02&&Math.abs(x-cx)>.22&&Math.abs(x-cx)<.278)tint=0xb1ab8a;
  else if(y<-.192)tint=0x3d4435;
  else if(z<.11&&y<.045&&y>-.12)tint=0x727859;
  color.setHex(tint);const out=parts[index],pivot=index?pivots[index-1]:[0,0,0];
  for(let j=0;j<3;j++){const v=transform(p.getX(i+j),p.getY(i+j),p.getZ(i+j));out.positions.push(...v.map((n,k)=>n-pivot[k]));out.colors.push(color.r,color.g,color.b);}
}
const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Supplied six wheel cargo lorry');
const material=doc.createMaterial('Olive paint canvas rubber and dull glass').setRoughnessFactor(.88).setMetallicFactor(.08);
for(const [i,data] of parts.entries()){
  if(!data.positions.length)throw Error(`Truck part ${i} has no geometry.`);
  const name=i?`truckWheel${i-1}`:'truckBody',g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));toCreasedNormals(g,Math.PI/3);
  const attr=(name:string,a:ArrayLike<number>)=>doc.createAccessor(name).setType('VEC3').setArray(new Float32Array(a)).setBuffer(buffer);
  const primitive=doc.createPrimitive().setAttribute('POSITION',attr(`${name} positions`,data.positions)).setAttribute('NORMAL',attr(`${name} normals`,g.getAttribute('normal').array)).setAttribute('COLOR_0',attr(`${name} colours`,data.colors)).setMaterial(material);
  const node=doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive));if(i)node.setTranslation(pivots[i-1]);scene.addChild(node);g.dispose();
}
const manifest={version:1,source:'source/truck.obj',sourceSha256:createHash('sha256').update(source).digest('hex'),runtime:'src/assets/truck.glb',metres:1,forward:'+Z',length:6.5,triangles:p.count/3,materials:1,textures:0,wheelRadius:radius,wheelPivots:pivots,parts:parts.map((d,i)=>({name:i?`truckWheel${i-1}`:'truckBody',triangles:d.positions.length/9}))};
doc.getRoot().setExtras(manifest);await doc.transform(weld(),dedup(),prune());
const target=new URL('../src/assets/truck.glb',import.meta.url);await new NodeIO().write(fileURLToPath(target),doc);const bytes=(await readFile(target)).length;
await writeFile(new URL('../assets/truck-manifest.json',import.meta.url),JSON.stringify({...manifest,bytes},null,2)+'\n');geometry.dispose();
console.log(`Truck: ${manifest.triangles} triangles, six rotating wheels, ${bytes} bytes.`);
