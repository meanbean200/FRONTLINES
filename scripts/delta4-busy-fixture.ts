// Deliberately authored load scene, NOT ordinary-player acceptance. All runtime
// work, rounds, observations and transport after instantiation use production code.
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {type BattlefieldState,WORLD_VERSION,WORLD_SIZE} from '../src/core/types';
import {addSquad} from '../src/simulation/createBattlefield';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {inventory,RESOURCES,type Inventory} from '../src/garrison/types';
import {roadPoint} from '../src/garrison/LogisticsSystem';
import {weaponCrewPoint} from '../src/construction/PositionDefinitions';
import {installPositionWeapons} from '../src/combat/WeaponPositions';
import {requestPositionSupport} from '../src/combat/SupportWeapons';
import {SaveSystem} from '../src/persistence/SaveSystem';

export function busyBattle(count:number){
  // A legacy-sized, synthetic operation, not a new Open Front preset. Keep its
  // serialized identity truthful; 2.4 km belongs to versioned Open Front only.
  const state:BattlefieldState={schemaVersion:4,worldVersion:WORLD_VERSION,worldSize:WORLD_SIZE,seed:1944,elapsed:0,simSpeed:1,nextEntityId:1,soldiers:[],squads:[],trenches:[],craters:[]};
  const pairs=count===136?2:Math.ceil(count/128),assignments:{ids:number[];trench:number;side:'player'|'enemy';x:number;z:number}[]=[];
  for(const [si,side] of (['player','enemy'] as const).entries()){
    const total=count===136?(si?64:72):count/2;
    for(let pair=0;pair<pairs;pair++){
      const size=Math.floor(total/pairs)+(pair<total%pairs?1:0),x=-650+(pair%2)*1080+si*200,z=-950+Math.floor(pair/2)*440,ids:number[]=[];
      let left=size,index=0;
      while(left){const n=Math.min(8,left),q=addSquad(state,left<=8?'engineer':'rifle',n,x,z+index*25,`${side} sector ${pair+1} / ${index+1}`);q.faction=side;ids.push(q.id);left-=n;index++;}
      const trench=state.nextEntityId++;state.trenches.push({id:trench,points:[{x,z},{x,z:z+240}],width:7.2,depth:1.75,progress:1,status:'complete'});
      state.soldiers.filter(s=>ids.includes(s.squadId)).forEach((s,i)=>{s.x=x;s.z=z+6+i*3.1;s.heading=si?-Math.PI/2:Math.PI/2;});
      assignments.push({ids,trench,side,x,z});
    }
  }
  const sim=new BattlefieldSimulation(state),w=state.living!;w.campaignHours=12;
  const account=(stock:Inventory)=>{for(const key of RESOURCES)w.ledger.initial[key]+=stock[key];};
  w.rear=roadPoint(-850);w.enemySupply={rear:roadPoint(850),stock:inventory({ammo:count*100,materials:count*4,food:count*4,water:count*6,medical:count,mortarHE:64,mortarSmoke:64,fuel:400}),nextDelivery:0};account(w.enemySupply.stock);
  for(const t of w.trucks){Object.assign(t,t.role==='convoy'?w.entry:w.rear);}
  for(let i=0;i<4;i++){w.trucks.push({id:state.nextEntityId++,faction:'enemy',role:i===0?'convoy':'shuttle',...w.enemySupply.rear,state:'idle',route:[],routeIndex:0,cargo:inventory(),fuel:30,timer:0,reason:'Fixture transport'});w.ledger.initial.fuel+=30;}
  state.operation={version:1,mode:'advance',status:'active',elapsed:0,duration:1e9,score:0,targetScore:1e9,nextCombat:0,nextOrders:3,objectives:[],initialPlayer:state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player').length,initialEnemy:state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy').length,shots:0,hits:0,reason:'Controlled mixed-combat performance workload',casualtyRules:true,supportRules:true};
  // Far public objective permits real AI planning without ending a short sample.
  for(const [i,id] of ['west-hq','village','east-hq'].entries()){const stock=inventory(),cacheId=state.nextEntityId++,p={x:-250+i*250,z:1000};w.crates.push({id:cacheId,...p,stock});state.operation.objectives.push({id,name:id,...p,radius:30,owner:'neutral',control:0,contested:false,cacheId});}
  for(const a of assignments){
    if(!sim.garrisons.assign(a.ids,a.trench))throw Error(`Cannot assign load sector ${a.trench}`);
    const g=w.garrisons.find(g=>g.trenchId===a.trench)!;g.front=a.side==='player'?Math.PI/2:-Math.PI/2;g.readiness='alert';g.nextSupport=1e9;
    g.cache=inventory({ammo:800,food:160,water:200,medical:16,materials:0,mortarHE:32,mortarSmoke:24});account(g.cache);
    for(const [i,kind] of (['emplacement','mortar'] as const).entries()){
      let id:number|undefined;
      for(const offset of [0,15,-15,30,-30,45,-45,60,-60]){
        const origin={x:a.x,z:a.z+70+i*65+offset},position=kind==='emplacement'?origin:{x:a.x+(a.side==='player'?-8:8),z:origin.z};
        id=sim.garrisons.requestFacility(g.id,kind,position,origin,g.front,true);if(id)break;
      }
      if(!id)throw Error(`No legal authored ${kind} at ${JSON.stringify(a)}`);
      const f=w.facilities.find(f=>f.id===id)!;f.progress=1;f.paid=true;w.ledger.initial.materials+=f.materialCost;w.ledger.consumed.materials+=f.materialCost;
      const connector=state.trenches.find(t=>t.id===f.connectorId)!;connector.progress=1;connector.status='complete';f.workOrder!.workerIds=[];f.workOrder!.autoWorkers=false;
      const q=state.squads.find(q=>q.id===a.ids[i])!,crew=state.soldiers.filter(s=>s.squadId===q.id).slice(0,2);f.weaponCrewIds=crew.map(s=>s.id);
      f.stock=inventory(kind==='emplacement'?{ammo:600}:{mortarHE:24,mortarSmoke:16});account(f.stock);
      for(const [n,p] of crew.entries()){Object.assign(p,weaponCrewPoint(state,f,n));p.action='watching';p.duty={kind:'watch',facilityId:f.id,destination:{x:p.x,z:p.z},route:[],routeIndex:0,arrivedAt:0,since:0,until:150,blockedFor:0,reason:'Authored initial crew'};}
    }
    for(const s of state.soldiers.filter(s=>a.ids.includes(s.squadId))){const stock=inventory({ammo:120,medical:1,smokeGrenades:2});for(const key of RESOURCES)s.carried![key]+=stock[key];account(stock);s.ammunition=s.carried!.ammo;}
    const origin={x:a.x,z:a.z+190},site=sim.garrisons.requestFacility(g.id,'store',{x:a.x+(a.side==='player'?-12:12),z:origin.z},origin,g.front,true);
    // V2 workload starts an on-site work party beside finite delivered crates.
    // V1's 190 m cache trips exercised hauling but no active labor in its short
    // capture window. This is declared initial setup, not completed construction.
    const stock=inventory({materials:site?70:80});account(stock);
    w.crates.push({id:state.nextEntityId++,x:a.x+(a.side==='player'?-16:16),z:origin.z+8,stock,faction:a.side});
    if(site){const f=w.facilities.find(f=>f.id===site)!;
      // Ten construction materials were delivered/committed in the initial
      // setup. No excavation is pre-completed; labor still progresses in ticks.
      f.paid=true;w.ledger.initial.materials+=f.materialCost;w.ledger.consumed.materials+=f.materialCost;
      for(const [i,id]of f.workOrder!.workerIds.entries()){const p=state.soldiers.find(p=>p.id===id)!;p.x=a.x;p.z=origin.z-5-i*2;delete p.duty;}
    }
    // An independent rifle section advances, while crews and workers remain.
    const moving=a.ids[2];sim.issueMove([moving],{x:a.x+(a.side==='player'?65:-65),z:a.z+160},true);
  }
  installPositionWeapons(state,true);sim.terrain.syncModifications();
  return sim;
}

if(process.argv[1]?.replaceAll('\\','/').endsWith('delta4-busy-fixture.ts')){
  const count=Number(process.argv[2]),folder=process.argv[3];if(![136,300,512,1000].includes(count)||!folder)throw Error('Pass 136/300/512/1000 and a new output folder');
  mkdirSync(folder,{recursive:true});const file=`${folder}/battle-${count}.json`;if(existsSync(file))throw Error('Preserve existing fixture');
  const sim=busyBattle(count),state=sim.state;let smokeOrdered=false,heOrdered=false;
  new SaveSystem().parse(JSON.stringify(state));
  sim.tickProfile.setEnabled(true);
  for(let i=0;i<1000;i++){
    if(state.simSpeed===0)throw Error(`Load fixture paused: ${state.operation?.reason}`);sim.stepFixed();
    if(i%100===0)console.log(JSON.stringify({count,at:state.elapsed,shots:state.operation!.shots,tick:sim.stepCosts.total,costs:sim.tickProfile.read().at(-1)}));
    // Legitimately delivered local observations, not opposing hidden coordinates.
    if(i>100&&i%20===0)for(const f of state.living!.facilities.filter(f=>f.kind==='mortar')){
      const p=state.soldiers.find(s=>s.id===f.weaponCrewIds?.[0]),q=p&&state.squads.find(q=>q.id===p.squadId),contact=p&&state.operation!.intelligence?.squads.find(r=>r.squadId===p.squadId)?.contacts.find(c=>c.visible&&c.active);
      if(!contact||!q)continue;
      const kind=!smokeOrdered?'mortarSmoke':'mortarHE';if(kind==='mortarHE'&&heOrdered)continue;
      const result=requestPositionSupport(state,kind,f.id,contact,false,sim.terrain,q.faction==='enemy'?'ENEMY_AI':'PLAYER');if(result.accepted){if(kind==='mortarSmoke')smokeOrdered=true;else heOrdered=true;}
    }
  }
  const parsed=new SaveSystem().parse(JSON.stringify(state)),bytes=JSON.stringify(parsed);writeFileSync(file,bytes,{flag:'wx'});
  console.log(JSON.stringify({file,sha256:createHash('sha256').update(bytes).digest('hex'),count:state.soldiers.length,active:state.soldiers.filter(s=>s.needs?.life==='active').length,shots:state.operation!.shots,smokeOrdered,heOrdered,sites:state.living!.facilities.map(f=>({kind:f.kind,progress:f.progress,connector:state.trenches.find(t=>t.id===f.connectorId)?.progress,workers:state.soldiers.filter(p=>p.duty?.facilityId===f.id&&p.action==='digging').length}))}));
}
