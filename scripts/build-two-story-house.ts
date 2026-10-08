/** Prepare the supplied closed house as bounded dressing for production's
 * enterable two-floor building volumes. Source doors/glass never become walls. */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {Document,NodeIO} from '@gltf-transform/core';
import {weld,dedup,prune} from '@gltf-transform/functions';

const source=await readFile(new URL('../assets/source/2-story-house.obj',import.meta.url));
const object=new OBJLoader().parse(source.toString()),g=(object.children[0] as THREE.Mesh).geometry,p=g.getAttribute('position');
const roof:number[]=[],stone:number[]=[],shutter:number[]=[],ridgeZ=-.008,rise=.666,slope=.82;
for(let i=0;i<p.count;i+=3){
  const v=Array.from({length:3},(_,j)=>new THREE.Vector3().fromBufferAttribute(p,i+j));
  const c=v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1/3);
  const chimney=c.x>.68&&c.x<.94&&c.z>0&&c.z<.29&&c.y>.5;
  if(!chimney&&c.y>.025&&c.y>rise-Math.abs(c.z-ridgeZ)*slope-.04){
    for(const q of v)roof.push(THREE.MathUtils.clamp((q.x+.004)/.995,-1,1),THREE.MathUtils.clamp((q.y-(rise-Math.abs(q.z-ridgeZ)*slope))*2.4,.012,.14),THREE.MathUtils.clamp((q.z-ridgeZ)/.723,-1,1));
  }
  // Lower front-right sill and open shutter: small reusable surface samples.
  if(c.x>.30&&c.x<.80&&c.y>-.70&&c.y<-.63&&c.z<-.62)for(const q of v)stone.push(q.x,q.y,q.z);
  if(c.x>.25&&c.x<.39&&c.y>-.60&&c.y<-.39&&c.z<-.625)for(const q of v)shutter.push(q.x,q.y,q.z);
}
const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Supplied two-story house surface kit');
const material=doc.createMaterial('Weathered house surfaces').setRoughnessFactor(.96);
const parts=[['houseRoof',roof],['houseStone',stone],['houseShutter',shutter]] as const;
for(const [name,data] of parts){
  if(data.length<45)throw Error(`Extraction empty: ${name}`);
  if(name!=='houseRoof'){
    const box=new THREE.Box3();for(let i=0;i<data.length;i+=3)box.expandByPoint(new THREE.Vector3(data[i],data[i+1],data[i+2]));
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    for(let i=0;i<data.length;i+=3)for(let k=0;k<3;k++)data[i+k]=(data[i+k]-center.getComponent(k))/size.getComponent(k);
  }
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(data,3));toCreasedNormals(geometry,Math.PI/4);
  const attr=(label:string,values:ArrayLike<number>)=>doc.createAccessor(label).setType('VEC3').setArray(new Float32Array(values)).setBuffer(buffer);
  const primitive=doc.createPrimitive().setAttribute('POSITION',attr(name,data)).setAttribute('NORMAL',attr(name+' normals',geometry.getAttribute('normal').array)).setMaterial(material);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));geometry.dispose();
}
const manifest={version:1,source:'source/2-story-house.obj',sourceSha256:createHash('sha256').update(source).digest('hex'),sourceTriangles:p.count/3,
  runtime:'src/assets/two-story-house.glb',roofCoordinates:'XZ normalized to eaves; Y is metre-scale relief',trimBounds:[-.5,.5],
  parts:parts.map(([name,data])=>({name,triangles:data.length/9})),materials:1,textures:0,
  adaptation:'Source roof, sill and shutter surfaces fitted to shared two-floor building volumes. Closed facade, glass and doors are not imported as gameplay geometry.'};
doc.getRoot().setExtras(manifest);await doc.transform(weld(),dedup(),prune());
const target=new URL('../src/assets/two-story-house.glb',import.meta.url);await new NodeIO().write(fileURLToPath(target),doc);const bytes=(await readFile(target)).length;
await writeFile(new URL('../assets/two-story-house-manifest.json',import.meta.url),JSON.stringify({...manifest,bytes},null,2)+'\n');g.dispose();
console.log(JSON.stringify({...manifest,bytes},null,2));
