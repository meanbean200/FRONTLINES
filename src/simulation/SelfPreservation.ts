import {distance,distanceToSegment,polylineLength,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import {consume,transferBounded,carrierCapacity} from '../garrison/Inventory';
import {inventory,type Inventory} from '../garrison/types';
import {squadContacts} from '../operations/Visibility';
import {doorPoint} from '../terrain/BuildingGeometry';
import {bodyBlocks} from '../navigation/FriendlyTraffic';
import {routeJoin} from '../navigation/RouteJoin';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {effectiveSquad} from '../operations/AssaultPlan';
import {chooseLocalCover,CoverSpace} from '../combat/LocalCover';

export interface SelfCare {
  kind:'sleep'|'field-rest'|'meal'|'resupply'|'supply-wait'; stage:'exit'|'outbound'|'use'|'return';
  orderAt:number; since:number; until:number; blockedFor:number;
  home:Vec2 & {building?:{id:number;floor:0|1;target:Vec2}};
  route:Vec2[]; index:number;
  retryAt?:number;
  recovering?:boolean;
  /** Mobile breaks rejoin the remaining route, not the spot where the break began. */
  mobile?:boolean;
  rationUntil?:number;
  networkBound?:boolean;
  source?:{kind:'cache'|'forward'|'facility'|'rear'|'crate';id:number};
}
interface Source extends Vec2 {stock:Inventory;ref:NonNullable<SelfCare['source']>}
const careGraphs=new WeakMap<BattlefieldState,TrenchNetwork>();
const careGraphTicks=new WeakMap<BattlefieldState,number>();
function graphFor(state:BattlefieldState){let g=careGraphs.get(state);if(!g){g=new TrenchNetwork();careGraphs.set(state,g);}if(careGraphTicks.get(state)!==state.elapsed){g.sync(state.trenches);careGraphTicks.set(state,state.elapsed);}return g;}
function routeTo(nav:SquadNavigation,from:Vec2,to:Vec2):Vec2[]{
  const route=nav.plan(from,to,undefined,true);if(!route.length||!nav.segmentClear(route.at(-1)!,to,.4))return [];
  return [...route,{x:to.x,z:to.z}];
}
function sources(state:BattlefieldState,s:SoldierState):Source[]{
  const w=state.living!,side=state.squads.find(q=>q.id===s.squadId)?.faction??'player';
  const areas=w.garrisons.filter(g=>(g.faction??'player')===side);
  const rear=side==='enemy'?w.enemySupply&&{...w.enemySupply.rear,stock:w.enemySupply.stock,ref:{kind:'rear' as const,id:1}}:{...w.rear,stock:w.rearStock,ref:{kind:'rear' as const,id:0}};
  // An assigned recovery target is already known. Other loose stock contributes
  // only when it is our own dropped pack, an owned objective, or a peaceful world.
  const crates=w.crates.filter(c=>!state.operation||c.id===s.duty?.crateId||c.droppedBy!==undefined&&state.soldiers.some(p=>p.id===c.droppedBy&&(state.squads.find(q=>q.id===p.squadId)?.faction??'player')===side)||state.operation?.objectives.some(o=>o.cacheId===c.id&&o.owner===side));
  return [...areas.flatMap(g=>[{...g.entrance,stock:g.cache,ref:{kind:'cache' as const,id:g.id}},{...g.forward,stock:g.forwardStock,ref:{kind:'forward' as const,id:g.id}}]),
    ...w.facilities.filter(f=>f.progress===1&&areas.some(g=>g.id===f.garrisonId)&&['store','meal'].includes(f.kind)).map(f=>({...f,ref:{kind:'facility' as const,id:f.id}})),...crates.map(c=>({...c,ref:{kind:'crate' as const,id:c.id}})),...(rear?[rear]:[])];
}
function threatened(state:BattlefieldState,s:SoldierState,from:Vec2,route:Vec2[]):boolean {
  // Only delivered/local contacts, never hidden enemy coordinates.
  return squadContacts(state,s.squadId).some(c=>state.elapsed-c.lastSeen<15&&route.some((p,i)=>distanceToSegment(c,i?route[i-1]:from,p).distance<100));
}
function consumePack(state:BattlefieldState,s:SoldierState):void {
  const n=s.needs!,pack=s.carried??=inventory();
  if(n.hunger>35)n.hunger=Math.max(0,n.hunger-40*consume(state,pack,'food',Math.min(1,pack.food)));
  if(n.thirst>35)n.thirst=Math.max(0,n.thirst-50*consume(state,pack,'water',Math.min(1,pack.water)));
}
function finish(state:BattlefieldState,s:SoldierState,nav:SquadNavigation):void {
  if(s.selfCare?.mobile&&(s.selfCare.kind==='resupply'||s.selfCare.kind==='field-rest'&&s.selfCare.route.length>0)){
    delete s.formationTravel;delete s.pathTravel;
    const d=s.duty;
    if(d){
      const offset=d.routeIndex,join=routeJoin(d.route.slice(offset),s,(a,b)=>d.networkBound?graphFor(state).segmentInside(a,b):nav.segmentClear(a,b,.5));
      if(join){d.routeIndex=offset+join.index;d.route.splice(d.routeIndex,0,join.point);}
    }
  }
  delete s.selfCare;delete s.survivalReason;
}
/** General safety layer for people not currently served by a trench routine.
 * Holds building reservations and formation intentions, with real exits, stock
 * collection and return. No meter refill or remote inventory transfer. */
export function stepSelfPreservation(state:BattlefieldState,terrain:TerrainSystem,nav:SquadNavigation,dt:number):void {
  if(!state.living)return;
  const squads=new Map(state.squads.map(q=>[q.id,q]));
  let restSpace:CoverSpace|undefined;
  for(const s of state.soldiers){
    const n=s.needs,formation=squads.get(s.squadId);if(!n||!formation||n.life==='dead')continue;
    const q=effectiveSquad(state,s,formation);
    if(n.life==='incapacitated'){
      // An exhausted person can eat their own pack or stock within arm's reach;
      // never march an incapacitated casualty or remotely refill their meters.
      if(!s.combat?.wound&&s.health>=25){
        const pack=s.carried??=inventory(),near=sources(state,s).find(p=>distance(p,s)<2.5);
        if(near)for(const key of ['water','food'] as const)transferBounded(near.stock,pack,key,Math.max(0,1-pack[key]),carrierCapacity(pack,state.living.logistics!.carrierCapacity));
        consumePack(state,s);
      }
      continue;
    }
    const c=s.combat??{shotSequence:0};
    let task=s.selfCare;
    if(task&&task.orderAt!==q.order.issuedAt){delete s.selfCare;task=undefined;delete s.survivalReason;}
    const unsafe=s.suppression>=20||state.elapsed-(c.lastIncoming??-1000)<12;
    const urgentRation=Math.max(n.hunger,n.thirst)>=85&&((n.hunger>=55&&(s.carried?.food??0)>0)||(n.thirst>=50&&(s.carried?.water??0)>0));
    const recoveringInPlace=()=>task?.kind==='field-rest'&&task.stage==='use'||Boolean(task?.recovering);
    // Critical in-place drinking can happen while pinned, but never displaces
    // an active rescue or sends the person on an exposed errand.
    if(c.owner==='casualty'||c.owner==='support'&&n.energy>10&&!recoveringInPlace()||c.owner==='reaction'&&c.reaction!=='steady'&&!urgentRation&&n.energy>10&&!recoveringInPlace()){
      if(task)s.survivalReason='Survival break interrupted by danger or casualty care · order retained';
      continue;
    }
    // Legacy supply-wait must not trap a healthy person indefinitely. Missing
    // food/water is no longer a life-threatening reason to abandon an order.
    if(task?.kind==='supply-wait'){delete s.selfCare;task=undefined;s.nextSelfCareReview=0;}
    if(!task){
      // Existing garrison duties already perform physical resupply and watch relief.
      const travellingDuty=s.duty&&s.duty.arrivedAt===undefined;
      const served=s.duty&&!travellingDuty||s.garrisonId!==undefined&&!s.duty&&!s.building&&!q.order.building&&q.order.type==='occupy-trench';
      const nearbyRest=travellingDuty&&s.duty!.kind==='sleep'&&n.energy>15&&polylineLength([s,...s.duty!.route.slice(s.duty!.routeIndex)])<60;
      const criticalDuty=s.duty?.arrivedAt!==undefined&&!['sleep','rest','meal'].includes(s.duty.kind)&&n.energy<=25;
      if(served&&!urgentRation&&!criticalDuty||nearbyRest||state.elapsed<(s.nextSelfCareReview??0))continue;
      s.nextSelfCareReview=state.elapsed+5+(s.id%5)*.1;delete s.survivalReason;
      const pack=s.carried??=inventory(),hungry=n.hunger>=55,thirsty=n.thirst>=50;
      const packed=hungry&&pack.food>0||thirsty&&pack.water>0;
      const stationary=!travellingDuty&&(q.order.type==='hold'||q.order.type==='occupy-trench'||Boolean(s.building?.stage==='station'));
      const exhausted=n.energy<=25,need=hungry&&!pack.food;
      if(!exhausted&&!packed&&!need)continue;
      if(unsafe&&!urgentRation&&n.energy>10){s.survivalReason='Needs relief · incoming fire makes a supply/rest break unsafe';continue;}
      const home={x:s.x,z:s.z,...(s.building?{building:{id:s.building.id,floor:s.building.targetFloor,target:{...s.building.target}}}:{})};
      const start=(kind:SelfCare['kind'],stage:SelfCare['stage'],until=state.elapsed+6):SelfCare=>({kind,stage,orderAt:q.order.issuedAt,since:state.elapsed,until,blockedFor:0,home,route:[],index:0,mobile:!stationary});
      const resting=state.soldiers.filter(p=>p.squadId===q.id&&['sleep','field-rest'].includes(p.selfCare?.kind??'')).length;
      const sleepAvailable=!stationary||resting<Math.max(1,Math.ceil(q.soldierIds.length/4))||n.energy<8;
      if(packed&&n.energy>=8){task=start('meal','use');}
      else if(exhausted&&sleepAvailable){
        task=start('field-rest','use',state.elapsed+45);
        // Nearby protection only, never a journey to a distant bed. A critical
        // collapse risk rests where stopped; existing duties/routes stay owned.
        if(n.energy>10&&!s.building){
          const cover=chooseLocalCover(s,q,terrain,nav,restSpace??=new CoverSpace(state),unsafe).point;
          if(cover&&(!s.duty?.networkBound||graphFor(state).segmentInside(s,cover))){task.route=[cover];task.stage='outbound';task.networkBound=Boolean(s.duty?.networkBound);}
        }
      }
      else if(need){
        if(s.duty?.kind==='meal')continue; // The existing meal approach owns its queue and collection trip.
        // A withdrawal already has a physical ration-sharing destination. Do
        // not dispatch a second independent trip that stockpiles its reserves.
        if(state.living.garrisons.some(g=>g.id===s.garrisonId&&g.cutoff==='withdraw'))continue;
        const away=state.soldiers.filter(p=>p.squadId===q.id&&p.selfCare?.kind==='resupply').length;
        if(away>=Math.max(1,Math.ceil(q.soldierIds.length/4))){continue;}
        const from=s.building?doorPoint(terrain.buildings[s.building.id],8):s;
        const localRange=120;
        const candidates=sources(state,s).filter(p=>distance(s,p)<localRange&&hungry&&p.stock.food>0).sort((a,b)=>distance(s,a)-distance(s,b)||a.ref.id-b.ref.id);
        const network=s.duty?.networkBound?graphFor(state):undefined,hit=network?.nearest(s),component=hit&&network!.nodes[network!.edges[hit.edge].a].component;
        for(const source of task?[]:candidates){
          const sourceHit=network?.nearest(source,component);
          const route=network?(component!==undefined&&sourceHit&&sourceHit.distance<=2.5?network.route(s,sourceHit.point,component):[]):routeTo(nav,from,source);
          if(!route.length||threatened(state,s,from,route))continue;
          task=start('resupply',s.building?'exit':'outbound');task.source=source.ref;task.route=route;task.networkBound=Boolean(network);break;
        }
        if(!task){
          s.survivalReason='Food unavailable locally · continuing orders with slower recovery';
          s.nextSelfCareReview=state.elapsed+30;continue;
        }
      }
      if(!task){if(exhausted)s.survivalReason='Waiting for rest relief · duty retained';continue;}s.selfCare=task;s.combat??=c;if(task.kind!=='supply-wait')n.taskChanges++;
    }
    if(unsafe&&!urgentRation&&n.energy>10&&!recoveringInPlace()){s.survivalReason='Recovery paused under fire · standing order retained';continue;}
    s.survivalReason=task.kind==='field-rest'?'RESTING · short field recovery; order retained':task.kind==='sleep'?'Sleeping · order retained':task.kind==='meal'?'Eating / drinking carried rations · order retained':task.stage==='return'?'Returning to assigned position':task.stage==='exit'?'Leaving through the door to collect supplies':'Collecting food locally · order retained';
    if(task.stage==='exit'){
      if(s.building)continue;
      c.owner='self-care';s.action='waiting for supply route';
      if(state.elapsed<(task.retryAt??0))continue;task.retryAt=state.elapsed+5;
      const source=sources(state,s).find(p=>p.ref.kind===task!.source?.kind&&p.ref.id===task!.source.id);
      task.route=source?routeTo(nav,s,source):[];task.index=0;
      if(!task.route.length){s.survivalReason='Supply route blocked after exiting';continue;}task.stage='outbound';
    }
    if(task.stage==='return'&&task.home.building){
      if(s.building?.stage==='station'&&s.building.id===task.home.building.id&&s.building.floor===task.home.building.floor){delete s.selfCare;delete s.survivalReason;}
      continue; // BuildingSystem owns the door, stairs and original firing place.
    }
    c.owner='self-care';c.pauseReason=s.survivalReason;
    if(task.kind==='resupply'&&task.stage!=='use'){
      if(n.energy<12)task.recovering=true;
      if(task.recovering&&n.energy>=45)delete task.recovering;
      if(task.recovering){s.action='resting';s.posture='crouched';s.survivalReason='RESTING on supply route · trip and standing order retained';c.pauseReason=s.survivalReason;continue;}
    }
    if(task.stage==='use'){
      // A long recovery includes a real, timed ration break rather than silently
      // consuming stock while the renderer still shows a sleeping soldier.
      if(task.kind==='sleep'){
        if(task.rationUntil===undefined&&(n.hunger>=55&&(s.carried?.food??0)>0||n.thirst>=50&&(s.carried?.water??0)>0))task.rationUntil=state.elapsed+6;
        if(task.rationUntil!==undefined){s.action='eating';s.posture='crouched';if(state.elapsed>=task.rationUntil){consumePack(state,s);delete task.rationUntil;}continue;}
      }
      s.action=task.kind==='field-rest'?'resting':task.kind==='sleep'?'sleeping':'eating';s.posture=task.kind==='sleep'||c.reaction==='pinned'?'prone':'crouched';
      if(state.elapsed<task.until||['sleep','field-rest'].includes(task.kind)&&n.energy<45)continue;
      if(!['sleep','field-rest'].includes(task.kind))consumePack(state,s);
      if(task.kind!=='resupply'||task.mobile){finish(state,s,nav);continue;}
      task.stage='return';task.index=0;
      if(!task.home.building)task.route=routeTo(nav,s,task.home);
      continue;
    }
    const target=task.route[task.index];
    if(!target){
      if(task.kind==='field-rest'){task.stage='use';task.until=state.elapsed+45;continue;}
      if(task.stage==='return'){
        if(distance(s,task.home)>.8){
          if(state.elapsed>=(task.retryAt??0)){task.route=routeTo(nav,s,task.home);task.index=0;task.retryAt=state.elapsed+5;}
          s.action='waiting for return route';s.survivalReason='Return route blocked · order retained';continue;
        }
        delete s.selfCare;delete s.survivalReason;continue;
      }
      const source=sources(state,s).find(p=>p.ref.kind===task!.source?.kind&&p.ref.id===task!.source.id);
      if(!source||distance(s,source)>2.5){s.survivalReason='Supply point unavailable · return to position';task.stage='return';task.index=0;task.route=routeTo(nav,s,task.home);continue;}
      const pack=s.carried??=inventory(),capacity=carrierCapacity(pack,state.living.logistics!.carrierCapacity);
      transferBounded(source.stock,pack,'water',Math.max(0,3-pack.water),capacity);
      transferBounded(source.stock,pack,'food',Math.max(0,2-pack.food),capacity);
      task.stage='use';task.until=state.elapsed+6;continue;
    }
    if(distance(s,target)<.5){task.index++;continue;}
    const heading=Math.atan2(target.x-s.x,target.z-s.z),step=Math.min(distance(s,target),dt*1.6),clear=(p:Vec2)=>!terrain.obstacleAt(p.x,p.z,.4)&&(!task!.networkBound||graphFor(state).segmentInside(s,p))&&!state.soldiers.some(o=>bodyBlocks(state,s,o,p,.55));
    let next:Vec2|undefined;
    for(const offset of [0,.65,-.65,1.2,-1.2]){const p={x:s.x+Math.sin(heading+offset)*step,z:s.z+Math.cos(heading+offset)*step};if(clear(p)){next=p;break;}}
    if(!next){task.blockedFor+=dt;s.action='waiting for supply route';s.survivalReason='Supply route blocked · standing order retained';if(task.kind==='field-rest'&&task.blockedFor>=2){task.stage='use';task.until=state.elapsed+45;}continue;}
    task.blockedFor=0;s.heading=heading;s.x=next.x;s.z=next.z;s.action=task.kind==='field-rest'?'seeking cover':task.stage==='return'?'returning from supply':'walking to supply';s.cover=terrain.coverAt(s.x,s.z);
  }
}
