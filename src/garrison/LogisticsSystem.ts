import { distance, lerpVec,WORLD_VERSION,WORLD_SIZE, type BattlefieldState, type Vec2 } from '../core/types';
import {supplyRoadZ,nearestRoad,roadRoute,convoyEntry,rearDepot,pointOnRoad,ROADS,insideWorld} from '../terrain/WorldLayout';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import { inventory, RESOURCES, type Garrison, type Inventory, type Truck, type LogisticsConfig } from './types';
import { total, transfer, transferBounded } from './Inventory';
import {reconcileSupplyDemands,unfulfilled} from './SupplyDemand';
import { freshNeeds } from './NeedsSystem';
import {RULES_VERSION} from './GarrisonPolicy';
import {initializeEquipment,equipmentOf} from '../combat/Equipment';
import {loadEndlessManifest,stepEndlessAvailability} from '../operations/EndlessEconomy';
import {eyeHeight} from '../operations/Visibility';
import {smokeTransmission} from '../combat/SupportWeapons';

export function roadPoint(x:number):Vec2{return {x,z:supplyRoadZ(x)};}
export const defaultLogistics=():LogisticsConfig=>({deliveryInterval:450,manifest:inventory({food:400,water:600,materials:120,fuel:180,ammo:160,medical:12,mortarHE:12,mortarSmoke:6,smokeGrenades:10}),rearCapacity:12000,forwardCapacity:400,cacheCapacity:600,storeCapacity:600,convoyCapacity:1500,shuttleCapacity:140,carrierCapacity:16});
export function initializeLiving(state:BattlefieldState):void {
  initializeEquipment(state);
  if(state.living){state.living.logistics??=defaultLogistics();return;}
  // This is fresh-state initialization, never save compatibility/migration.
  state.worldVersion??=WORLD_VERSION;state.worldSize??=WORLD_SIZE;
  const rear=rearDepot(),stock=inventory({food:400,water:500,materials:300,fuel:500,ammo:1000});
  state.schemaVersion=4;
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
  forwardPoint(entrance:Vec2,side:'player'|'enemy'='player'):Vec2 {
    const nearest=nearestRoad(entrance);
    if(this.clear(nearest.point,nearest.point))return nearest.point;
    const rear=side==='enemy'?this.state.living!.enemySupply?.rear??this.state.living!.rear:this.state.living!.rear;
    // A trench may cut the road directly under its nearest projection. Pick
    // a real, accessible unloading apron on the depot's side of the local cut.
    // This does not bypass a severed road elsewhere along a shipment's route.
    for(let offset=6;offset<=42;offset+=6){
      const points=[-1,1].map(sign=>pointOnRoad(ROADS[nearest.road],nearest.t+offset*sign)).sort((a,b)=>distance(a,rear)-distance(b,rear));
      for(const p of points){if(!insideWorld(p,10)||!this.clear(p,p))continue;
        const route=roadRoute(rear,p);let previous=rear;
        if(route.every(next=>{const clear=this.clear(previous,next);previous=next;return clear;}))return p;
      }
    }
    return nearest.point;
  }
  private clear(a:Vec2,b:Vec2):boolean {
    const n=Math.max(1,Math.ceil(distance(a,b)/2));for(let i=0;i<=n;i++){const p=lerpVec(a,b,i/n);
      if(this.terrain.obstacleAt(p.x,p.z,1.6)||this.terrain.groundTypeAt(p.x,p.z)==='river'||this.terrain.deformationAt(p.x,p.z)<-.35)return false;
    }return true;
  }
  private depart(t:Truck,destination:Vec2,state:'outbound'|'returning'):void{t.destination={...destination};t.route=roadRoute(t,destination);t.routeIndex=0;t.state=state;delete t.resume;delete t.blockedSince;t.reason=state==='outbound'?'En route':'Returning to depot';}
  private recoverRoute(t:Truck):void {
    const now=this.state.elapsed;t.blockedSince??=now;
    if(now-t.blockedSince<2||now<(t.nextRepath??0))return;
    t.nextRepath=now+10;
    const destination=t.destination??t.route.at(-1);if(!destination)return;
    const route=roadRoute(t,destination,(a,b)=>this.clear(a,b));
    if(!route.length){t.reason='ROUTE BLOCKED · no usable road alternative · cargo retained';return;}
    t.route=route;t.routeIndex=0;t.state=t.resume??'outbound';delete t.resume;delete t.blockedSince;t.reason='Road alternative found · cargo retained';
  }
  /** Physical road occupation, not remote commander knowledge or vehicle hit points. */
  private blockade(t:Truck):boolean {
    if(!this.state.operation)return false;
    const side=t.faction??'player';
    const nearby=this.state.soldiers.filter(s=>s.needs?.life==='active'&&s.health>=25&&s.suppression<70&&(s.carried?.ammo??0)>0&&equipmentOf(this.state,s).weapon!=='unarmed'&&distance(s,t)<24&&this.terrain.objects.trace(t,s,this.terrain.heightAt(t.x,t.z)+2,eyeHeight(this.terrain,s),false).clear&&smokeTransmission(this.state,t,s)>.4);
    const hostile=nearby.filter(s=>(this.state.squads.find(q=>q.id===s.squadId)?.faction??'player')!==side).length;
    const escort=nearby.length-hostile;
    if(hostile<2||hostile<=escort){delete t.interdictedSince;return false;}
    t.interdictedSince??=this.state.elapsed;
    if(t.state!=='blocked')t.resume=t.state==='returning'?'returning':'outbound';
    t.state='blocked';t.reason='ROAD INTERDICTED · opposing troops control this stretch · cargo aboard';
    const passengers=this.state.operation.campaign?.replacements?.manifests.some(m=>m.truckId===t.id&&m.stage!=='arrived')||t.passengers?.length;
    if(this.state.elapsed-t.interdictedSince>=8&&!passengers){
      // This is an abandoned load, not destroyed stock. A carrier must still
      // reach it and physically return it before any friendly store benefits.
      // Choose nearby usable ground, not an arbitrary offset inside a wall.
      // If the roadside is boxed in, cargo remains recoverable at the vehicle.
      const spot=Array.from({length:8},(_,i)=>({x:t.x+Math.cos(i*Math.PI/4)*3,z:t.z+Math.sin(i*Math.PI/4)*3})).find(p=>insideWorld(p,1)&&this.clear(t,p))??t;
      const c={id:this.state.nextEntityId++,x:spot.x,z:spot.z,stock:t.cargo,faction:side,truckId:t.id};
      this.state.living!.crates.push(c);t.cargo=inventory();t.salvageId=c.id;t.abandoned=true;t.reason='ABANDONED · surviving cargo unloaded beside vehicle';
    }
    return true;
  }
  step(dt:number):void {
    const w=this.state.living!,config=w.logistics!;
    stepEndlessAvailability(this.state);
    for(const g of w.garrisons){
      if(g.cutoff==='withdraw'||total(g.forwardStock)>0||this.clear(g.forward,g.forward))continue;
      // Existing stocked depots and in-flight handovers stay at their physical
      // location. Only an empty invalid apron with no foot/medical trip can move.
      if(this.state.soldiers.some(s=>s.garrisonId===g.id&&s.duty?.kind==='haul'&&s.duty.stage==='pickup'&&!s.duty.crateId&&!s.duty.patientId&&!s.duty.facilityId||s.combat?.careTask&&distance(s.combat.careTask.destination,g.forward)<10))continue;
      if(w.trucks.some(t=>t.garrisonId===g.id&&t.state==='unloading'))continue;
      if(this.state.elapsed<(g.nextRoadheadReview??0))continue;g.nextRoadheadReview=this.state.elapsed+5;
      const next=this.forwardPoint(g.entrance,g.faction??'player');if(distance(next,g.forward)<1||!this.clear(next,next))continue;
      g.forward=next;
      for(const t of w.trucks.filter(t=>!t.abandoned&&t.garrisonId===g.id&&(t.state==='outbound'||t.state==='blocked'&&t.resume==='outbound'))){this.depart(t,next,'outbound');t.reason='Rerouting to accessible unloading apron · cargo retained';}
    }
    reconcileSupplyDemands(this.state);
    this.reserved=new Set(w.trucks.filter(t=>!t.abandoned&&t.garrisonId!==undefined&&t.state!=='idle').map(t=>t.garrisonId!));
    for(const t of w.trucks){
      if(t.abandoned)continue;
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
          if(this.state.operation?.battleMode==='endless')loadEndlessManifest(this.state,t,rearStock);
          else {
            let available=config.convoyCapacity-total(t.cargo);
            for(const key of RESOURCES){const added=Math.min(available,Math.max(0,config.manifest[key]-t.cargo[key]));t.cargo[key]+=added;available-=added;w.ledger.imported[key]+=added;}
            const added=Math.min(30-t.fuel,30);t.fuel+=added;w.ledger.imported.fuel+=added;
          }
          if(enemy)enemy.nextDelivery=this.state.elapsed+config.deliveryInterval;else w.nextDelivery=this.state.elapsed+config.deliveryInterval;
          if(this.state.operation?.endless&&total(t.cargo)===0&&!this.state.operation.campaign?.replacements?.manifests.some(m=>m.side===side&&m.stage==='edge')){t.reason='Rear target stocked or authorized supply exhausted';continue;}
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
        if(this.blockade(t))continue;
        const destination=t.role==='convoy'?rear:assigned?.forward??rear;
        if(distance(t,nearestRoad(destination).point)>5){this.depart(t,destination,'outbound');t.reason='Destination moved · travelling with cargo';continue;}
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
        if(this.blockade(t))continue;
        const target=t.route[t.routeIndex];
        if(!target){
          const returning=t.state==='returning'||t.resume==='returning',destination=t.destination??(returning?t.role==='convoy'?edge:rear:t.role==='convoy'?rear:assigned?.forward??rear);
          t.destination??={...destination};
          if(distance(t,nearestRoad(destination).point)>3){t.resume=returning?'returning':'outbound';t.state='blocked';t.reason='ROUTE BLOCKED · route incomplete · cargo retained';this.recoverRoute(t);continue;}
          if(returning){t.state='idle';delete t.resume;delete t.garrisonId;t.reason='At depot';}
          else {t.state='unloading';t.timer=6;t.reason='Unloading at destination';}
          continue;
        }
        if(t.fuel<=0||!this.clear(t,target)){
          if(t.state!=='blocked')t.resume=t.state as 'outbound'|'returning';
          t.state='blocked';t.reason=t.fuel<=0?'Out of fuel; cargo retained':'Road severed or obstructed; cargo retained';if(t.fuel>0)this.recoverRoute(t);continue;
        }
        if(t.state==='blocked'){t.state=t.resume??'outbound';delete t.resume;delete t.blockedSince;t.reason='Road reopened · cargo retained';}
        // Queue behind a truck on the same lane; opposing traffic uses the other lane visually.
        const dx=target.x-t.x,dz=target.z-t.z;
        const queued=w.trucks.some(o=>{
          const aim=o.route[o.routeIndex];if(o===t||o.abandoned||!aim||distance(t,o)>=7)return false;
          const ox=aim.x-o.x,oz=aim.z-o.z;
          if(ox*dx+oz*dz<=0||(o.x-t.x)*dx+(o.z-t.z)*dz<=.1)return false;
          // Two lanes converging toward one waypoint can each classify the
          // other as ahead. Stable right of way breaks that mutual wait; normal
          // same-lane followers still queue behind their physical leader.
          const mutual=(t.x-o.x)*ox+(t.z-o.z)*oz>.1;
          return !mutual||o.id<t.id;
        });
        if(queued){t.reason='Road queue';continue;}
        if(['Road queue','Out of fuel; cargo retained','Road severed or obstructed; cargo retained'].includes(t.reason))t.reason=t.state==='returning'?'Returning to depot':'En route';
        const d=distance(t,target),step=Math.min(d,dt*12),fuel=Math.min(t.fuel,step*.0006);
        t.fuel-=fuel;w.ledger.consumed.fuel+=fuel;
        if(d>0){t.x+=(target.x-t.x)*step/d;t.z+=(target.z-t.z)*step/d;}
        if(d<=step+.01)t.routeIndex++;
      }
    }
  }
  shipmentStock(g:Garrison):Inventory{return g.forwardStock;}
}
