import type {BattlefieldState} from '../core/types';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {createGroundGeometry} from './GroundGeometry';

export interface GroundRequest {id:number;x:number;z:number;divisions:number;world:Pick<BattlefieldState,'seed'|'trenches'|'craters'>}
export interface GroundResponse {id:number;position:Float32Array;normal:Float32Array;color:Float32Array;groundCover:Float32Array;index:Uint16Array|Uint32Array}
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<GroundRequest>)=>void)|null;postMessage:(response:GroundResponse,transfer:Transferable[])=>void};
scope.onmessage=({data:r})=>{
  const terrain=new TerrainSystem({schemaVersion:1,...r.world,soldiers:[],squads:[],elapsed:0,simSpeed:0,nextEntityId:1});
  const geometry=createGroundGeometry(terrain,r.x,r.z,r.divisions);
  const result:GroundResponse={id:r.id,position:geometry.attributes.position.array as Float32Array,normal:geometry.attributes.normal.array as Float32Array,color:geometry.attributes.color.array as Float32Array,groundCover:geometry.attributes.groundCover.array as Float32Array,index:geometry.index!.array as Uint16Array|Uint32Array};
  scope.postMessage(result,[result.position.buffer,result.normal.buffer,result.color.buffer,result.groundCover.buffer,result.index.buffer] as ArrayBuffer[]);
  geometry.dispose();
};
