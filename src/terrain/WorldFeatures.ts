import { hash2D } from '../core/random';
import {CHUNK_SIZE} from '../core/types';
import {roadDistance,riverCenter,riverWidth} from './WorldLayout';

export interface BuildingSite { x: number; z: number; width: number; depth: number; height: number; angle: number }
export interface TreeSite {x:number;z:number;size:number;index:number}
interface VegetationGround {seed:number;forestValueAt(x:number,z:number):number;distanceToRoad(x:number,z:number):number;groundTypeAt(x:number,z:number):string;isSettlement(x:number,z:number):boolean;deformationAt(x:number,z:number):number}

/** One deterministic source for scenery and simulation collision/visibility. */
export function treesForChunk(terrain:VegetationGround,x0:number,z0:number):TreeSite[]{
  const trees:TreeSite[]=[];
  for(let i=0;i<420;i++){
    const x=x0+hash2D(x0+i,z0,terrain.seed)*CHUNK_SIZE,z=z0+hash2D(x0,z0+i,terrain.seed+17)*CHUNK_SIZE;
    const forest=terrain.forestValueAt(x,z),hedge=Math.abs(((x+z*.17)%170+170)%170-85)<3;
    if(forest<.56&&!hedge&&hash2D(i,x0,89)<.985)continue;
    if(terrain.distanceToRoad(x,z)<8||terrain.groundTypeAt(x,z)==='river'||terrain.isSettlement(x,z))continue;
    trees.push({x,z,size:hedge&&forest<.56?1.8:3.4+hash2D(i,z0,118)*3.2,index:trees.length});
  }return trees;
}
export function treeCleared(terrain:Pick<VegetationGround,'deformationAt'>,tree:{x:number;z:number}):boolean {
  return [[0,0],[3,0],[-3,0],[0,3],[0,-3]].some(([x,z])=>terrain.deformationAt(tree.x+x,tree.z+z)<-.1);
}
export const SETTLEMENTS = [
  { x: 0, z: -80, name: 'SAINT-MARTIN', r: 120, buildings:16 },
  { x: -1070, z: -1370, name: 'LE VERGER', r: 105, buildings:11 },
  { x: -1240, z: 750, name: 'LES ORMES', r: 125, buildings:14 },
  { x: 1080, z: 1000, name: 'BEAUMONT', r: 135, buildings:16 },
  { x: 1500, z: -1480, name: 'LA FERME', r: 90, buildings:6 },
  { x: -1500, z: -240, name: 'BOIS NOIR', r: 85, buildings:6 },
  { x: 270, z: 1400, name: 'LE MOULIN', r: 90, buildings:7 },
  { x: 1080, z: -200, name: 'LA PRAIRIE', r: 85, buildings:6 },
  { x: -550, z: 80, name: 'FERME DU VAL', r: 85, buildings:6 },
];
export function buildingsForSeed(seed: number): BuildingSite[] {
  return SETTLEMENTS.flatMap((site, siteIndex) => Array.from({ length: site.buildings }, (_, i) => ({
    x: site.x + (i % 4 - 1.5) * 31 + hash2D(i, siteIndex, seed) * 8,
    z: site.z + (Math.floor(i / 4) - 1.5) * 29 + hash2D(siteIndex, i, seed + 11) * 7,
    width: 9 + hash2D(i, siteIndex, seed + 21) * 5,
    depth: 8 + hash2D(i, siteIndex, seed + 41) * 6,
    height: 5 + hash2D(i, siteIndex, seed + 91) * 3,
    angle: 0,
  }))).filter(b=>{
    // Keep generated building footprints outside the existing road rights-of-way.
    return roadDistance(b.x,b.z)>Math.max(b.width,b.depth)/2+6&&Math.abs(b.z-riverCenter(b.x))>riverWidth(b.x)+b.depth/2+4;
  });
}
