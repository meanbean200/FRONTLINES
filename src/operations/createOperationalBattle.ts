import {addSquad,createBattlefield} from '../simulation/createBattlefield';
import {TrenchSystem} from '../construction/TrenchSystem';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {SquadNavigation} from '../navigation/SquadNavigation';
import {GarrisonSystem} from '../garrison/GarrisonSystem';
import {initializeLiving} from '../garrison/LogisticsSystem';
import {inventory,RESOURCES,type Inventory} from '../garrison/types';
import {distance,type BattlefieldState,type Vec2} from '../core/types';
import {insideWorld} from '../terrain/WorldLayout';
import {initializeReplacements} from './Replacements';
import {OPERATION_DEFINITIONS,forceSize} from './OperationDefinitions';
import {placeOperation} from './OperationPlacement';
import {atDepth} from './OperationGeometry';
import type {OperationId} from './OperationalTypes';
import type {Faction} from './types';
import {configuredDefinition,validBattleSetup,type ResolvedBattleSetup} from './BattleSetup';
import {equipInfantryForce} from './InfantryLoadout';
import {placeMissionOperation} from './MissionContent';

/** Shared force/deployment builder; no mission-specific soldier or combat behavior. */
export function createOperationalBattle(id:OperationId,seed=1944,setup?:ResolvedBattleSetup,newContent=false,missionVersion:1|2|3=3):BattlefieldState {
  if(!Number.isSafeInteger(seed)||seed<1||seed>2147483647)throw new Error('Sector seed must be an integer from 1 to 2147483647');
  if(setup&&(!validBattleSetup(setup,true)||setup.seed!==seed||setup.operation!==id))throw new Error('Invalid battle setup');
  const state=createBattlefield(seed);state.soldiers=[];state.squads=[];state.trenches=[];state.craters=[];
  const definition=structuredClone(setup?configuredDefinition(id,setup):OPERATION_DEFINITIONS[id]),runtime=newContent?placeMissionOperation(id,seed,setup,missionVersion):placeOperation(id,seed,setup),mission=runtime.missionPlan;
  if(mission){definition.deployment=mission.deployment;definition.prepared=[...new Set(mission.prepared.map(p=>p.side))];definition.defenseSeconds=0;}
  const terrain=new TerrainSystem(state),navigation=new SquadNavigation(terrain),construction=new TrenchSystem(state);
  const prepared=new Map<Faction,number[]>(),groups=new Map<number,number[]>();
  const pathAt=(p:Vec2)=>[-60,-30,0,30,60].map((n,i)=>({x:p.x+runtime.front.right.x*n+runtime.front.forward.x*(i%2*5),z:p.z+runtime.front.right.z*n+runtime.front.forward.z*(i%2*5)}));
  for(const side of definition.prepared){
    const ids:number[]=[];
    if(mission){
      for(const work of mission.prepared.filter(p=>p.side===side)){
        const t=construction.create(work.points);t.width=7.2;t.progress=1;t.status='complete';ids.push(t.id);groups.set(t.id,[]);
      }
      prepared.set(side,ids);continue;
    }
    const sectors=setup?Math.max(3,Math.ceil(forceSize(definition.forces[side])/25)):3;
    for(const lateral of Array.from({length:sectors},(_,i)=>(i/(sectors-1)-.5)*1200)){
      let chosen:Vec2[]|undefined;
      for(let n=0;n<180&&!chosen;n++){
        const center=atDepth(runtime.front,definition.deployment[side]+(n%9-4)*22,lateral+Math.floor(n/9)*12-100),path=pathAt(center);
        const samples=Array.from({length:61},(_,i)=>({x:path[0].x+(path[4].x-path[0].x)*i/60,z:path[0].z+(path[4].z-path[0].z)*i/60}));
        if(samples.every(p=>insideWorld(p,40)&&!terrain.obstacleAt(p.x,p.z,6)&&terrain.groundTypeAt(p.x,p.z)!=='river'&&terrain.distanceToRoad(p.x,p.z)>14))chosen=path;
      }
      if(!chosen)throw new Error(`No safe prepared position for ${side}; seed ${seed}`);
      const t=construction.create(chosen);t.width=7.2;t.progress=1;t.status='complete';ids.push(t.id);groups.set(t.id,[]);
    }
    prepared.set(side,ids);
  }
  terrain.syncModifications();
  const names=['Able','Baker','Charlie','Dog','Easy','Fox'];
  for(const side of ['player','enemy'] as const){
    const f=definition.forces[side];
    const total=forceSize(f),roster=Array.from({length:Math.ceil(total/8)},(_,i)=>({count:Math.min(8,total-i*8),name:names[i]??`Formation ${i+1}`}));
    for(const [i,{count,name}] of roster.entries()){
      const trenchIds=prepared.get(side),tId=mission?.kind==='line-defense'&&side==='player'&&i<roster.length-3?undefined:trenchIds?.[i%trenchIds.length],t=state.trenches.find(t=>t.id===tId);
      const p=navigation.freeDestination(t?t.points[2]:atDepth(runtime.front,definition.deployment[side]+Math.floor(i/4)*(mission?35:45),(i%4-1.5)*(mission?35:95)));
      const q=addSquad(state,'rifle',count,p.x,p.z,side==='enemy'?`Opposing ${name}`:name);q.faction=side;
      if(tId)groups.get(tId)!.push(q.id);
      for(const s of state.soldiers.filter(s=>s.squadId===q.id)){Object.assign(s,navigation.freeDestination(s));s.heading=Math.atan2(runtime.front.forward.x,runtime.front.forward.z)+(side==='enemy'?Math.PI:0);}
    }
    equipInfantryForce(state,state.squads.filter(q=>q.faction===side),f,side==='player'?(setup?.side??'us'):setup?.side==='german'?'us':'german');
  }
  initializeLiving(state);const w=state.living!;
  const account=(stock:Inventory)=>{for(const key of RESOURCES)w.ledger.initial[key]+=stock[key];};
  for(const source of runtime.reinforcements){
    if(source.side==='player'){w.rear={...source.rear};w.entry={...source.entry};for(const t of w.trucks)Object.assign(t,t.role==='convoy'?source.entry:source.rear);}
    else{
      w.enemySupply={rear:{...source.rear},entry:{...source.entry},stock:{...w.rearStock},nextDelivery:0};account(w.enemySupply.stock);
      for(let i=0;i<4;i++){w.trucks.push({id:state.nextEntityId++,...(i===0?source.entry:source.rear),faction:'enemy',role:i===0?'convoy':'shuttle',state:'idle',route:[],routeIndex:0,cargo:inventory(),fuel:30,timer:0,reason:'Awaiting assignment'});w.ledger.initial.fuel+=30;}
    }
  }
  for(const s of state.soldiers){const kit=s.equipment!;
    const supplies=inventory({ammo:60,medical:kit.medicalKit?8:1,smokeGrenades:1,mortarHE:kit.mortar?12:0,mortarSmoke:kit.mortar?6:0});
    for(const key of RESOURCES)s.carried![key]+=supplies[key];account(supplies);s.ammunition=s.carried!.ammo;s.nextShotAt=4+s.id%9*.35;
  }
  const garrisons=new GarrisonSystem(state,terrain,navigation,construction);
  for(const [side,trenchIds] of prepared)for(const [index,trenchId] of trenchIds.entries()){
    const ids=groups.get(trenchId)!,component=garrisons.network.component(trenchId)!;
    const positions=garrisons.network.samples(component,mission?1.5:setup?3:4).filter(p=>terrain.coverAt(p.x,p.z)==='trench');
    const people=state.soldiers.filter(s=>ids.includes(s.squadId));
    for(const [i,s] of people.entries()){if(!positions[i])throw new Error('Prepared sector capacity exceeded');Object.assign(s,positions[i]);s.cover='trench';}
    for(const q of state.squads.filter(q=>ids.includes(q.id))){const people=state.soldiers.filter(s=>s.squadId===q.id);q.x=people.reduce((n,p)=>n+p.x,0)/people.length;q.z=people.reduce((n,p)=>n+p.z,0)/people.length;}
    if(!garrisons.assign(ids,trenchId))throw new Error(`Prepared ${side} sector unreachable (${people.length} people / ${garrisons.network.capacity(component)} capacity)`);
    const g=w.garrisons.find(g=>g.trenchId===trenchId)!;g.name=`${side==='player'?'FRIENDLY':'OPPOSING'} SECTOR ${index+1}`;
    g.front=Math.atan2(runtime.front.forward.x,runtime.front.forward.z)+(side==='enemy'?Math.PI:0);g.nextSupport=30;
    g.cache=inventory({food:40,water:64,materials:80,ammo:200,medical:12,mortarHE:8,mortarSmoke:4,smokeGrenades:8});account(g.cache);
  }
  // Compatibility adapter: physical cache locations, NOT the V2 victory evaluator.
  const objectives=runtime.locations.map(l=>{
    const p=navigation.freeDestination(l.position),stock=inventory(l.kind==='village'?{food:32,water:48,ammo:240}:{}),cacheId=state.nextEntityId++;
    w.crates.push({id:cacheId,...p,stock});account(stock);
    const owner=l.id==='player-rear'?'player' as const:l.id==='enemy-rear'?'enemy' as const:'neutral' as const;
    return {id:l.id,name:l.name,...p,radius:180,cacheId,owner,control:owner==='player'?1:owner==='enemy'?-1:0,contested:false};
  });
  state.operation={version:1,forceModel:'infantry-equipment-v1',mode:id,runtime,status:'active',elapsed:0,duration:definition.defenseSeconds,score:0,targetScore:1,nextCombat:0,nextOrders:3,objectives,
    initialPlayer:forceSize(definition.forces.player),initialEnemy:forceSize(definition.forces.enemy),shots:0,hits:0,reason:'',casualtyRules:true,supportRules:true};
  if(setup){state.operation.setup=structuredClone(setup);applyInitialOptions(state,setup);}
  if(definition.persistent){state.operation.campaign={playerTrench:prepared.get('player')![0],enemyTrench:prepared.get('enemy')![0],nextRaid:0,raidSquads:[],returnAt:0,phase:'preparing',playerHold:0,enemyHold:0};initializeReplacements(state);}
  // Clear separation is an invariant, not a camera trick hiding nearby enemies.
  if(state.squads.some(a=>a.faction==='player'&&state.squads.some(b=>b.faction==='enemy'&&distance(a,b)<(mission?200:600))))throw new Error('Deployment zones overlap');
  return state;
}

function applyInitialOptions(state:BattlefieldState,setup:ResolvedBattleSetup):void {
  const w=state.living!,a=setup.advanced;
  w.campaignHours={dawn:6,day:8,dusk:18,night:22}[a.time];
  const stocks=[w.rearStock,w.enemySupply!.stock,...w.garrisons.flatMap(g=>[g.cache,g.forwardStock]),...w.crates.map(c=>c.stock),...state.soldiers.map(s=>s.carried!)];
  for(const stock of stocks)for(const key of RESOURCES){
    const before=stock[key];
    if(a.supply==='low')stock[key]=Math.floor(stock[key]*.5);
    if(!a.smoke&&(key==='smokeGrenades'||key==='mortarSmoke')||!a.mortars&&(key==='mortarHE'||key==='mortarSmoke'))stock[key]=0;
    w.ledger.initial[key]+=stock[key]-before;
  }
  for(const key of RESOURCES){
    if(a.supply==='low')w.logistics!.manifest[key]=Math.floor(w.logistics!.manifest[key]*.5);
    if(!a.smoke&&(key==='smokeGrenades'||key==='mortarSmoke')||!a.mortars&&(key==='mortarHE'||key==='mortarSmoke'))w.logistics!.manifest[key]=0;
  }
  for(const s of state.soldiers)s.ammunition=s.carried!.ammo;
}
