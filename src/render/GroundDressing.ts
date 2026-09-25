import * as THREE from 'three';
import {CHUNK_SIZE} from '../core/types';
import {hash2D} from '../core/random';
import {excavationBoundsKey} from '../core/TrenchGeometry';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {VisualQuality} from './VisualQuality';

/** Short ground growth, never a new obstacle/concealment volume. World anchored,
 * pooled by 32 m tiles and generated one tile per frame. No army/state scans. */
export function dressingSites(terrain:TerrainSystem,tx:number,tz:number){
  const sites:{x:number;y:number;z:number;angle:number;scale:number;color:number}[]=[];
  const floor=(x:number,z:number)=>{
    const step=CHUNK_SIZE/32,a=Math.floor(x/step)*step,b=Math.floor(z/step)*step,u=(x-a)/step,v=(z-b)/step;
    const corner=(x:number,z:number)=>{
      const coarse=CHUNK_SIZE/8;
      if(Math.abs(x/CHUNK_SIZE-Math.round(x/CHUNK_SIZE))<1e-7){const a=Math.floor(z/coarse)*coarse,t=(z-a)/coarse;return terrain.heightAt(x,a)*(1-t)+terrain.heightAt(x,a+coarse)*t;}
      if(Math.abs(z/CHUNK_SIZE-Math.round(z/CHUNK_SIZE))<1e-7){const a=Math.floor(x/coarse)*coarse,t=(x-a)/coarse;return terrain.heightAt(a,z)*(1-t)+terrain.heightAt(a+coarse,z)*t;}
      return terrain.heightAt(x,z);
    };
    const h00=corner(a,b),h10=corner(a+step,b),h01=corner(a,b+step),h11=corner(a+step,b+step);
    return u+v<=1?h00+(h10-h00)*u+(h01-h00)*v:h11+(h01-h11)*(1-u)+(h10-h11)*(1-v);
  };
  for(let ix=0;ix<16;ix++)for(let iz=0;iz<16;iz++){
    const gx=tx*16+ix,gz=tz*16+iz,h=hash2D(gx,gz,terrain.seed+204);
    if(h<.25)continue;
    const x=tx*32+ix*2+hash2D(gx,gz,31)*1.8,z=tz*32+iz*2+hash2D(gx,gz,44)*1.8;
    if(Math.abs(x)>1998||Math.abs(z)>1998||Math.abs(terrain.deformationAt(x,z))>.025||terrain.distanceToRoad(x,z)<8||terrain.groundTypeAt(x,z)==='river'||terrain.buildingAt({x,z})!==undefined)continue;
    // Keep threshold/door approaches clear and allow their worn soil to read.
    if(terrain.buildings.some(b=>Math.abs(b.x-x)<b.width*.5+3&&Math.abs(b.z-z)<b.depth*.5+5))continue;
    sites.push({x,y:floor(x,z)-.025,z,angle:h*6.28,scale:.55+h*.45,color:terrain.forestValueAt(x,z)>.57?0x666b46:[0x7d8353,0x919064,0x626c42][Math.floor(h*17)%3]});
  }
  return sites;
}

export class GroundDressing {
  readonly group=new THREE.Group();
  private tiles=new Map<string,{mesh:THREE.InstancedMesh;signature:string;revision:number;tx:number;tz:number}>();
  private geometry=new THREE.BufferGeometry();
  private material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide});
  private range={value:120};private quality:VisualQuality='balanced';private last=-Infinity;
  constructor(private terrain:TerrainSystem){
    const vertices:number[]=[];
    for(let i=0;i<5;i++){
      const a=i*2.399,x=Math.cos(a)*.11,z=Math.sin(a)*.11,w=.035,y=.10+i*.016;
      vertices.push(x-w,0,z,x+w,0,z,x+Math.sin(a)*.06,y,z+Math.cos(a)*.05);
    }
    this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));this.geometry.computeVertexNormals();
    this.material.onBeforeCompile=s=>{
      s.uniforms.dressingRange=this.range;s.fragmentShader='uniform float dressingRange;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
        float fade=1.-smoothstep(dressingRange*.65,dressingRange,length(vViewPosition));
        if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>fade)discard;
      `);
    };
  }
  setQuality(q:VisualQuality){this.quality=q;this.range.value=q==='high'?145:75;this.group.visible=q!=='low';}
  reset(){for(const t of this.tiles.values())t.mesh.dispose();this.tiles.clear();this.group.clear();}
  update(x:number,z:number,zoom:number,now:number){
    if(this.quality==='low'||zoom>240){this.group.visible=false;return;}this.group.visible=true;
    const range=this.quality==='high'?125:60,tx=Math.floor(x/32),tz=Math.floor(z/32),radius=Math.ceil(range/32),wanted=new Set<string>();
    let built=now-this.last>=30;
    const pending:{x:number;z:number;d:number}[]=[];
    for(let ix=tx-radius;ix<=tx+radius;ix++)for(let iz=tz-radius;iz<=tz+radius;iz++)if(Math.hypot(ix*32+16-x,iz*32+16-z)<range+24)pending.push({x:ix,z:iz,d:Math.hypot(ix-tx,iz-tz)});
    pending.sort((a,b)=>a.d-b.d);
    for(const p of pending){
      const key=p.x+','+p.z;wanted.add(key);
      const old=this.tiles.get(key);
      if(old?.revision===this.terrain.revision)continue;
      const signature=this.terrain.snapshot.trenches.map(t=>excavationBoundsKey(t,p.x*32,p.z*32,32)).filter(Boolean).join('|')+':'+this.terrain.snapshot.craters.filter(c=>Math.hypot(c.x-(p.x*32+16),c.z-(p.z*32+16))<c.radius+25).map(c=>c.id).join(',');
      if(old?.signature===signature){old.mesh.visible=true;old.revision=this.terrain.revision;continue;}
      if(old)old.mesh.visible=false;if(!built)continue;built=false;this.last=now;
      if(old){old.mesh.dispose();this.group.remove(old.mesh);}
      const sites=dressingSites(this.terrain,p.x,p.z),mesh=new THREE.InstancedMesh(this.geometry,this.material,sites.length),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3(),color=new THREE.Color();
      sites.forEach((s,i)=>{position.set(s.x,s.y,s.z);scale.setScalar(s.scale);rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,s.angle);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(s.color));});
      mesh.receiveShadow=true;this.group.add(mesh);this.tiles.set(key,{mesh,signature,revision:this.terrain.revision,tx:p.x,tz:p.z});
    }
    for(const [key,t] of this.tiles)if(!wanted.has(key)){this.group.remove(t.mesh);t.mesh.dispose();this.tiles.delete(key);}
  }
}
