import {readFileSync} from 'node:fs';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
// Diagnostic replay of an exported browser observation. Mutates only this
// disposable headless copy, never the source file or a browser campaign.
const s=JSON.parse(readFileSync(process.argv[2],'utf8')),sim=new BattlefieldSimulation(s),c=s.living.crates.find((c:{id:number})=>c.id===Number(process.argv[3]??379));
if(!c)throw Error('Choose an existing crate ID');
console.log({crate:c,blocked:sim.terrain.obstacleAt(c.x,c.z,.4)});
for(const g of s.living.garrisons.filter((g:{faction:string})=>g.faction!=='enemy')){
 const normal=sim.navigation.plan(g.entrance,c),personal=sim.navigation.plan(g.entrance,c,undefined,true,8000);
 const direct=sim.terrain.obstacleAt(g.entrance.x,g.entrance.z,.4);
 console.log({g:g.id,name:g.name,entrance:g.entrance,normal:normal.length,personal:personal.length,first:personal[0],direct,command:sim.garrisons.recoverSupplies(c.id,g.id)});
}
