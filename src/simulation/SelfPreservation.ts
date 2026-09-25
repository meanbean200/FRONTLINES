import {distance,distanceToSegment,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import {consume,transferBounded,carrierCapacity} from '../garrison/Inventory';
import {inventory,type Inventory} from '../garrison/types';
import {squadContacts} from '../operations/Visibility';
import {doorPoint} from '../terrain/BuildingGeometry';

export interface SelfCare {
  kind:'sleep'|'meal'|'resupply'; stage:'exit'|'outbound'|'use'|'return';
  orderAt:number; since:number; until:number; blockedFor:number;
  home:Vec2 & {building?:{id:number;floor:0|1;target:Vec2}};
  route:Vec2[]; index:number;
  retryAt?:number;
  recovering?:boolean;
  source?:{kind:'cache'|'forward'|'facility'|'rear';id:number};
}
interface Source extends Vec2 {stock:Inventory;ref:NonNullable<SelfCare['source']>}
function routeTo(nav:SquadNavigation,from:Vec2,to:Vec2):Vec2[]{
  const route=nav.plan(from,to,undefined,true);if(!route.length||!nav.segmentClear(route.at(-1)!,to,.4))return [];
  return [...route,{x:to.x,z:to.z}];
}
function sources(state:BattlefieldState,s:SoldierState):Source[]{
  const w=state.living!,side=state.squads.find(q=>q.id===s.squadId)?.faction??'player';
  const areas=w.garrisons.filter(g=>(g.faction??'player')===side);
  const rear=side==='enemy'?w.enemySupply&&{...w.enemySupply.rear,stock:w.enemySupply.stock,ref:{kind:'rear' as const,id:1}}:{...w.rear,stock:w.rearStock,ref:{kind:'rear' as const,id:0}};
  return [...areas.flatMap(g=>[{...g.entrance,stock:g.cache,ref:{kind:'cache' as const,id:g.id}},{...g.forward,stock:g.forwardStock,ref:{kind:'forward' as const,id:g.id}}]),
    ...w.facilities.filter(f=>f.progress===1&&areas.some(g=>g.id===f.garrisonId)&&['store','meal'].includes(f.kind)).map(f=>({...f,ref:{kind:'facility' as const,id:f.id}})),...(rear?[rear]:[])];
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
/** General safety layer for people not currently served by a trench routine.
 * Holds building reservations and formation intentions, with real exits, stock
 * collection and return. No meter refill or remote inventory transfer. */
export function stepSelfPreservation(state:BattlefieldState,terrain:TerrainSystem,nav:SquadNavigation,dt:number):void {
  if(!state.living)return;
  const squads=new Map(state.squads.map(q=>[q.id,q]));
  for(const s of state.soldiers){
    const n=s.needs,q=squads.get(s.squadId);if(!n||!q||n.life==='dead')continue;
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
    if(c.owner==='casualty'||c.owner==='support'||c.owner==='reaction'&&c.reaction!=='steady'){
      if(task)s.survivalReason='Survival break interrupted by danger or casualty care · order retained';
      continue;
    }
    if(!task){
      // Existing garrison duties already perform physical resupply and watch relief.
      if(s.duty||s.garrisonId!==undefined&&!s.building&&!q.order.building||state.elapsed<(s.nextSelfCareReview??0))continue;
      s.nextSelfCareReview=state.elapsed+5+(s.id%5)*.1;delete s.survivalReason;
      const pack=s.carried??=inventory(),hungry=n.hunger>=55,thirsty=n.thirst>=50;
      const packed=hungry&&pack.food>0||thirsty&&pack.water>0;
      const stationary=q.order.type==='hold'||q.order.type==='occupy-trench'||Boolean(s.building?.stage==='station');
      const exhausted=n.energy<18,need=(hungry&&!pack.food)||(thirsty&&!pack.water);
      if(!exhausted&&!packed&&!need)continue;
      if(unsafe){s.survivalReason='Needs relief · incoming fire makes a supply/rest break unsafe';continue;}
      if(!stationary&&!exhausted&&Math.max(n.hunger,n.thirst)<80)continue;
      const home={x:s.x,z:s.z,...(s.building?{building:{id:s.building.id,floor:s.building.targetFloor,target:{...s.building.target}}}:{})};
      const start=(kind:SelfCare['kind'],stage:SelfCare['stage'],until=state.elapsed+6):SelfCare=>({kind,stage,orderAt:q.order.issuedAt,since:state.elapsed,until,blockedFor:0,home,route:[],index:0});
      const resting=state.soldiers.filter(p=>p.squadId===q.id&&p.selfCare?.kind==='sleep').length;
      const sleepAvailable=resting<Math.max(1,Math.ceil(q.soldierIds.length/4))||n.energy<8;
      if(exhausted&&sleepAvailable&&(Math.max(n.hunger,n.thirst)<75||n.energy<8)){task=start('sleep','use',state.elapsed+45);}
      else if(packed){task=start('meal','use');}
      else if(need){
        const away=state.soldiers.filter(p=>p.squadId===q.id&&p.selfCare?.kind==='resupply').length;
        if(away>=Math.max(1,Math.ceil(q.soldierIds.length/4))&&Math.max(n.hunger,n.thirst)<85){s.survivalReason='Waiting for relief to return with supplies';continue;}
        const from=s.building?doorPoint(terrain.buildings[s.building.id],8):s;
        const localRange=Math.max(n.hunger,n.thirst)>=85?800:400;
        const candidates=sources(state,s).filter(p=>distance(s,p)<localRange&&(hungry&&p.stock.food>0||thirsty&&p.stock.water>0)).sort((a,b)=>distance(s,a)-distance(s,b)||a.ref.id-b.ref.id);
        for(const source of candidates){
          const route=routeTo(nav,from,source);
          if(!route.length||threatened(state,s,from,route))continue;
          task=start('resupply',s.building?'exit':'outbound');task.source=source.ref;task.route=route;break;
        }
        if(!task){s.survivalReason=`Food/water needed · no stocked, safe supply route within ${localRange} m`;continue;}
      }
      if(!task){if(exhausted)s.survivalReason='Waiting for rest relief · duty retained';continue;}s.selfCare=task;s.combat??=c;n.taskChanges++;
    }
    if(unsafe){s.survivalReason='Survival break paused under fire · standing order retained';continue;}
    s.survivalReason=task.kind==='sleep'?'Recovering exhaustion · order retained':task.kind==='meal'?'Eating carried rations · order retained':task.stage==='return'?'Returning to assigned position':task.stage==='exit'?'Leaving through the door to collect supplies':'Collecting food and water · order retained';
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
      if(task.recovering){s.action='sleeping';s.posture='prone';s.survivalReason='Resting on supply route · trip and standing order retained';c.pauseReason=s.survivalReason;continue;}
    }
    if(task.stage==='use'){
      if(task.kind==='sleep'&&Math.max(n.hunger,n.thirst)>=80&&n.energy>=18){delete s.selfCare;s.nextSelfCareReview=state.elapsed;continue;}
      s.action=task.kind==='sleep'?'sleeping':'eating';s.posture=task.kind==='sleep'?'prone':'crouched';
      if(state.elapsed<task.until||task.kind==='sleep'&&n.energy<45)continue;
      if(task.kind!=='sleep')consumePack(state,s);
      if(task.kind!=='resupply'){delete s.selfCare;delete s.survivalReason;continue;}
      task.stage='return';task.index=0;
      if(!task.home.building)task.route=routeTo(nav,s,task.home);
      continue;
    }
    const target=task.route[task.index];
    if(!target){
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
    const heading=Math.atan2(target.x-s.x,target.z-s.z),step=Math.min(distance(s,target),dt*1.6),clear=(p:Vec2)=>!terrain.obstacleAt(p.x,p.z,.4)&&!state.soldiers.some(o=>o!==s&&o.needs?.life==='active'&&distance(o,p)<.55&&distance(o,p)<distance(o,s));
    let next:Vec2|undefined;
    for(const offset of [0,.65,-.65,1.2,-1.2]){const p={x:s.x+Math.sin(heading+offset)*step,z:s.z+Math.cos(heading+offset)*step};if(clear(p)){next=p;break;}}
    if(!next){task.blockedFor+=dt;s.action='waiting for supply route';s.survivalReason='Supply route blocked · standing order retained';continue;}
    task.blockedFor=0;s.heading=heading;s.x=next.x;s.z=next.z;s.action=task.stage==='return'?'returning from supply':'walking to supply';s.cover=terrain.coverAt(s.x,s.z);
  }
}
