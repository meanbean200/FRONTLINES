import {pointAlongPolyline,polylineLength,type TrenchState} from '../core/types';
import {excavatedSpan} from '../core/TrenchGeometry';
import {hash2D} from '../core/random';
import type {TerrainSystem} from '../terrain/TerrainSystem';

export interface TrenchTimber {x:number;y:number;z:number;w:number;h:number;d:number;angle:number;pitch:number;roll:number;tint:number;role:'walkway'|'bank'|'brace'}
/** Cladding on the sampled earth, not a second wall standing inside the trench.
 * No geometry here grants cover or changes the simulation's walkable surface. */
export function trenchTimbers(t:TrenchState,terrain:TerrainSystem):TrenchTimber[]{
  const length=polylineLength(t.points),span=excavatedSpan(t),out:TrenchTimber[]=[];
  const at=(n:number)=>pointAlongPolyline(t.points,Math.max(0,Math.min(1,n/length)));
  for(let along=span.start+2.5;along<span.end-2.5;along+=.58){
    const p=at(along),a=at(along-.1),b=at(along+.1),angle=Math.atan2(b.x-a.x,b.z-a.z),nx=Math.cos(angle),nz=-Math.sin(angle),tx=Math.sin(angle),tz=Math.cos(angle);
    const index=Math.round(along/.58),wear=hash2D(index,t.id,41);
    const board=(across:number,w:number,d:number,role:TrenchTimber['role'],tint:number)=>{
      const x=p.x+nx*across,z=p.z+nz*across,y=terrain.heightAt(x,z);
      const roll=Math.atan2(terrain.heightAt(x+nx*w/2,z+nz*w/2)-terrain.heightAt(x-nx*w/2,z-nz*w/2),w);
      const pitch=-Math.atan2(terrain.heightAt(x+tx*d/2,z+tz*d/2)-terrain.heightAt(x-tx*d/2,z-tz*d/2),d);
      out.push({x,y:y+.026,z,w,h:.04,d,angle,pitch,roll,tint,role});
    };
    // Small breaks and uneven ends, while preserving a continuous visible walkway.
    board((wear-.5)*.09,1.02+wear*.18,.52,'walkway',wear>.5?0x837b66:0x69634f);
    if(index%4!==0)continue;
    for(const side of [-1,1]){
      // Sample the entire panel edge: no boards bridging a crossing or a newly dug branch.
      if([-.95,0,.95].some(d=>terrain.deformationAt(p.x+nx*t.width*.55*side+tx*d,p.z+nz*t.width*.55*side+tz*d)<-.25))continue;
      for(let level=0;level<3;level++)board(side*t.width*(.29+level*.055),t.width*.048,2.12,'bank',(index+level)%3?0x73654f:0x8a7b60);
      // Short transverse braces follow the bank, never stand above its crest.
      board(side*t.width*.35,t.width*.22,.12,'brace',0x554d3c);
    }
  }
  return out;
}
