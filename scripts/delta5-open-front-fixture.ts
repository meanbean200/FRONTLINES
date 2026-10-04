// Deliberately scaled performance scene, NOT ordinary-player population or
// campaign acceptance. Runtime decisions, movement, construction, logistics,
// observation and combat all use production Open Front systems after setup.
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createOperationalBattle} from '../src/operations/createOperationalBattle';
import {defaultOpenFrontSetup,resolveBattleSetup} from '../src/operations/BattleSetup';
import {atDepth} from '../src/operations/OperationGeometry';
import {addSquad} from '../src/simulation/createBattlefield';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {freshNeeds} from '../src/garrison/NeedsSystem';
import {inventory,RESOURCES} from '../src/garrison/types';
import {requestSupport} from '../src/combat/SupportWeapons';
import {SaveSystem} from '../src/persistence/SaveSystem';

const target=Number(process.argv[2]??512),folder=process.argv[3];
if(target!==512||!folder)throw new Error('Pass 512 and a new output folder');
mkdirSync(folder,{recursive:true});const file=`${folder}/battle-${target}.json`;
if(existsSync(file))throw new Error('Preserve existing fixture');

const seed=1944,base=defaultOpenFrontSetup();
const setup=resolveBattleSetup({...base,size:'medium',side:'us',map:'seed',seed},seed);
const state=createOperationalBattle('open-front',seed,setup,true),runtime=state.operation!.runtime!,front=runtime.front,w=state.living!;
const account=(stock:ReturnType<typeof inventory>)=>{for(const key of RESOURCES)w.ledger.initial[key]+=stock[key];};
let added=0;
while(state.soldiers.length<target){
  const side=added%2?'enemy':'player',remaining=target-state.soldiers.length,size=Math.min(8,remaining),sideIndex=Math.floor(added/2);
  const columns=24,lateral=((sideIndex%columns)/(columns-1)-.5)*1500+(Math.floor(sideIndex/columns)%2?18:-18);
  const depth=side==='player'?-112:112;
  const p=atDepth(front,depth,lateral),q=addSquad(state,'rifle',size,p.x,p.z,`${side==='player'?'Stress friendly':'Stress opposing'} ${sideIndex+1}`);q.faction=side;
  const people=state.soldiers.filter(s=>s.squadId===q.id);
  for(const [i,s] of people.entries()){
    s.needs=freshNeeds();s.equipment={version:1,weapon:side==='enemy'?'kar98k':'m1',tools:i===0&&sideIndex%5===0,mortar:false,medicalKit:i===people.length-1&&sideIndex%8===0};
    if(i===1)s.equipment.weapon=side==='enemy'?'mg42':'bar';
    const stock=inventory({food:2,water:3,ammo:90,medical:s.equipment.medicalKit?8:1,smokeGrenades:1});s.carried=stock;s.ammunition=stock.ammo;account(stock);
    s.heading=Math.atan2(front.forward.x,front.forward.z)+(side==='enemy'?Math.PI:0);
  }
  state.operation!.campaign!.replacements!.establishment.push({squadId:q.id,strength:size});added++;
}
state.operation!.initialPlayer=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction!=='enemy').length;
state.operation!.initialEnemy=state.soldiers.length-state.operation!.initialPlayer;
state.operation!.nextOrders=0;
const sim=new BattlefieldSimulation(state);sim.tickProfile.setEnabled(true);
for(let i=0;i<400;i++){
  if(state.simSpeed===0)throw new Error(`Open Front fixture paused: ${state.operation?.reason}`);
  sim.stepFixed();
  if(i%100===0)console.log(JSON.stringify({at:state.elapsed,shots:state.operation!.shots,plan:runtime.commander?.planPhase,works:runtime.openFront?.works.length,trucks:w.trucks.map(t=>t.state)}));
}
// Exercise the same finite-ammunition player smoke order used by the UI. It is
// issued only after the live workload is established so the capture can prove
// owner-visible smoke at every quality setting without inventing provenance.
const smokeSquad=state.squads.find(q=>q.faction!=='enemy'&&state.soldiers.some(s=>s.squadId===q.id&&s.needs?.life==='active'&&(s.carried?.smokeGrenades??0)>0&&s.suppression<70&&!s.combat?.careTask));
if(!smokeSquad)throw new Error('No ready player smoke team in scaled Open Front fixture');
const smokeTarget={x:smokeSquad.x+front.forward.x*12,z:smokeSquad.z+front.forward.z*12};
const smoke=requestSupport(state,'smokeGrenades',smokeSquad.id,smokeTarget,false,sim.terrain,'PLAYER');
if(!smoke.accepted)throw new Error(`Player smoke order rejected: ${smoke.reason}`);
for(let i=0;i<70;i++)sim.stepFixed();

const parsed=new SaveSystem().parse(JSON.stringify(state)),bytes=JSON.stringify(parsed);writeFileSync(file,bytes,{flag:'wx'});
const fields=state.operation!.smokeFields?.filter(s=>s.until>state.elapsed&&s.side==='player'&&s.source==='PLAYER')??[];
if(!fields.length)throw new Error('Player smoke mission did not create a persistent field');
console.log(JSON.stringify({file,sha256:createHash('sha256').update(bytes).digest('hex'),worldSize:state.worldSize,count:state.soldiers.length,active:state.soldiers.filter(s=>s.needs?.life==='active').length,shots:state.operation!.shots,plan:runtime.commander?.planPhase,transitions:runtime.commander?.transitions,works:runtime.openFront?.works,playerSmoke:fields,smokeSquad:smokeSquad.id,trucks:w.trucks.map(t=>({side:t.faction??'player',state:t.state,cargo:t.cargo,roadhead:t.roadhead}))}));
