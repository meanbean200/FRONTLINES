import { hash2D } from '../core/random';

export interface BuildingSite { x: number; z: number; width: number; depth: number; height: number; angle: number }
export interface TreeSite {x:number;z:number;size:number;index:number}
interface VegetationGround {seed:number;forestValueAt(x:number,z:number):number;distanceToRoad(x:number,z:number):number;groundTypeAt(x:number,z:number):string;isSettlement(x:number,z:number):boolean;deformationAt(x:number,z:number):number}

/** One deterministic source for scenery and simulation collision/visibility. */
export function treesForChunk(terrain:VegetationGround,x0:number,z0:number):TreeSite[]{
  const trees:TreeSite[]=[];
  for(let i=0;i<420;i++){
    const x=x0+hash2D(x0+i,z0,terrain.seed)*500,z=z0+hash2D(x0,z0+i,terrain.seed+17)*500;
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
  { x: -1070, z: -1370, name: 'SAINT-MARTIN', r: 105 },
  { x: -1270, z: 840, name: 'LES ORMES', r: 140 },
  { x: 1580, z: 1180, name: 'BEAUMONT', r: 150 },
  { x: 2240, z: -1580, name: 'LA FERME', r: 120 },
  { x: -2520, z: -1320, name: 'BOIS NOIR', r: 130 },
];
export function buildingsForSeed(seed: number): BuildingSite[] {
  return SETTLEMENTS.flatMap((site, siteIndex) => Array.from({ length: siteIndex === 0 ? 11 : 16 }, (_, i) => ({
    x: site.x + (i % 4 - 1.5) * 31 + hash2D(i, siteIndex, seed) * 8,
    z: site.z + (Math.floor(i / 4) - 1.5) * 29 + hash2D(siteIndex, i, seed + 11) * 7,
    width: 9 + hash2D(i, siteIndex, seed + 21) * 5,
    depth: 8 + hash2D(i, siteIndex, seed + 41) * 6,
    height: 5 + hash2D(i, siteIndex, seed + 91) * 3,
    angle: 0,
  }))).filter(b=>{
    // Keep generated building footprints outside the existing road rights-of-way.
    const road=Math.min(Math.abs(b.z-(920+Math.sin((b.x-300)/1150)*260)),Math.abs(b.x+1340-Math.sin(b.z/870)*190),Math.abs(b.z+1330-Math.sin(b.x/530)*30));
    return road>Math.max(b.width,b.depth)/2+5;
  });
}
