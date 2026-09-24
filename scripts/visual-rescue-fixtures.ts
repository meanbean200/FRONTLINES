import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {createOperation} from '../src/operations/createOperation';
import {requestSupport} from '../src/combat/SupportWeapons';
import {SaveSystem} from '../src/persistence/SaveSystem';
const path='output/visual-rescue/fixtures.json';if(existsSync(path))throw Error('Preserve existing visual fixtures');mkdirSync('output/visual-rescue',{recursive:true});
const pack:Record<string,unknown>={};
const capture=(key:string,sim:BattlefieldSimulation,focus:{x:number;z:number},zoom:number)=>{const state=structuredClone(sim.state);state.simSpeed=0;new SaveSystem().parse(JSON.stringify(state));pack[key]={state,focus,zoom};};
const normal=new BattlefieldSimulation(createOperation('campaign')),g=normal.state.living!.garrisons[0];
capture('strategic',normal,g.entrance,1600);capture('medium',normal,g.entrance,380);
for(let i=0;i<400;i++)normal.stepFixed();
const soldier=normal.state.soldiers[6];capture('infantry',normal,soldier,25);capture('trench',normal,g.entrance,95);
capture('logistics',normal,normal.state.living!.trucks.find(t=>t.faction!=='enemy'&&t.role!=='convoy')!,36);
const v=JSON.parse(readFileSync('output/combat-qa-v3-village.json','utf8')),village=new BattlefieldSimulation(v.state);
village.setSpeed(1);
capture('village',village,v.focus,180);
const d=JSON.parse(readFileSync('output/combat-qa-v3-defense.json','utf8')),battle=new BattlefieldSimulation(d.state);
battle.setSpeed(1);
for(let i=0;i<800;i++){battle.stepFixed();if(battle.state.operation!.shotEvents?.some(s=>battle.state.elapsed-s.at<.05))break;}
capture('battle',battle,d.focus,150);
const mortar=village.state.squads.find(q=>q.kind==='mortar'&&q.faction!=='enemy')!;
village.garrisons.release(mortar.id);mortar.order={type:'hold',issuedAt:0};mortar.x=v.focus.x-150;mortar.z=v.focus.z-50;
village.state.soldiers.filter(s=>s.squadId===mortar.id).forEach((s,i)=>{s.x=mortar.x+i;s.z=mortar.z;delete s.duty;delete s.trenchId;});
for(let n=0;n<3;n++){
  const result=requestSupport(village.state,'mortarHE',mortar.id,v.focus,true);if(!result.accepted)throw Error(result.reason);
  const mission=village.state.operation!.supportMissions!.at(-1)!;
  for(let i=0;i<1000&&mission.stage!=='complete'&&mission.stage!=='cancelled';i++)village.stepFixed();
  if(mission.stage!=='complete')throw Error('Mortar cancelled: '+mission.reason);
  if(n===0)capture('impact',village,mission.impact,110);
}
capture('aftermath',village,v.focus,145);
const mixed=new BattlefieldSimulation(JSON.parse(readFileSync('output/mixed-combat-300-v3.json','utf8')));
mixed.setSpeed(1);
for(let i=0;i<400;i++)mixed.stepFixed();capture('stress300',mixed,{x:-2090,z:-1600},330);
pack.scope='Controlled presentation fixtures; normal TypeScript simulation advances and real mortar events. Not player-playthrough evidence. No user saves.';
writeFileSync(path,JSON.stringify(pack),{flag:'wx'});console.log(Object.keys(pack));
