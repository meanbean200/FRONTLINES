import {existsSync,writeFileSync} from 'node:fs';
import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {roadPoint} from '../src/garrison/LogisticsSystem';
import {RULES_VERSION} from '../src/garrison/GarrisonPolicy';
import {SaveSystem} from '../src/persistence/SaveSystem';
const prefix=process.argv[2];if(!prefix||existsSync(prefix+'.json')||existsSync(prefix+'-supported.json')||existsSync(prefix+'-exposed.json'))throw Error('Unused output prefix required');
const rows=[];
for(let seed=1944;seed<1952;seed++)for(const supported of [false,true]){
 const sim=new BattlefieldSimulation(createOperation('campaign',seed)),s=sim.state,op=s.operation!,a=s.squads[0],b=s.squads.find(q=>q.faction==='enemy'&&q.kind==='rifle')!,gun=s.squads.find(q=>q.faction==='player'&&q.kind==='machinegun')!;
 op.nextOrders=1e9;s.living!.campaignHours=12;
 for(const [n,q] of s.squads.entries()){
  sim.garrisons.release(q.id);q.order={type:'hold',issuedAt:0};q.x=q.faction==='enemy'?3400:-3400;q.z=2500+n*30;q.route=[];q.routeIndex=0;
  for(const [i,p] of s.soldiers.filter(p=>p.squadId===q.id).entries()){p.x=q.x+(i%4)*2;p.z=q.z+Math.floor(i/4)*2;p.nextShotAt=1e9;delete p.duty;delete p.trenchId;p.cover=sim.terrain.coverAt(p.x,p.z);}
 }
 const origin=roadPoint(-3600),end=roadPoint(-3490),enemy=roadPoint(-3440);
 const place=(id:number,at:{x:number;z:number},heading:number)=>{const q=s.squads.find(q=>q.id===id)!;Object.assign(q,at);for(const [i,p] of s.soldiers.filter(p=>p.squadId===id).entries()){p.x=at.x+Math.floor(i/4)*2;p.z=at.z+(i%4-1.5)*2;p.heading=heading;p.nextShotAt=0;p.cover=sim.terrain.coverAt(p.x,p.z);}};
 place(a.id,origin,Math.PI/2);place(b.id,enemy,-Math.PI/2);place(gun.id,{x:origin.x-8,z:origin.z+4},Math.PI/2);
 if(supported){gun.order.intent='suppress';gun.order.target={...enemy};}else for(const p of s.soldiers.filter(p=>p.squadId===gun.id))p.nextShotAt=1e9;
 const path=Array.from({length:7},(_,i)=>roadPoint(origin.x+(end.x-origin.x)*i/6));if(!sim.issueDrawnPath([a.id],path))throw Error('Fixture road approach invalid');a.order.intent='assault';
 const ids=new Set(a.soldierIds),enemyIds=new Set(b.soldierIds),team=s.soldiers.filter(p=>ids.has(p.id)),frames=seed===1944?[structuredClone(s)]:undefined;
 let pinned=0,wait=0,nextFrame=1,maxEnemySuppression=0;
 for(let n=0;n<2400;n++){
  sim.setSpeed(1);sim.step(.05);for(const p of team){if(p.combat?.reaction==='pinned')pinned+=.05;if(p.combat?.pauseReason==='Waiting for covering fire')wait+=.05;}
  maxEnemySuppression=Math.max(maxEnemySuppression,...s.soldiers.filter(p=>enemyIds.has(p.id)).map(p=>p.suppression));
  if(frames&&s.elapsed+.00001>=nextFrame){frames.push(structuredClone(s));nextFrame++;}
 }
 const row={seed,supported,elapsed:s.elapsed,shots:op.shots,hits:op.hits,dead:team.filter(p=>p.needs!.life==='dead').length,disabled:team.filter(p=>p.needs!.life==='incapacitated').length,meanAdvance:team.reduce((n,p)=>n+p.x-origin.x,0)/team.length,ableAdvance:team.filter(p=>p.needs!.life==='active').map(p=>p.x-origin.x),pinnedPersonSeconds:pinned,waitingPersonSeconds:wait,maxEnemySuppression,ammoConsumed:s.living!.ledger.consumed.ammo};rows.push(row);console.log(JSON.stringify(row));
 if(frames){const save=new SaveSystem();for(const f of frames)save.parse(JSON.stringify(f));writeFileSync(`${prefix}-${supported?'supported':'exposed'}.json`,JSON.stringify(frames),{flag:'wx'});}
}
writeFileSync(prefix+'.json',JSON.stringify({rules:RULES_VERSION,scope:'Matched road advance in real terrain, same 96-person world and 8-person rifle attack/defense; other squads held away. Three-person supporting MG team uses area fire, or holds fire in the control. No guaranteed survival or historical claim. Replays use seed 1944 at 1-second intervals.',rows},null,2),{flag:'wx'});
