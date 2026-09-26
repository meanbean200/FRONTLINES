import {WORLD_VERSION,WORLD_SIZE,polylineLength,distance,type BattlefieldState} from '../core/types';
import {addSquad} from '../simulation/createBattlefield';
import {initializeLiving} from '../garrison/LogisticsSystem';
import {inventory,RESOURCES,type Inventory} from '../garrison/types';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {TrenchSystem} from '../construction/TrenchSystem';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {validateScenario,type ScenarioPreset} from './ScenarioPreset';
import {legacyEquipment} from '../combat/Equipment';
import {trenchAnchorAt} from '../construction/PositionDefinitions';

export function emptyScenarioWorld(seed=1944):BattlefieldState{return {worldVersion:WORLD_VERSION,worldSize:WORLD_SIZE,schemaVersion:4,seed,elapsed:0,simSpeed:1,nextEntityId:1,soldiers:[],squads:[],trenches:[],craters:[]};}
/** Deterministic production-world constructor. Never reads storage or accepts runtime snapshots. */
export function instantiateScenario(input:ScenarioPreset):BattlefieldState{
 validateScenario(input);const preset=structuredClone(input),state=emptyScenarioWorld(preset.seed),ids=new Map<string,number>();
 const terrain=new TerrainSystem(state),trenches=new TrenchSystem(state);
 const ground=(p:{x:number;z:number},name:string)=>{if(terrain.groundTypeAt(p.x,p.z)==='river'||terrain.obstacleAt(p.x,p.z,.3))throw new Error(`${name}: placement intersects water, a building or a solid obstacle. Move it onto clear terrain.`);};
 for(const e of preset.entities)if(e.type==='trench'){
  if(polylineLength(e.points)<6)throw new Error(`${e.name}: a trench needs at least 6 metres of usable length`);
  const t=trenches.create(e.points);t.width=e.width;t.depth=e.depth;t.progress=e.completed?1:0;t.status=e.completed?'complete':'planned';ids.set(e.id,t.id);
  for(let i=1;i<t.points.length;i++){const a=t.points[i-1],b=t.points[i],n=Math.max(1,Math.ceil(distance(a,b)/2));for(let j=0;j<=n;j++)ground({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n},e.name);}
 }
 for(const e of preset.entities)if(e.type==='formation'){
  const q=addSquad(state,e.kind,e.count,e.x,e.z,e.name);q.faction=e.side;ids.set(e.id,q.id);
  for(const s of state.soldiers.filter(s=>s.squadId===q.id)){ground(s,e.name);s.equipment=legacyEquipment(state,s);}
 }
 initializeLiving(state);const w=state.living!;
 // Explicit finite starting manifests replace factory defaults. No scheduled imports in a preset battle.
 w.campaignHours=preset.hour;w.rearStock=inventory();w.trucks=[];w.nextDelivery=Number.MAX_SAFE_INTEGER;w.logistics!.manifest=inventory();w.logistics!.deliveryInterval=Number.MAX_SAFE_INTEGER;
 w.ledger={initial:inventory(),imported:inventory(),consumed:inventory(),lost:inventory()};
 const account=(stock:Inventory)=>{for(const r of RESOURCES)w.ledger.initial[r]+=stock[r];};
 for(const e of preset.entities)if(e.type==='formation')for(const s of state.soldiers.filter(s=>s.squadId===ids.get(e.id))){s.carried=inventory({ammo:e.ammo,food:e.food,water:e.water});s.ammunition=e.ammo;account(s.carried);s.nextShotAt=1+(s.id%9)*.15;}
 const objectives=preset.entities.filter(e=>e.type==='objective').map(e=>({id:e.id,name:e.name,x:e.x,z:e.z,radius:e.radius,owner:e.owner,control:e.owner==='player'?1:e.owner==='enemy'?-1:0,contested:false,cacheId:-1}));
 state.operation={version:1,mode:'advance',status:'active',elapsed:0,duration:0,score:0,targetScore:90,nextCombat:0,nextOrders:1,objectives,initialPlayer:state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player').length,initialEnemy:state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy').length,shots:0,hits:0,reason:'',casualtyRules:true,supportRules:true,
  authored:{presetId:preset.id,controllers:{...preset.controllers},intentions:preset.entities.filter(e=>e.type==='formation').map(e=>({squadId:ids.get(e.id)!,intent:e.intent,targetId:e.targetId,home:{x:e.x,z:e.z}})),targets:preset.entities.filter(e=>e.type==='staging'||e.type==='objective').map(e=>({id:e.id,x:e.x,z:e.z,radius:e.radius})),memories:{},hold:{player:0,enemy:0}}};
 const simulation=new BattlefieldSimulation(state);
 // Initial position ownership is authored, not inferred from invisible opposing units.
 for(const e of preset.entities)if(e.type==='trench'&&e.completed){const t=state.trenches.find(t=>t.id===ids.get(e.id))!,component=simulation.garrisons.network.component(t.id);let g=w.garrisons.find(g=>simulation.garrisons.network.component(g.trenchId)===component);
  if(g&&(g.faction??'player')!==e.side)throw new Error(`${e.name}: connected trenches cannot start owned by opposing factions`);
  if(!g){g=simulation.garrisons.ensureArea(t.id);if(!g)throw new Error(e.name+': no usable completed floor');g.faction=e.side;g.name=e.name;g.nextSupport=Number.MAX_SAFE_INTEGER;}
 }
 for(const e of preset.entities)if(e.type==='formation'&&e.trenchId){if(!simulation.garrisons.assign([ids.get(e.id)!],ids.get(e.trenchId)!))throw new Error(`${e.name}: ${simulation.garrisons.lastAssignment.reason}`);}
 for(const e of preset.entities){
  if(e.type==='stock'){ground(e,e.name);w.crates.push({id:state.nextEntityId++,...{x:e.x,z:e.z},stock:{...e.stock}});account(e.stock);}
  if(e.type==='facility'){
   const t=state.trenches.find(t=>t.id===ids.get(e.trenchId))!,g=w.garrisons.find(g=>simulation.garrisons.network.component(g.trenchId)===simulation.garrisons.network.component(t.id));
   if(!g)throw new Error(`${e.name}: complete its parent trench first`);const anchor=trenchAnchorAt(t,e);if(!anchor||anchor.distance>t.width/2)throw new Error(`${e.name}: place it on the completed parent trench floor (within ${t.width/2} m)`);
   const crew=state.squads.find(q=>q.id===ids.get(e.crewId??''));if(crew&&!simulation.garrisons.assign([crew.id],t.id))throw new Error(e.name+': '+simulation.garrisons.lastAssignment.reason);
   const id=state.nextEntityId++;w.facilities.push({id,x:e.x,z:e.z,garrisonId:g.id,kind:e.kind,connectorId:t.id,trenchAnchor:{trenchId:t.id,along:anchor.along},progress:1,capacity:e.weapon?2:e.kind==='rest'?8:20,paid:true,stock:{...e.stock},materialCost:0,facing:e.facing*Math.PI/180,
    ...(e.weapon?{installation:{kind:e.weapon,source:'construction' as const},weaponCrewIds:crew?.soldierIds.slice(0,2)??[],autoReplaceCrew:true}:{}),...(e.weapon==='field-gun'?{artillery:{batteryId:id,index:0,size:1 as const}}:{})});account(e.stock);
   if(crew)for(const s of state.soldiers.filter(s=>crew.soldierIds.includes(s.id))){if(s.equipment){if(e.weapon==='crew-mg'&&['crew-mg','mg42'].includes(s.equipment.weapon))s.equipment.weapon='unarmed';if(e.weapon==='mortar'||e.weapon==='field-gun')s.equipment.mortar=false;}}
  }
 }
 simulation.terrain.syncModifications();
 return state;
}
