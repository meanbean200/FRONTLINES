import {distance,type BattlefieldState,type SoldierState} from '../core/types';
import {hash2D} from '../core/random';
import {consume} from '../garrison/Inventory';
import {dropCargo} from '../garrison/NeedsSystem';
import {canSpot,lineOfFire,squadContacts} from '../operations/Visibility';
import type {Faction} from '../operations/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {aimPoint,bodyVolume,dispersionMultiplier,resolveShot,segmentDistance,rifleSpread,maximumShotOffset,muzzlePoint} from './Ballistics';
import type {ShotEvent} from './types';
import {registerIncoming} from './Reactions';
import {equipWeapon,weaponReady,WEAPONS} from './Weapons';
import {combatWound} from './Casualties';

export const RIFLE_RULES=Object.freeze({range:360,shotInterval:3.8,damage:60});

/** No renderer dependencies. Shots resolve in stable simulation order. */
export function fireSmallArms(state:BattlefieldState,terrain:TerrainSystem,active:SoldierState[],factions:Map<number,Faction>,alarm:(shooter:SoldierState,event:ShotEvent)=>void):void {
  const op=state.operation!,damage=new Map<SoldierState,number>();
  op.shotEvents=(op.shotEvents??[]).filter(e=>state.elapsed-e.at<.25);
  const buckets=new Map<string,SoldierState[]>(),cell=500;
  for(const s of active){const key=`${Math.floor(s.x/cell)},${Math.floor(s.z/cell)}`;const row=buckets.get(key)??[];row.push(s);buckets.set(key,row);}
  for(const shooter of active){
    if(shooter.needs?.life!=='active')continue;
    if(['pinned','broken'].includes(shooter.combat?.reaction??'')||['casualty','support'].includes(shooter.combat?.owner??''))continue;
    if((shooter.carried?.ammo??0)<1||shooter.suppression>=90)continue;
    if(shooter.duty&&(shooter.duty.kind!=='watch'||shooter.duty.arrivedAt===undefined||shooter.duty.rationUntil!==undefined))continue;
    const weapon=equipWeapon(state,shooter),definition=WEAPONS[weapon.id];
    // Handling starts when the crew stops or empties the weapon, not only
    // when the next firing opportunity arrives. Cadence still gates the shot.
    if(!weaponReady(state,shooter,active)||op.elapsed<(shooter.nextShotAt??0))continue;
    const combat=shooter.combat??={shotSequence:0};
    const squad=state.squads.find(q=>q.id===shooter.squadId)!,area=squad.order.intent==='suppress'?squad.order.target:undefined;
    const known=new Set(squadContacts(state,shooter.squadId).filter(c=>c.visible).map(c=>c.soldierId));
    const faction=factions.get(shooter.squadId)!,candidates:SoldierState[]=[];
    const cx=Math.floor(shooter.x/cell),cz=Math.floor(shooter.z/cell);
    for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const s of buckets.get(`${x},${z}`)??[])
      if(factions.get(s.squadId)!==faction&&distance(shooter,s)<definition.range)candidates.push(s);
    candidates.sort((a,b)=>distance(shooter,a)-distance(shooter,b)||a.id-b.id);
    const target=candidates.find(s=>known.has(s.id)&&canSpot(state,terrain,shooter,s)&&lineOfFire(terrain,shooter,s));
    if(!target&&!area){delete shooter.aimTargetId;delete shooter.aimReadyAt;delete combat.aim;continue;}
    const point=area?{...area,y:terrain.heightAt(area.x,area.z)+.8}:aimPoint(terrain,shooter,target!);
    const heading=Math.atan2(point.x-shooter.x,point.z-shooter.z),range=distance(shooter,point),spread=dispersionMultiplier(state,shooter,area?undefined:target)*definition.spread;
    if(range>definition.range)continue;
    // A conservative envelope for fire discipline, bounded by the same physical
    // cone as the shot. Raw stress multipliers must not withhold point-blank fire.
    const envelope=Math.min(rifleSpread(range)*spread,maximumShotOffset(Math.hypot(range,point.y-muzzlePoint(terrain,shooter).y)));
    if(!area&&definition.burst===1&&.8/(2*Math.PI*envelope**2)<.003&&!squad.order.pushThrough){combat.pauseReason='Holding ammunition · aimed hit implausible';continue;}
    const aimId=area?undefined:target?.id;
    if(shooter.aimTargetId!==aimId||!combat.aim||area&&distance(combat.aim.point,point)>2){
      shooter.heading=heading;shooter.aimTargetId=aimId;
      shooter.aimReadyAt=op.elapsed+.4+hash2D(shooter.id,aimId??0,state.seed)*1.1+(100-(shooter.needs?.energy??100))*.012;
      combat.aim={targetId:aimId,since:state.elapsed,lastSeen:state.elapsed,point,lastHeading:heading,lastPosition:{x:shooter.x,z:shooter.z},settlingUntil:state.elapsed+.5};
      continue;
    }
    const aim=combat.aim,turn=Math.abs(Math.atan2(Math.sin(heading-aim.lastHeading),Math.cos(heading-aim.lastHeading)));
    if(distance(shooter,aim.lastPosition)>.3||turn>.2)aim.settlingUntil=state.elapsed+1.5;
    aim.point=point;aim.lastSeen=state.elapsed;aim.lastPosition={x:shooter.x,z:shooter.z};aim.lastHeading=heading;
    if(op.elapsed<(shooter.aimReadyAt??0))continue;
    // Distant shots are deliberate, not an endless full-cadence volley.
    if(weapon.burstLeft<=0)weapon.burstLeft=definition.burst;
    weapon.burstLeft--;weapon.loaded--;
    shooter.nextShotAt=op.elapsed+(weapon.burstLeft>0?definition.interval:definition.burstGap+shooter.id%5*.25+shooter.suppression*.025+Math.max(0,range-150)*.045);
    consume(state,shooter.carried!,'ammo',1);shooter.ammunition=shooter.carried!.ammo;
    shooter.lastShotAt=state.elapsed;shooter.heading=heading;op.shots++;
    const event=resolveShot(state,terrain,shooter,point,candidates,spread,definition.range+20);alarm(shooter,event);
    op.shotEvents.push(event);if(op.shotEvents.length>256)op.shotEvents.shift();
    shooter.lastTarget={x:event.to.x,z:event.to.z};
    for(const nearby of candidates){
      const body=bodyVolume(terrain,nearby),miss=segmentDistance(body,event.from,event.to);
      if(miss>5||distance(shooter,nearby)>distance(event.from,event.to)+1)continue;
      // A solid wall between a nearby impact and the soldier is protection.
      if(event.obstruction&&!terrain.objects.trace(event.to,nearby,event.to.y,body.y,false).clear)continue;
      const pressure=nearby.id===event.hitId?35:Math.max(1,18*(1-miss/5));
      nearby.suppression=Math.min(100,nearby.suppression+pressure);nearby.morale=Math.max(0,nearby.morale-pressure*.045);
      registerIncoming(nearby,state.elapsed,Math.atan2(event.from.x-event.to.x,event.from.z-event.to.z));
      weapon.effectiveUntil=state.elapsed+3;
      weapon.effectivePoint={x:event.to.x,z:event.to.z};
    }
    if(event.hitId!==undefined){const hit=candidates.find(s=>s.id===event.hitId)!;if(op.casualtyRules)combatWound(state,hit,event);else damage.set(hit,(damage.get(hit)??0)+RIFLE_RULES.damage);op.hits++;}
  }
  for(const [soldier,amount] of damage){
    soldier.health=Math.max(0,soldier.health-amount);soldier.morale=Math.max(0,soldier.morale-amount*.3);soldier.lastHitAt=state.elapsed;
    if(soldier.health===0){soldier.needs!.life='dead';soldier.action='dead';state.living!.metrics.deaths++;dropCargo(state,soldier);}
    else if(soldier.health<15){soldier.needs!.life='incapacitated';soldier.action='incapacitated';dropCargo(state,soldier);}
    if(soldier.needs!.life!=='active')delete soldier.duty;
  }
}
