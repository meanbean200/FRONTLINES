import {writeFileSync} from 'node:fs';
import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {balance} from '../src/garrison/Inventory';

const state=createOperation('advance'),sim=new BattlefieldSimulation(state);
state.simSpeed=0;state.living!.campaignHours=23;
const trench={id:state.nextEntityId++,points:[{x:-2200,z:-2000},{x:-1900,z:-2000}],width:4.2,depth:1.75,progress:1,status:'complete' as const};
state.trenches=[trench];sim.terrain.syncModifications();sim.garrisons.network.sync(state.trenches);
for(const [i,q] of state.squads.entries()){
  const at=i===0?{x:-1940,z:-2000}:i===1?{x:-1940,z:-1980}:i===6?{x:-1940,z:-1940}:{x:-2800+i*60,z:-2700};
  q.x=at.x+12;q.z=at.z;q.order={type:'hold',issuedAt:0};q.route=[];q.routeIndex=0;
  state.soldiers.filter(s=>s.squadId===q.id).forEach((s,j)=>{s.x=at.x+j*3;s.z=at.z;s.nextShotAt=10000;s.heading=i===6?Math.PI:0;});
}
sim.assignGarrison([state.squads[0].id],trench.id);
const g=state.living!.garrisons[0];g.nextSupport=10000;g.nextDecision=10000;
for(const s of state.soldiers.filter(s=>s.squadId===state.squads[0].id)){
  s.needs!.energy=60;s.action='sleeping';
  s.duty={kind:'sleep',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:500,reason:'Night rest in controlled combat fixture',blockedFor:0,networkBound:true};
}
state.operation!.nextOrders=10000;
new SaveSystem().parse(JSON.stringify(state));
writeFileSync('output/playwright/combat-entry-fixture-r1.json',JSON.stringify({scope:'Synthetic positions and disabled enemy orders for physical entry/alarm UI testing; not ordinary campaign evidence',state,ledger:balance(state)}),{flag:'wx'});
console.log({trenchId:trench.id,garrisonId:g.id,sleepingSquad:state.squads[0].id,entrySquad:state.squads[1].id});
