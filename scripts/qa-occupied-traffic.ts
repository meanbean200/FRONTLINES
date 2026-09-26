/** Occupied production-network acceptance probe. No mocked movement, geometry,
 * coordinator, collision or needs systems. Starting conditions are a fixture,
 * not a claim that these works were built through the player UI. */
import assert from 'node:assert/strict';
import {createBattlefield,addSquad} from '../src/simulation/createBattlefield';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {distance,polylineLength,type Vec2} from '../src/core/types';
import {inventory,type Facility} from '../src/garrison/types';
import {transfer,balance} from '../src/garrison/Inventory';
import {SUPPORT_WORKS} from '../src/construction/ConstructionReadout';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {pathToFileURL} from 'node:url';
import {positionReadiness} from '../src/combat/WeaponPositions';
import {isDeepStrictEqual} from 'node:util';
import {mkdirSync,writeFileSync} from 'node:fs';

function continuationEqual(actual:unknown,expected:unknown){
  // Compare what the save actually represents, not omitted undefined properties.
  const a=JSON.parse(JSON.stringify(actual)),b=JSON.parse(JSON.stringify(expected));if(isDeepStrictEqual(a,b))return;
  const differences:string[]=[];
  function visit(x:any,y:any,path:string){if(differences.length>=16||isDeepStrictEqual(x,y))return;if(x&&y&&typeof x==='object'&&typeof y==='object'){for(const key of new Set([...Object.keys(x),...Object.keys(y)]))visit(x[key],y[key],path+'.'+key);}else differences.push(`${path}: ${JSON.stringify(x)} != ${JSON.stringify(y)}`);}
  visit(a,b,'state');const folder=`output/playwright/occupied-traffic-failure-${Date.now()}`;mkdirSync(folder,{recursive:true});writeFileSync(folder+'/restored.json',JSON.stringify(a));writeFileSync(folder+'/continuous.json',JSON.stringify(b));
  assert.fail(`Save divergence; snapshots in ${folder}:\n${differences.join('\n')}`);
}

export function occupiedTrafficFixture(isolated:boolean,loop=false){
  const state=createBattlefield(1944);state.soldiers=[];state.squads=[];state.trenches=[];state.craters=[];
  const junction={x:-1720,z:-1740};
  for(let i=0;i<12;i++)addSquad(state,i>=10?'engineer':'rifle',8,junction.x,junction.z,`Traffic ${i+1}`);
  const main=state.nextEntityId++,branch=state.nextEntityId++,bay=state.nextEntityId++;
  state.trenches=[{id:main,points:[{x:-1950,z:-1740},{x:-1470,z:-1740}],width:2.2,depth:1.75,progress:1,status:'complete'},
    {id:branch,points:[junction,{x:-1720,z:-1460}],width:2.2,depth:1.75,progress:1,status:'complete'},
    {id:bay,points:[{x:-1720,z:-1620},{x:-1704,z:-1620}],width:8,depth:1.75,progress:1,status:'complete'}];
  const loopId=loop?state.nextEntityId++:undefined;
  if(loopId)state.trenches.push({id:loopId,points:[{x:-1680,z:-1740},{x:-1720,z:-1700}],width:2.2,depth:1.75,progress:1,status:'complete'});
  const arms=[{x:-1,z:0},{x:1,z:0},{x:0,z:1}],targets=new Map<number,Vec2>();
  state.soldiers.forEach((s,i)=>{
    if(i<72){const arm=Math.floor(i/24),along=22+(i%24)*2.2,from=arms[arm],to=arms[(arm+1)%3];s.x=junction.x+from.x*along;s.z=junction.z+from.z*along;targets.set(s.id,{x:junction.x+to.x*(along+.95),z:junction.z+to.z*(along+.95)});}
    else if(i<80){s.x=-1830-(i-72)*2.2;s.z=-1740;targets.set(s.id,{x:s.x+.25,z:s.z});}
    else {s.x=-1720;s.z=-1610+(i-80)*3;}
  });
  const sim=new BattlefieldSimulation(state);sim.issueOccupyNearest(state.squads.map(q=>q.id),main);
  const w=state.living!,g=w.garrisons[0];assert(g);assert(state.soldiers.every(s=>s.garrisonId===g.id));
  transfer(w.rearStock,g.cache,'food',100);transfer(w.rearStock,g.cache,'water',100);transfer(w.rearStock,g.cache,'materials',40);
  // Two operational crew, two workers, two loaded carriers, eight resting
  // people and two guards coexist with the eighty ordered travellers.
  const post=(kind:Facility['kind'],x:number,z:number,progress=1):Facility=>{
    const cost=SUPPORT_WORKS[kind].cost;w.ledger.initial.materials+=cost;w.ledger.consumed.materials+=cost;
    const f:Facility={id:state.nextEntityId++,garrisonId:g.id,kind,x,z,connectorId:bay,capacity:2,paid:true,progress,stock:inventory(),materialCost:cost};w.facilities.push(f);return f;
  };
  const gun=post('emplacement',-1712,-1620);gun.includesWeapon=true;gun.installation={kind:'crew-mg',source:'construction'};gun.weaponCrewIds=state.soldiers.slice(80,82).map(s=>s.id);transfer(w.rearStock,gun.stock,'ammo',120);
  const rest=post('rest',-1707,-1620),work=post('store',-1717,-1620,0);work.workOrder={explicit:true,workerIds:state.soldiers.slice(82,84).map(s=>s.id),createdAt:0};
  for(const [i,s] of state.soldiers.entries()){
    delete s.duty;s.needs!.energy=i>=86&&i<94?50:100;s.needs!.hunger=s.needs!.thirst=10;s.morale=100;
    if(i<80)continue;
    if(i<82){s.x=gun.x+(i-80)*1.2;s.z=gun.z;s.duty={kind:'watch',facilityId:gun.id,destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:300,reason:'Occupied gun crew',watchPost:{x:s.x,z:s.z},blockedFor:0};}
    else if(i<84){s.x=-1719;s.z=-1620+(i-82)*.8;}
    else if(i<86){s.x=-1719.4;s.z=-1678.55+(i-84)*2.2;const destination={x:-1815-(i-84)*2,z:-1740};const r=sim.garrisons.orderPerson(s.id,'move',destination);assert(r.accepted,r.reason);s.duty!.kind='haul';s.duty!.stage='deliver';delete s.duty!.playerOrdered;transfer(g.cache,s.carried!,'food',2);}
    else {const r=sim.garrisons.orderPerson(s.id,i<94?'rest':'watch');assert(r.accepted,r.reason);}
  }
  assert.equal(state.soldiers.filter(s=>s.duty?.facilityId===rest.id).length,2);
  assert.equal(positionReadiness(state,gun),'','fixture gun must actually be operational');
  const longest=new Set([23,47,71].map(i=>state.soldiers[i].id)),near=new Set(state.soldiers.slice(72,80).map(s=>s.id));
  for(const [i,s] of state.soldiers.slice(0,80).entries()){
    if(isolated&&!longest.has(s.id)&&!near.has(s.id)){s.x=-1940+i*1.05;s.z=-1740;const r=sim.garrisons.orderPerson(s.id,'move',{x:s.x,z:s.z});assert(r.accepted,r.reason);targets.delete(s.id);continue;}
    const r=sim.garrisons.orderPerson(s.id,'move',targets.get(s.id)!);assert(r.accepted,`${s.id}: ${r.reason}`);
  }
  // Deliberately distant visual anchors: individual duty routes must ignore them.
  for(const q of state.squads){q.x=-1940;q.z=-1740;}
  const lengths=Object.fromEntries(state.soldiers.filter(s=>targets.has(s.id)).map(s=>[s.id,polylineLength([s,...s.duty!.route])]));
  if(loopId)assert(state.soldiers.some(s=>targets.has(s.id)&&s.duty?.routeTrenches?.includes(loopId)),'loop must actually carry traffic');
  assert.deepEqual(new SaveSystem().parse(JSON.stringify(state)).soldiers,state.soldiers);
  return {sim,targets,near,gun,rest,work,lengths};
}

function run(isolated:boolean,loop:boolean){
  const {sim,targets,near,gun,rest,work,lengths}=occupiedTrafficFixture(isolated,loop),state=sim.state,remaining=new Set(targets.keys()),stalls=new Map<number,number>();
  let continuation:BattlefieldSimulation|undefined;
  const starts=new Map(state.soldiers.map(s=>[s.id,{x:s.x,z:s.z}]));let maxStall=0,maxNearTravel=0,sawWorker=false,sawCarrier=false;
  for(let tick=0;tick<5000&&remaining.size;tick++){
    const before=new Map(state.soldiers.filter(s=>remaining.has(s.id)).map(s=>[s.id,{x:s.x,z:s.z,index:s.duty?.routeIndex}]));sim.step(.05);continuation?.step(.05);
    if(!isolated&&!continuation&&state.elapsed>=25)continuation=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    sawWorker||=state.soldiers.some(s=>s.duty?.kind==='construct');sawCarrier||=state.soldiers.some(s=>s.duty?.kind==='haul');
    for(const s of state.soldiers.filter(s=>remaining.has(s.id))){
      assert(sim.garrisons.network.corridorContains(s),`left excavated geometry: ${s.id}`);
      assert(!sim.terrain.obstacleAt(s.x,s.z,.3),`entered building: ${s.id}`);
      if(near.has(s.id))maxNearTravel=Math.max(maxNearTravel,distance(s,starts.get(s.id)!));
      if(s.duty?.arrivedAt!==undefined&&distance(s,targets.get(s.id)!)<.5){remaining.delete(s.id);continue;}
      const prev=before.get(s.id)!,stall=distance(prev,s)<.001&&s.duty?.routeIndex===prev.index?(stalls.get(s.id)??0)+.05:0;stalls.set(s.id,stall);maxStall=Math.max(maxStall,stall);
    }
    assert(state.soldiers.filter(s=>s.duty?.facilityId===rest.id).length<=rest.capacity,'invented extra beds');
  }
  const result={isolated,loop,personnel:state.soldiers.length,travellers:targets.size,seconds:state.elapsed,maxStall,maxNearTravel,remaining:[...remaining],sawWorker,sawCarrier,gunCrew:gun.weaponCrewIds,workProgress:work.progress,lengths};
  console.log(JSON.stringify(result));
  assert.equal(remaining.size,0,'permanent traffic failure');assert(maxStall<=2,'stationary stall exceeded two seconds');assert(maxNearTravel<2,'near-destination person backtracked');assert(sawWorker&&sawCarrier,'missing mixed duties');
  for(const value of Object.values(balance(state)))assert(Math.abs(value)<1e-6,'inventory conservation');
  if(continuation)continuationEqual(continuation.state,state);
  return result;
}
export function verifyOccupiedTraffic(loop=false){
  const baseline=run(true,loop),crowded=run(false,loop);
  for(const [id,length] of Object.entries(baseline.lengths))assert.equal(crowded.lengths[id],length,'unmatched route');
  assert(crowded.seconds<=2*baseline.seconds,'crowded completion exceeds twice the matched unobstructed routes');
  return {baseline,crowded};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){verifyOccupiedTraffic();verifyOccupiedTraffic(true);}
