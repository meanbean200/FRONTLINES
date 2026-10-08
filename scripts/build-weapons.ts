/** Reproducible, non-destructive preparation of the user's equipment sources. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {Document,NodeIO} from '@gltf-transform/core';
import {dedup,prune,weld} from '@gltf-transform/functions';

const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('FRONTLINES supplied equipment');
const material=doc.createMaterial('Worn wood painted steel and blued metal').setRoughnessFactor(.78).setMetallicFactor(.18);
const manifest:{source:string;sourceSha256:string;triangles:number}[]=[];
const point=new THREE.Vector3(),color=new THREE.Color();
function mesh(name:string,positions:number[],colors:number[]){
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));toCreasedNormals(geometry,Math.PI/3);
  const attr=(name:string,values:ArrayLike<number>)=>doc.createAccessor(name).setType('VEC3').setArray(new Float32Array(values)).setBuffer(buffer);
  const primitive=doc.createPrimitive().setAttribute('POSITION',attr(`${name} positions`,positions)).setAttribute('NORMAL',attr(`${name} normals`,geometry.getAttribute('normal').array)).setAttribute('COLOR_0',attr(`${name} colours`,colors)).setMaterial(material);
  const node=doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive));scene.addChild(node);geometry.dispose();return node;
}
const sockets:Record<string,unknown>={};
for(const name of ['rifle','mg','cannon','smg','bar','mg-mount']){
  const source=await readFile(new URL(`../assets/source/${name}.obj`,import.meta.url)),obj=new OBJLoader().parse(source.toString()),geometry=(obj.children[0] as THREE.Mesh).geometry;
  const p=geometry.getAttribute('position');geometry.computeBoundingBox();const bounds=geometry.boundingBox!;
  manifest.push({source:`source/${name}.obj`,sourceSha256:createHash('sha256').update(source).digest('hex'),triangles:p.count/3});
  const length=name==='cannon'?6.4:name==='mg-mount'?1.4:name==='smg'?.82:name==='bar'?1.20:name==='rifle'?1.10:1.23;
  const scale=length/((name==='cannon'||name==='smg'||name==='bar')?bounds.max.z-bounds.min.z:bounds.max.x-bounds.min.x);
  // +Z fire; preserve existing muzzle contracts (.29 for SMG, .6 for rifle/MG).
  const cannonTransform=new THREE.Matrix4().makeRotationX(.028);
  let cannonFloor=Infinity;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(cannonTransform);cannonFloor=Math.min(cannonFloor,point.y);}
  function transform(x:number,y:number,z:number,part=name){
    if(name==='cannon'){point.set(x,y,z).applyMatrix4(cannonTransform);return [(point.x+.004)*scale,(point.y-cannonFloor)*scale,(point.z-.34)*scale];}
    if(name==='smg')return [(x+.0032)*scale,(y-.153)*scale,.29+(z-bounds.max.z)*scale];
    if(name==='bar')return [-(x+.0035)*scale,(y-.142)*scale,.6+(bounds.min.z-z)*scale];
    if(name==='mg-mount')return [-(z+.335)*scale,(y-(part==='mgMountHead'?bounds.max.y:bounds.min.y))*scale-(part==='mgMountHead'?.07:0),(x-.04)*scale-(part==='mgMountHead'?.18:0)];
    return [-(z+(name==='rifle'?.027:0))*scale,(y-(name==='rifle'?.103:.095))*scale,.6+(x-bounds.max.x)*scale];
  }
  const parts=new Map<string,{p:number[];c:number[]}>();
  for(let i=0;i<p.count;i+=3){
    const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
    let part=name,tint=0x414842;
    if(name==='rifle'){
      const stock=x<-.56&&y<.068,forestock=x>-.3&&x<.79&&y<.098;
      tint=stock||forestock?0x795737:y>.135?0x5c645d:0x353d39;
    }else if(name==='mg'){
      if(x>.61&&y<.035){part=z<0?'mgLegR':'mgLegL';}
      tint=x<-.72||(x<-.42&&y<-.07)?0x65503a:x>.06&&y<.11?0x39413c:0x505850;
    }else if(name==='smg'){
      const stock=z<-.46&&y<.081,pistolGrip=z>-.36&&z<-.11&&y<.035,forestock=z>.20&&z<.58&&y<.135;
      tint=stock||pistolGrip||forestock?0x795737:y>.19?0x60665e:y<.05?0x353d39:0x49514b;
    }else if(name==='bar'){
      if(z<-.60&&y<.084)part=x>-.0035?'barLegL':'barLegR';
      const stock=z>.46&&y<.13,grip=z>.20&&z<.46&&y<.03,forestock=z>-.59&&z<-.10&&y<.105;
      tint=stock||grip||forestock?0x795737:part!=='bar'?0x505850:y>.185?0x62695f:y<.025?0x353d39:0x454d47;
    }else if(name==='mg-mount'){
      part=y>-.085?'mgMountHead':'mgMountBase';
      tint=y<-.345?0x424b3e:y>-.03&&x>.30?0x656d58:part==='mgMountHead'?0x4c5748:0x59634e;
    }else{
      const barrel=Math.abs(x)<.065&&z>.055&&Math.abs(y-(.09+.215*(z-.4)))<.053;
      const wheel=Math.abs(x)>.235&&z>.08&&z<.61&&y<.19;
      part=barrel?'cannonBarrel':wheel?(x<0?'cannonWheelL':'cannonWheelR'):'cannonCarriage';
      const radius=Math.hypot(y+.028,z-.34);
      tint=barrel?(z>.87?0x303932:0x586149):wheel?(radius>.204?0x343d35:radius<.067?0x72765b:0x777356):y>.19?0x707857:0x5b6549;
    }
    if(!parts.has(part))parts.set(part,{p:[],c:[]});const target=parts.get(part)!;
    // Per-face material regions avoid rainbow interpolation across wood/steel edges.
    color.setHex(tint);
    for(let j=0;j<3;j++){target.p.push(...transform(p.getX(i+j),p.getY(i+j),p.getZ(i+j),part));target.c.push(color.r,color.g,color.b);}
  }
  const nodes=new Map<string,ReturnType<typeof mesh>>();
  for(const [part,data] of parts)nodes.set(part,mesh(part,data.p,data.c));
  if(name==='rifle'||name==='mg'){
    sockets[name]={muzzle:[0,0,.6],grip:transform(name==='rifle'?-.51:-.52,name==='rifle'?-.055:-.09,name==='rifle'?-.025:0),length:name==='rifle'?1.1:1.23};
    if(name==='mg')sockets.mgBipods={left:transform(.70,.04,.028),right:transform(.70,.04,-.028)};
  }else if(name==='smg'){
    sockets.smg={muzzle:[0,0,.29],grip:transform(-.0032,-.077,-.24),length};
  }else if(name==='bar'){
    sockets.bar={muzzle:[0,0,.6],grip:transform(-.0035,-.025,.35),length};
    sockets.barBipods={left:transform(.031,.084,-.699),right:transform(-.038,.084,-.699)};
  }else if(name==='mg-mount'){
    sockets.mgMount={footprint:length,baseNeck:transform(.04,-.085,-.335,'mgMountBase'),headNeck:transform(.04,-.085,-.335,'mgMountHead')};
  }else{
    const pivot=transform(0,.069,.32),muzzle=transform(0,.214,.982),elevation=Math.atan2(muzzle[1]-pivot[1],muzzle[2]-pivot[2]);
    sockets.cannon={pivot,muzzle,elevation,length:6.4,wheelLeft:transform(-.30,-.028,.34),wheelRight:transform(.30,-.028,.34)};
    // Barrel-local pivot supports elevation and recoil without moving wheels/shield.
    const node=nodes.get('cannonBarrel')!,a=node.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!;
    const v=a.getArray()!;for(let i=0;i<v.length;i++)v[i]-=pivot[i%3];node.setTranslation(pivot as [number,number,number]);
    const times=[0,.035,.10,.25,.55,1.2],axis=new THREE.Vector3(0,Math.sin(elevation),Math.cos(elevation));
    const recoil=times.flatMap(t=>{const r=t===0||t===1.2?0:.3*(1-Math.exp(-t*65))*Math.exp(-t*4);return pivot.map((n,i)=>n-axis.getComponent(i)*r)});
    const input=doc.createAccessor('Discharge seconds').setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
    const output=doc.createAccessor('Recoil translation').setType('VEC3').setArray(new Float32Array(recoil)).setBuffer(buffer);
    const sampler=doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
    doc.createAnimation('cannon_discharge').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(sampler));
  }
  geometry.dispose();
}
doc.getRoot().setExtras({version:1,metres:1,forward:'+Z',sockets,sources:manifest});
await doc.transform(weld(),dedup(),prune());
const out=new URL('../src/assets/weapons.glb',import.meta.url);await new NodeIO().write(fileURLToPath(out),doc);
const bytes=(await readFile(out)).length;
await writeFile(new URL('../assets/weapons-manifest.json',import.meta.url),JSON.stringify({version:1,runtime:'src/assets/weapons.glb',bytes,materials:1,textures:0,sources:manifest,sockets},null,2)+'\n');
console.log(`Equipment: ${manifest.reduce((n,m)=>n+m.triangles,0)} source triangles, ${bytes} bytes, one shared material.`);
