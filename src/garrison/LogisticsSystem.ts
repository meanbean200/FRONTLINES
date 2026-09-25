import { distance, lerpVec,WORLD_VERSION,WORLD_SIZE, type BattlefieldState, type Vec2 } from '../core/types';
import {supplyRoadZ,nearestRoad,roadRoute,convoyEntry,rearDepot} from '../terrain/WorldLayout';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import { inventory, RESOURCES, type Garrison, type Inventory, type Truck, type LogisticsConfig } from './types';
import { total, transfer, transferBounded } from './Inventory';
import {reconcileSupplyDemands,unfulfilled} from './SupplyDemand';
import { freshNeeds } from './NeedsSystem';
import {RULES_VERSION} from './GarrisonPolicy';
import {initializeEquipment} from '../combat/Equipment';

export function roadPoint(x:number):Vec2{return {x,z:supplyRoadZ(x)};}
export const defaultLogistics=():LogisticsConfig=>({deliveryInterval:450,manifest:inventory({food:400,water:600,materials:120,fuel:180,ammo:160,medical:12,mortarHE:12,mortarSmoke:6,smokeGrenades:10}),rearCapacity:12000,forwardCapacity:400,cacheCapacity:600,storeCapacity:600,convoyCapacity:1500,shuttleCapacity:140,carrierCapacity:16});
export function initializeLiving(state:BattlefieldState):void {
  initializeEquipment(state);
  if(state.living){state.living.logistics??=defaultLogistics();return;}
  // This is fresh-state initialization, never save compatibility/migration.
  state.worldVersion??=WORLD_VERSION;state.worldSize??=WORLD_SIZE;
  const rear=rearDepot(),stock=inventory({food:400,water:500,materials:300,fuel:500,ammo:1000});
  state.schemaVersion=3;
  state.combatRules=RULES_VERSION;
  state.living={version:1,campaignHours:8,lethalNeeds:false,garrisons:[],facilities:[],trucks:[],crates:[],rear,rearStock:stock,nextDelivery:0,
    ledger:{initial:{...stock},imported:inventory(),consumed:inventory(),lost:inventory()},
    metrics:{watchGapHours:0,criticalNeedHours:0,distance:0,blockedHours:0,deaths:0},emergencyResumeSpeed:1,logistics:defaultLogistics(),supplyDemands:[]};
  for(const s of state.soldiers){s.needs=freshNeeds(s.fatigue);s.carried=inventory({food:2,water:3});state.living.ledger.initial.food+=2;state.living.ledger.initial.water+=3;}
  for(let i=0;i<4;i++){
    const p=i===0?convoyEntry():rear;
    state.living.trucks.push({id:state.nextEntityId++,...p,role:i===0?'convoy':'shuttle',state:'idle',route:[],routeIndex:0,cargo:inventory(),fuel:30,timer:0,reason:'Awaiting assignment'});
    state.living.ledger.initial.fuel+=30;
  }
}

/** Kinematic road transport; roads severed by excavation cannot be driven across. */
export class LogisticsSystem {
  private reserved=new Set<number>();
  constructor(private state:BattlefieldState,private terrain:TerrainSystem){}
  replaceState(state:BattlefieldState):void{this.state=state;}
  forwardPoint(entrance:Vec2):Vec2 {return nearestRoad(entrance).point;}
  private clear(a:Vec2,b:Vec2):boolean {
    const n=Math.max(1,Math.ceil(distance(a,b)/2));for(let i=0;i<=n;i++){const p=lerpVec(a,b,i/n);
      if(this.terrain.obstacleAt(p.x,p.z,1.6)||this.terrain.groundTypeAt(p.x,p.z)==='river'||this.terrain.deformationAt(p.x,p.z)<-.35)return false;
    }return true;
  }
  private depart(t:Truck,destination:Vec2,state:'outbound'|'returning'):void{t.route=roadRoute(t,destination);t.routeIndex=0;t.state=state;delete t.resume;t.reason=state==='outbound'?'En route':'Returning to depot';}
  step(dt:number):void {
    const w=this.state.living!,config=w.logistics!;
    reconcileSupplyDemands(this.state);
    this.reserved=new Set(w.trucks.filter(t=>t.garrisonId!==undefined&&t.state!=='idle').map(t=>t.garrisonId!));
    for(const t of w.trucks){
      const side=t.faction??'player',enemy=side==='enemy'?w.enemySupply:undefined;
      if(side==='enemy'&&!enemy){t.reason='No friendly rear depot';continue;}
      const rear=enemy?.rear??w.rear,rearStock=enemy?.stock??w.rearStock,edge=(side==='enemy'?enemy?.entry:w.entry)??convoyEntry(side==='enemy',rear);
      const assigned=w.garrisons.find(g=>g.id===t.garrisonId&&(g.faction??'player')===side);
      // A captured destination does not teleport its shipment back into a depot.
      if(t.role==='shuttle'&&t.garrisonId!==undefined&&!assigned&&t.state!=='returning'&&!(t.state==='blocked'&&t.resume==='returning')){
        this.depart(t,rear,'returning');t.reason='Destination lost; returning with cargo';continue;
      }
      if(t.state==='idle'){
        if(t.role==='shuttle'&&total(t.cargo)>0){for(const key of RESOURCES)transferBounded(t.cargo,rearStock,key,t.cargo[key],config.rearCapacity);if(total(t.cargo)>0){t.reason='Depot full; returned cargo retained';continue;}}
        if(t.role==='convoy'){
          if(this.state.elapsed<(enemy?.nextDelivery??w.nextDelivery)){
            const passengers=this.state.operation?.campaign?.replacements?.manifests.some(m=>m.side===side&&m.stage==='edge');
            if(passengers&&t.fuel>=2){t.state='loading';t.timer=8;t.reason='Reserve passengers boarding · supplies remain scheduled';}
            else if(passengers)t.reason='Reserve transport waiting for scheduled fuel delivery';
            continue;
          }
          // A manifest enters the world at the map edge, never at the depot.
          if(total(config.manifest)>config.convoyCapacity){t.reason='Manifest exceeds convoy capacity';continue;}
          // Returned, undelivered stock stays aboard. A later scheduled delivery
          // tops up only the missing manifest; never overwrite or count it twice.
          let available=config.convoyCapacity-total(t.cargo);
          for(const key of RESOURCES){const added=Math.min(available,Math.max(0,config.manifest[key]-t.cargo[key]));t.cargo[key]+=added;available-=added;w.ledger.imported[key]+=added;}
          const added=Math.min(30-t.fuel,30);t.fuel+=added;w.ledger.imported.fuel+=added;
          if(enemy)enemy.nextDelivery=this.state.elapsed+config.deliveryInterval;else w.nextDelivery=this.state.elapsed+config.deliveryInterval;
          t.state='loading';t.timer=8;t.reason='Scheduled rear manifest loading';
        }else{
          const peopleTrip=(g:Garrison)=>Boolean(this.state.operation?.campaign?.replacements?.manifests.some(m=>m.side===side&&m.stage==='rear'&&g.squadIds.includes(m.squadId)))||this.state.soldiers.some(s=>s.combat?.careTask?.stage==='evacuate'&&distance(s.combat.careTask.destination,g.forward)<5);
          const demands=(g:Garrison)=>(w.supplyDemands??[]).filter(d=>d.garrisonId===g.id&&unfulfilled(d)>.00001&&rearStock[d.resource]>0);
          const priority=(g:Garrison)=>Math.min(peopleTrip(g)?3:6,...demands(g).map(d=>d.priority));
          const g=w.garrisons.filter(g=>(g.faction??'player')===side&&!this.reserved.has(g.id)&&(g.squadIds.length>0||this.state.soldiers.some(s=>s.garrisonId===g.id&&s.needs?.life==='active')||w.facilities.some(f=>f.garrisonId===g.id&&f.workOrder?.explicit&&f.workOrder.cancelledAt===undefined))&&(total(g.forwardStock)<config.forwardCapacity||peopleTrip(g))&&(demands(g).length>0||peopleTrip(g))).sort((a,b)=>priority(a)-priority(b)||a.id-b.id)[0];
          if(!g)continue;
          const fuel=transfer(rearStock,t.cargo,'fuel',Math.max(0,30-t.fuel));t.cargo.fuel-=fuel;t.fuel+=fuel;
          if(t.fuel<2){t.reason='Depot fuel shortage';continue;}
          let capacity=Math.min(config.shuttleCapacity-total(t.cargo),config.forwardCapacity-total(g.forwardStock));
          for(const d of demands(g)){const reserveLimit=d.priority<5?Infinity:d.resource==='ammo'?90:d.resource==='food'||d.resource==='water'?55:d.resource==='materials'?24:6;capacity-=transfer(rearStock,t.cargo,d.resource,Math.min(capacity,reserveLimit,unfulfilled(d)));}
          if(total(t.cargo)===0&&!peopleTrip(g)){t.reason='Depot empty';continue;}
          t.garrisonId=g.id;this.reserved.add(g.id);t.state='loading';t.timer=6;t.reason='Loading forward shipment';
          reconcileSupplyDemands(this.state);
        }
      }else if(t.state==='loading'){
        t.timer-=dt;if(t.timer>0)continue;
        this.depart(t,t.role==='convoy'?rear:assigned?.forward??rear,'outbound');
      }else if(t.state==='unloading'){
        t.timer-=dt;if(t.timer>0)continue;
        const stock=t.role==='convoy'?rearStock:assigned?.forwardStock??rearStock;
        const capacity=t.role==='convoy'?config.rearCapacity:config.forwardCapacity;
        let delivered=0;for(const key of RESOURCES)delivered+=transferBounded(t.cargo,stock,key,t.cargo[key],capacity);
        if(delivered>0&&t.role==='shuttle'&&assigned)assigned.lastDeliveryAt=this.state.elapsed;
        if(total(t.cargo)>0){
          if(t.role==='convoy'){this.depart(t,edge,'returning');t.reason='Rear depot full; returning undelivered cargo';}
          else {t.reason='Destination storage full; remaining cargo retained';t.timer=5;}
          continue;
        }
        this.depart(t,t.role==='convoy'?edge:rear,'returning');
      }else{
        const target=t.route[t.routeIndex];
        if(!target){
          if(t.state==='returning'){t.state='idle';delete t.garrisonId;t.reason='At depot';}
          else {t.state='unloading';t.timer=6;t.reason='Unloading at destination';}
          continue;
        }
        if(t.fuel<=0||!this.clear(t,target)){
          if(t.state!=='blocked')t.resume=t.state as 'outbound'|'returning';
          t.state='blocked';t.reason=t.fuel<=0?'Out of fuel; cargo retained':'Road severed or obstructed; cargo retained';continue;
        }
        if(t.state==='blocked')t.state=t.resume??'outbound';
        // Queue behind a truck on the same lane; opposing traffic uses the other lane visually.
        const dx=target.x-t.x,dz=target.z-t.z;
        const queued=w.trucks.some(o=>{const aim=o.route[o.routeIndex];return o!==t&&aim&&distance(t,o)<7&&(aim.x-o.x)*dx+(aim.z-o.z)*dz>0&&(o.x-t.x)*dx+(o.z-t.z)*dz>0;});
        if(queued){t.reason='Road queue';continue;}
        const d=distance(t,target),step=Math.min(d,dt*12),fuel=Math.min(t.fuel,step*.0006);
        t.fuel-=fuel;w.ledger.consumed.fuel+=fuel;
        if(d>0){t.x+=(target.x-t.x)*step/d;t.z+=(target.z-t.z)*step/d;}
        if(d<=step+.01)t.routeIndex++;
      }
    }
  }
  shipmentStock(g:Garrison):Inventory{return g.forwardStock;}
}
