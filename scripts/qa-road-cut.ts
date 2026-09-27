import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {instantiateScenario} from '../src/scenarios/instantiateScenario';
import {WorldSession} from '../src/sessions/WorldSession';
import {preflight} from '../src/dev/ScenarioPreflight';
import {balance} from '../src/garrison/Inventory';

const path=process.argv[2]??'content/scenarios/road-cut-redoubts.json';
const seconds=Number(process.argv[3]??120),label=process.argv[4]??'probe';
const preset=JSON.parse(readFileSync(path,'utf8')),issues=preflight(preset);
mkdirSync('output/road-cut',{recursive:true});
if(issues.some(i=>i.severity==='error')){writeFileSync(`output/road-cut/${label}.json`,JSON.stringify({issues},null,2));throw new Error(JSON.stringify(issues));}
const session=new WorldSession('attract',instantiateScenario(preset),false),state=session.state;
const seen=new Set<number>(),shots:Record<string,number>={},first:Record<string,number>={},samples:unknown[]=[],support=new Set<number>();
try{
 for(let tick=0;tick<seconds*20;tick++){
  session.step();
  for(const event of state.operation!.shotEvents??[]){if(seen.has(event.id))continue;seen.add(event.id);const s=state.soldiers.find(s=>s.id===event.shooterId),q=state.squads.find(q=>q.id===s?.squadId),key=q?.name??'unknown';shots[key]=(shots[key]??0)+1;first[key]??=state.elapsed;}
  for(const m of state.operation!.supportMissions??[])if(m.ammoConsumed===1)support.add(m.id);
  if(tick%400===399)samples.push({elapsed:state.elapsed,status:state.operation!.status,shots:state.operation!.shots,people:['player','enemy'].map(side=>({side,alive:state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction===side&&s.needs?.life!=='dead').length})),posts:state.living!.facilities.filter(f=>f.installation).map(f=>({id:f.id,kind:f.installation?.kind,weapon:f.installation?.weapon,crew:f.weaponCrewIds?.map(id=>{const s=state.soldiers.find(s=>s.id===id)!;return {id,x:s.x,z:s.z,activity:s.activity,duty:s.duty,combat:s.combat};}),stock:f.stock}))});
 }
 const result={issues,seconds,shots,first,support:[...support],samples,balance:balance(state),imported:state.living!.ledger.imported};
 writeFileSync(`output/road-cut/${label}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify({issues,seconds,shots,first,support:support.size,balance:balance(state),samples:samples.map((s:any)=>({elapsed:s.elapsed,status:s.status,shots:s.shots,people:s.people}))},null,2));
}finally{session.dispose();}
