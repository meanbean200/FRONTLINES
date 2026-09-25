import * as THREE from 'three';
import { hash2D } from '../core/random';
import { CHUNK_SIZE } from '../core/types';
import { TerrainSystem, smoothStep } from '../terrain/TerrainSystem';
import {intersectsCrossing,nearestRoad} from '../terrain/WorldLayout';
import {doorPoint} from '../terrain/BuildingGeometry';
export {groundMaterial} from './TerrainMaterials';

const fields = [0x62734c, 0x727647, 0x8a8054, 0x526747, 0x746747, 0x667348].map(hex => new THREE.Color(hex));
const woodland = new THREE.Color(0x3b5037);
const earth = new THREE.Color(0x715a40);
const floor = new THREE.Color(0x302a23);

/** Refines excavation and the three physical causeways to sub-meter spacing. */
export function createGroundGeometry(terrain: TerrainSystem, x0: number, z0: number, divisions: number, refine=true): THREE.BufferGeometry {
  const vertices: number[] = [], colors: number[] = [], normals: number[] = [], indices: number[] = [], cover:number[]=[];
  const size = CHUNK_SIZE / divisions;
  const color = new THREE.Color();
  const yards=terrain.buildings.filter(b=>b.x+b.width/2+60>=x0&&b.x-b.width/2-60<=x0+CHUNK_SIZE&&b.z+b.depth/2+60>=z0&&b.z-b.depth/2-60<=z0+CHUNK_SIZE).map(b=>{const door=doorPoint(b,1),road=nearestRoad(door).point;return {b,door,road};});
  const detailed=(x:number,z:number,size:number)=>terrain.intersectsModification(x,x+size,z,z+size)||intersectsCrossing(x,x+size,z,z+size);
  function vertex(x: number, z: number, override?:number): void {
    let h = override??terrain.heightAt(x, z);
    // Adjacent chunk LODs share the same border elevations.
    if(!detailed(x-.1,z-.1,.2)) {
      const coarse=CHUNK_SIZE/8;
      if(Math.abs(x-x0)<.001||Math.abs(x-x0-CHUNK_SIZE)<.001){const a=Math.floor(z/coarse)*coarse,t=(z-a)/coarse;h=terrain.heightAt(x,a)*(1-t)+terrain.heightAt(x,a+coarse)*t;}
      if(Math.abs(z-z0)<.001||Math.abs(z-z0-CHUNK_SIZE)<.001){const a=Math.floor(x/coarse)*coarse,t=(x-a)/coarse;h=terrain.heightAt(a,z)*(1-t)+terrain.heightAt(a+coarse,z)*t;}
    }
    vertices.push(x, h, z);
    const parcel = hash2D(Math.floor((x + z * .17) / 170), Math.floor((z - x * .11) / 140), terrain.seed);
    color.copy(fields[Math.floor(parcel * fields.length) % fields.length]);
    color.lerp(woodland, smoothStep(.5, .66, terrain.forestValueAt(x, z)) * .85);
    const deformation = terrain.deformationAt(x, z);
    let wear=0;
    for(const {b,door,road} of yards){
      const dx=Math.max(0,Math.abs(x-b.x)-b.width/2),dz=Math.max(0,Math.abs(z-b.z)-b.depth/2);
      const yard=1-smoothStep(1.4,7,Math.hypot(dx,dz));
      const vx=road.x-door.x,vz=road.z-door.z,len=Math.hypot(vx,vz),t=Math.max(0,Math.min(1,((x-door.x)*vx+(z-door.z)*vz)/(len*len||1)));
      const path=len<60?1-smoothStep(1.2,4,Math.hypot(x-door.x-vx*t,z-door.z-vz*t)):0;
      wear=Math.max(wear,yard*.64,path*.78);
    }
    cover.push(smoothStep(.5,.66,terrain.forestValueAt(x,z)),Math.min(1,Math.abs(deformation)*2.4),wear);
    if (Math.abs(deformation) > .025) color.lerp(deformation < -.5 ? floor : earth, Math.min(1, Math.abs(deformation) * 2.4));
    const lightNoise = .94 + hash2D(Math.floor(x * 2), Math.floor(z * 2), terrain.seed) * .12;
    colors.push(color.r * lightNoise, color.g * lightNoise, color.b * lightNoise);
    const step = .45;
    const nx = terrain.heightAt(x - step, z) - terrain.heightAt(x + step, z);
    const nz = terrain.heightAt(x, z - step) - terrain.heightAt(x, z + step);
    const length = Math.hypot(nx, step * 2, nz);
    normals.push(nx / length, step * 2 / length, nz / length);
  }
  for (let iz = 0; iz < divisions; iz++) {
    for (let ix = 0; ix < divisions; ix++) {
      const x = x0 + ix * size, z = z0 + iz * size;
      const fine = refine&&detailed(x,z,size);
      const n = fine ? Math.round(size / (CHUNK_SIZE/512)) : 1;
      const start = vertices.length / 3;
      const neighborFine=(dx:number,dz:number)=>detailed(x+dx*size,z+dz*size,size);
      const corners=[terrain.heightAt(x,z),terrain.heightAt(x+size,z),terrain.heightAt(x,z+size),terrain.heightAt(x+size,z+size)];
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        let h:number|undefined;
        if(fine){
          if(i===0&&!neighborFine(-1,0))h=corners[0]*(1-j/n)+corners[2]*j/n;
          if(i===n&&!neighborFine(1,0))h=corners[1]*(1-j/n)+corners[3]*j/n;
          if(j===0&&!neighborFine(0,-1))h=corners[0]*(1-i/n)+corners[1]*i/n;
          if(j===n&&!neighborFine(0,1))h=corners[2]*(1-i/n)+corners[3]*i/n;
        }
        vertex(x + i / n * size, z + j / n * size,h);
      }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const a = start + j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('groundCover',new THREE.Float32BufferAttribute(cover,3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
