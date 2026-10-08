/** Adapt the supplied closed exterior into dressing for the shared, enterable
 * building volumes. Never ship a second set of fake doors or window glass. */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {Document,NodeIO} from '@gltf-transform/core';
import {weld,dedup,prune} from '@gltf-transform/functions';

const source=await readFile(new URL('../assets/source/small-one-floor-house.obj',import.meta.url));
const object=new OBJLoader().parse(source.toString()),g=(object.children[0] as THREE.Mesh).geometry,p=g.getAttribute('position');
const roof:number[]=[],stone:number[]=[],ridgeZ=-.053,sourceRise=.627,sourceSlope=.69;
for(let i=0;i<p.count;i+=3){
  const v=Array.from({length:3},(_,j)=>new THREE.Vector3().fromBufferAttribute(p,i+j));
  const c=v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1/3);
  const chimney=c.x<-.68&&c.y>.53&&Math.abs(c.z+.075)<.17;
  const roofPlane=sourceRise-Math.abs(c.z-ridgeZ)*sourceSlope;
  // Tile courses, ridge and eave silhouette, excluding solid gable/wall faces.
  if(!chimney&&c.y>-.08&&c.y>roofPlane-.065){
    for(const q of v){
      const x=THREE.MathUtils.clamp((q.x+.0077)/.9808,-1,1),z=THREE.MathUtils.clamp((q.z-ridgeZ)/.933,-1,1);
      const relief=THREE.MathUtils.clamp((q.y-(sourceRise-Math.abs(q.z-ridgeZ)*sourceSlope))*2.4,.012,.14);
      roof.push(x,relief,z);
    }
  }
  // One rough quoin from the source's front-right corner, not a closed window.
  if(c.x>.82&&c.z>.70&&c.y>-.66&&c.y<-.53)for(const q of v)stone.push(q.x,q.y,q.z);
}
if(roof.length<900||stone.length<45)throw Error('House extraction is unexpectedly empty.');
// Box-normalized carved stone: it can dress an existing lintel or corner block
// without extending the authoritative collision envelope or closing an aperture.
const sg=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(stone,3));sg.computeBoundingBox();
const bounds=sg.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
for(let i=0;i<stone.length;i+=3)for(let k=0;k<3;k++)stone[i+k]=(stone[i+k]-center.getComponent(k))/size.getComponent(k);
sg.dispose();
const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Supplied cottage surface kit');
const material=doc.createMaterial('Weathered cottage').setRoughnessFactor(.96);
for(const [name,data] of [['houseRoof',roof],['houseStone',stone]] as const){
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(data,3));toCreasedNormals(geometry,Math.PI/4);
  const attr=(label:string,values:ArrayLike<number>)=>doc.createAccessor(label).setType('VEC3').setArray(new Float32Array(values)).setBuffer(buffer);
  const primitive=doc.createPrimitive().setAttribute('POSITION',attr(name,data)).setAttribute('NORMAL',attr(name+' normals',geometry.getAttribute('normal').array)).setMaterial(material);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));geometry.dispose();
}
const manifest={version:1,source:'source/small-one-floor-house.obj',sourceSha256:createHash('sha256').update(source).digest('hex'),sourceTriangles:p.count/3,
  runtime:'src/assets/house.glb',roofCoordinates:'XZ normalized to eaves; Y is metre-scale relief',stoneBounds:[-.5,.5],
  parts:[{name:'houseRoof',triangles:roof.length/9},{name:'houseStone',triangles:stone.length/9}],materials:1,textures:0,
  adaptation:'Source roof courses and carved stone, fitted to production roofs and trim. Closed facade, doors, glass and interior are not collision geometry.'};
doc.getRoot().setExtras(manifest);await doc.transform(weld(),dedup(),prune());
const target=new URL('../src/assets/house.glb',import.meta.url);await new NodeIO().write(fileURLToPath(target),doc);const bytes=(await readFile(target)).length;
await writeFile(new URL('../assets/house-manifest.json',import.meta.url),JSON.stringify({...manifest,bytes},null,2)+'\n');g.dispose();
console.log(`House: ${manifest.sourceTriangles} source triangles; roof ${roof.length/9}, stone ${stone.length/9}; ${bytes} bytes.`);
