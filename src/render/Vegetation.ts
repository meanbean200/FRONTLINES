import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {treeCleared,type TreeSite} from '../terrain/WorldFeatures';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {hash2D} from '../core/random';

/** Original local alpha foliage. No downloaded textures or DOM/canvas dependency. */
function foliageTexture(family:number):THREE.DataTexture{
  const size=256,pixels=new Uint8Array(size*size*4);
  for(let leaf=0;leaf<1100;leaf++){
    const angle=hash2D(leaf,family,73)*Math.PI*2,r=Math.sqrt(hash2D(leaf,family,83))*110;
    const cx=128+Math.cos(angle)*r,cy=128+Math.sin(angle)*r,rx=1.8+hash2D(leaf,family,91)*2.8,ry=family===1?rx*1.35:rx*.8;
    const shade=.72+hash2D(leaf,family,102)*.28;
    for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(size,cy+ry+1);y++)for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(size,cx+rx+1);x++){
      const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d>1)continue;const i=(y*size+x)*4;
      pixels[i]=Math.round(180*shade);pixels[i+1]=Math.round(191*shade);pixels[i+2]=Math.round(145*shade);pixels[i+3]=Math.max(pixels[i+3],Math.min(255,(1-d)*1200));
    }
  }
  const texture=new THREE.DataTexture(pixels,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
function crownGeometry(family:number,detail:boolean):THREE.BufferGeometry{
  const parts:THREE.BufferGeometry[]=[],count=detail?[36,32,28][family]:12;
  for(let i=0;i<count;i++){
    const angle=i*2.399+family,y=-.72+1.44*(i+.5)/count,reach=Math.sqrt(1-y*y)*.65;
    const g=new THREE.PlaneGeometry(detail?.9:1.35,detail?1.0:1.4);
    g.rotateY(angle);g.rotateX((hash2D(i,family,37)-.5)*1.8);
    g.translate(Math.cos(angle)*reach,y,Math.sin(angle)*reach);parts.push(g);
  }
  const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());
  const positions=result.attributes.position,normals=result.attributes.normal,n=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){n.set(positions.getX(i),positions.getY(i)*.7+.3,positions.getZ(i)).normalize();normals.setXYZ(i,n.x,n.y,n.z);}
  return result;
}
function foliageMaterial(map:THREE.Texture):THREE.MeshStandardMaterial{
  const fade={value:1},material=new THREE.MeshStandardMaterial({map,alphaTest:.4,roughness:1,side:THREE.DoubleSide,emissive:0x23291b,emissiveIntensity:.35});
  material.userData.fade=fade;
  material.onBeforeCompile=shader=>{shader.uniforms.foliageFade=fade;shader.fragmentShader='uniform float foliageFade;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
    if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>foliageFade)discard;
  `);shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal *= faceDirection;');};
  return material;
}
const families=[0,1,2].map(family=>{
  const map=foliageTexture(family);
  return {near:crownGeometry(family,true),far:crownGeometry(family,false),map,depth:new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map,alphaTest:.4,side:THREE.DoubleSide})};
});
const trunkParts=[new THREE.CylinderGeometry(.17,.35,1,7).translate(0,.5,0)];
for(let i=0;i<5;i++){const branch=new THREE.CylinderGeometry(.027,.09,1.5,5),a=new THREE.Vector3(0,.5+i*.065,0),b=new THREE.Vector3(Math.cos(i*2.4)*1.4,.83+i*.025,Math.sin(i*2.4)*1.4),direction=b.clone().sub(a);branch.scale(1,direction.length()/1.5,1);branch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));branch.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);trunkParts.push(branch);}
const trunkGeometry=mergeGeometries(trunkParts);trunkParts.forEach(g=>g.dispose());
const trunkMaterial=new THREE.MeshStandardMaterial({color:0x655b4c,roughness:1});
interface CrownPair {near:THREE.InstancedMesh;far:THREE.InstancedMesh;original:Float32Array}

export function createVegetation(terrain:TerrainSystem,x0:number,z0:number):THREE.Group{
  const group=new THREE.Group(),trees=terrain.objects.trees(x0,z0),pairs:CrownPair[]=[];
  const trunks=new THREE.InstancedMesh(trunkGeometry,trunkMaterial,trees.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3(),color=new THREE.Color();
  trunks.castShadow=true;
  for(let family=0;family<3;family++){
    const capacity=Math.ceil(trees.length/3)*3,asset=families[family],near=new THREE.InstancedMesh(asset.near,foliageMaterial(asset.map),capacity),far=new THREE.InstancedMesh(asset.far,foliageMaterial(asset.map),capacity);
    near.count=far.count=0;
    for(const mesh of [near,far]){mesh.customDepthMaterial=asset.depth;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.disposableMaterial=true;}
    pairs.push({near,far,original:new Float32Array()});group.add(near,far);
  }
  trees.forEach((tree,i)=>{
    const h=terrain.heightAt(tree.x,tree.z),family=i%3,pair=pairs[family];
    p.set(tree.x,h,tree.z);s.set(1,tree.size*1.8,1);q.setFromAxisAngle(new THREE.Vector3(0,1,0),i*2.399);m.compose(p,q,s);trunks.setMatrixAt(i,m);
    for(let layer=0;layer<3;layer++){
      const angle=layer*2.4+i;p.set(tree.x+Math.cos(angle)*tree.size*.45,h+tree.size*(1.8+layer*.25),tree.z+Math.sin(angle)*tree.size*.45);
      s.set(tree.size*(.85-layer*.1),tree.size*(1.05-layer*.13),tree.size*(.85-layer*.1));q.setFromAxisAngle(new THREE.Vector3(0,1,0),angle);m.compose(p,q,s);
      const n=pair.near.count++;pair.far.count++;color.setHex([0x909568,0x777f59,0xa2a077,0x818b61,0x697957][i%5]);color.multiplyScalar(.84+layer*.08);
      for(const mesh of [pair.near,pair.far]){mesh.setMatrixAt(n,m);mesh.setColorAt(n,color);}
    }
  });
  group.add(trunks);for(const pair of pairs)pair.original=new Float32Array(pair.near.instanceMatrix.array);
  group.userData.trees=trees;group.userData.pairs=pairs;group.userData.trunks=trunks;group.userData.originalTrunks=trunks.instanceMatrix.array.slice();group.userData.cleared=new Set<number>();
  refreshVegetationClearance(group,terrain);setVegetationDetail(group,1000,600);return group;
}
export function setVegetationDetail(group:THREE.Group,distance:number,range:number):void{
  const fade=Math.max(0,Math.min(1,(range+90-distance)/180));
  for(const pair of group.userData.pairs as CrownPair[]){pair.near.visible=fade>0;pair.far.visible=fade<1;(pair.near.material as THREE.Material).userData.fade.value=fade;(pair.far.material as THREE.Material).userData.fade.value=1-fade;pair.near.castShadow=fade>=.5;pair.far.castShadow=fade<.5;}
}
export function refreshVegetationClearance(group:THREE.Group,terrain:TerrainSystem):void{
  const trees=group.userData.trees as TreeSite[],cleared=group.userData.cleared as Set<number>,pairs=group.userData.pairs as CrownPair[],trunks=group.userData.trunks as THREE.InstancedMesh,m=new THREE.Matrix4();let changed=false;
  trees.forEach((tree,i)=>{const cut=treeCleared(terrain,tree);if(cut===cleared.has(i))return;changed=true;
    if(cut)cleared.add(i);else cleared.delete(i);const pair=pairs[i%3],index=Math.floor(i/3)*3;
    if(cut)m.makeScale(0,0,0);else m.fromArray(group.userData.originalTrunks,i*16);trunks.setMatrixAt(i,m);
    for(let layer=0;layer<3;layer++){if(!cut)m.fromArray(pair.original,(index+layer)*16);for(const mesh of [pair.near,pair.far])mesh.setMatrixAt(index+layer,m);}
  });
  if(changed){trunks.instanceMatrix.needsUpdate=true;for(const pair of pairs)for(const mesh of [pair.near,pair.far])mesh.instanceMatrix.needsUpdate=true;}
}
