import {addSquad,createBattlefield} from '../simulation/createBattlefield';
import {TrenchSystem} from '../construction/TrenchSystem';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {SquadNavigation} from '../navigation/SquadNavigation';
import {GarrisonSystem} from '../garrison/GarrisonSystem';
import {initializeLiving} from '../garrison/LogisticsSystem';
import {inventory,RESOURCES} from '../garrison/types';
import type {BattlefieldState} from '../core/types';
import {initializeReplacements} from './Replacements';
import {convoyEntry,rearDepot,ROADS} from '../terrain/WorldLayout';

/** A finite-force campaign. Only scheduled manifests can replenish its stocks. */
export function createCampaign(seed=1944):BattlefieldState {
  const state=createBattlefield(seed);state.soldiers=[];state.squads=[];state.trenches=[];state.craters=[];
  const trenches=new TrenchSystem(state),homes:number[]=[];
  for(const side of ['player','enemy'] as const){
    const x=side==='player'?-520:520,back=side==='player'?-1:1;
    const front=trenches.create([{x,z:-240},{x:x+back*8,z:-190},{x,z:-140},{x:x+back*8,z:-90},{x,z:-30}]);
    front.width=7.2;front.progress=1;front.status='complete';homes.push(front.id);
    const connector=trenches.create([{x:x+back*4,z:-115},{x:x+back*55,z:-115},{x:x+back*70,z:-85}]);
    connector.width=7.2;connector.progress=1;connector.status='complete';
    const roster=[['rifle',8,'Able'],['rifle',8,'Baker'],['rifle',8,'Charlie'],['rifle',8,'Dog'],['engineer',8,'Pioneer team'],['machinegun',3,'Machine-gun team'],['mortar',3,'Mortar team'],['medical',2,'Medical section']] as const;
    for(const [i,[kind,count,name]] of roster.entries()){
      const squad=addSquad(state,kind,count,x+back*4,-215+i*22,
        side==='enemy'?`Opposing ${name}`:name);
      squad.faction=side;
    }
  }
  initializeLiving(state);const w=state.living!;
  w.rear=rearDepot(false,ROADS[2]);for(const t of w.trucks)Object.assign(t,t.role==='convoy'?convoyEntry(false,w.rear):w.rear);
  w.enemySupply={rear:rearDepot(true,ROADS[2]),stock:{...w.rearStock},nextDelivery:0};
  for(const key of RESOURCES)w.ledger.initial[key]+=w.enemySupply.stock[key];
  for(let i=0;i<4;i++){
    w.trucks.push({id:state.nextEntityId++,...(i===0?convoyEntry(true,w.enemySupply.rear):w.enemySupply.rear),faction:'enemy',role:i===0?'convoy':'shuttle',state:'idle',route:[],routeIndex:0,cargo:inventory(),fuel:30,timer:0,reason:'Awaiting assignment'});
    w.ledger.initial.fuel+=30;
  }
  for(const s of state.soldiers){const kind=state.squads.find(q=>q.id===s.squadId)!.kind;s.carried!.ammo=60;s.ammunition=60;w.ledger.initial.ammo+=60;s.nextShotAt=4+s.id%9*.35;
    const supplies=inventory({medical:kind==='medical'?8:1,smokeGrenades:1,mortarHE:kind==='mortar'?4:0,mortarSmoke:kind==='mortar'?2:0});for(const key of RESOURCES){s.carried![key]+=supplies[key];w.ledger.initial[key]+=supplies[key];}}
  const terrain=new TerrainSystem(state),navigation=new SquadNavigation(terrain),garrisons=new GarrisonSystem(state,terrain,navigation,trenches);
  for(const [i,side] of (['player','enemy'] as const).entries()){
    const ids=state.squads.filter(q=>q.faction===side).map(q=>q.id),component=garrisons.network.component(homes[i])!;
    const positions=garrisons.network.samples(component,4).filter(p=>terrain.coverAt(p.x,p.z)==='trench');
    for(const [index,s] of state.soldiers.filter(s=>ids.includes(s.squadId)).entries()){const p=positions[index];if(!p)throw new Error('Prepared trench has insufficient deployment space');s.x=p.x;s.z=p.z;s.cover='trench';s.heading=side==='player'?Math.PI/2:-Math.PI/2;}
    if(!garrisons.assign(ids,homes[i]))throw new Error(`Prepared ${side} trench is not traversable`);
    const g=w.garrisons.find(g=>g.squadIds.includes(ids[0]))!;g.name=side==='player'?'WEST LINE':'EAST LINE';g.front=side==='player'?Math.PI/2:-Math.PI/2;
    g.cache=inventory({food:64,water:100,materials:80,ammo:200,medical:16,mortarHE:12,mortarSmoke:6,smokeGrenades:8});g.nextSupport=30;
    for(const key of RESOURCES)w.ledger.initial[key]+=g.cache[key];
  }
  const objectives=[{id:'west-hq',name:'WEST COMMAND',x:-524,z:-140,owner:'player' as const,control:1},{id:'village',name:'SAINT-MARTIN',x:0,z:28,owner:'neutral' as const,control:0},{id:'east-hq',name:'EAST COMMAND',x:524,z:-140,owner:'enemy' as const,control:-1}].map(site=>{
    const p=navigation.freeDestination(site),cacheId=state.nextEntityId++,stock=inventory(site.id==='village'?{food:32,water:48,ammo:240}:{});
    w.crates.push({id:cacheId,...p,stock});for(const key of RESOURCES)w.ledger.initial[key]+=stock[key];
    return {...site,...p,radius:43,cacheId,contested:false};
  });
  state.operation={version:1,mode:'campaign',status:'active',elapsed:0,duration:0,score:0,targetScore:120,nextCombat:0,nextOrders:3,objectives,initialPlayer:48,initialEnemy:48,shots:0,hits:0,reason:'',
    casualtyRules:true,supportRules:true,
    campaign:{playerTrench:homes[0],enemyTrench:homes[1],nextRaid:240,raidSquads:[],returnAt:0,phase:'preparing',playerHold:0,enemyHold:0}};
  initializeReplacements(state);return state;
}
