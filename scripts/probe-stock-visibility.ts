import {readFileSync} from 'node:fs';
import {TerrainSystem} from '../src/terrain/TerrainSystem';
import {playerCanSeeObject} from '../src/operations/ObjectSight';
// Read-only diagnostic: output observed transports, never hidden locations.
const state=JSON.parse(readFileSync(process.argv[2],'utf8')),terrain=new TerrainSystem(state);
console.log(JSON.stringify({elapsed:state.elapsed,observed:state.living.trucks.filter((t:any)=>t.faction==='enemy'&&playerCanSeeObject(state,terrain,t,'truck')).map((t:any)=>({id:t.id,x:t.x,z:t.z,state:t.state,reason:t.reason}))},null,2));
