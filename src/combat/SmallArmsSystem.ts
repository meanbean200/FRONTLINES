import {distance,type BattlefieldState,type SoldierState} from '../core/types';
import {hash2D} from '../core/random';
import {consume} from '../garrison/Inventory';
import {dropCargo} from '../garrison/NeedsSystem';
import {recordDeath} from '../simulation/DeathRecord';
import {canSpot,squadContacts} from '../operations/Visibility';
import type {Faction} from '../operations/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {clearAimPoint,bodyVolume,dispersionMultiplier,resolveShot,segmentDistance,rifleSpread,maximumShotOffset,muzzlePoint} from './Ballistics';
import type {ShotEvent} from './types';
import {registerIncoming} from './Reactions';
import {equipWeapon,weaponReady,WEAPONS} from './Weapons';
import {combatWound} from './Casualties';
import {operatedPosition,weaponStock} from './WeaponPositions';
import {effectiveSquad} from '../operations/AssaultPlan';

export const RIFLE_RULES=Object.freeze({range:360,shotInterval:3.8,damage:60});

/** No renderer dependencies. Shots resolve in stable simulation order. */
export function fireSmallArms(state:BattlefieldState,terrain:TerrainSystem,active:SoldierState[],factions:Map<number,Faction>,alarm:(shooter:SoldierState,event:ShotEvent)=>void):void {
  const op=state.operation!;
  const able=(s:SoldierState)=>s.health>0&&s.needs?.life==='active';
  const byId=new Map(state.soldiers.map(s=>[s.id,s]));
  const forgetTarget=(s:SoldierState)=>{
    delete s.aimTargetId;delete s.aimReadyAt;if(s.combat)delete s.combat.aim;
    const weapon=operatedPosition(state,s,'emplacement')?.installation?.weapon??s.combat?.weapon;
    if(weapon)weapon.burstLeft=0;
  };
  op.shotEvents=(op.shotEvents??[]).filter(e=>state.elapsed-e.at<.25);
  const buckets=new Map<string,SoldierState[]>(),cell=500;
  for(const s of active){if(!able(s))continue;const key=`${Math.floor(s.x/cell)},${Math.floor(s.z/cell)}`;const row=buckets.get(key)??[];row.push(s);buckets.set(key,row);}
  for(const shooter of active){
    // Death/incapacity invalidates tracking before cooldown, reload or duty
    // early-outs. The caller's active array can also change during this volley.
    const tracked=shooter.aimTargetId??shooter.combat?.aim?.targetId;
    if(tracked!==undefined&&(!byId.has(tracked)||!able(byId.get(tracked)!)))forgetTarget(shooter);
    if(!able(shooter)){forgetTarget(shooter);continue;}
    if(shooter.building?.recovering&&shooter.action==='sleeping')continue;
    if(['pinned','broken'].includes(shooter.combat?.reaction??'')||['casualty','support','self-care'].includes(shooter.combat?.owner??''))continue;
    if((weaponStock(state,shooter)?.ammo??0)<1||shooter.suppression>=90)continue;
    if(shooter.duty&&(shooter.duty.kind!=='watch'||shooter.duty.arrivedAt===undefined||shooter.duty.rationUntil!==undefined))continue;
    const weapon=equipWeapon(state,shooter),definition=WEAPONS[weapon.id];
    // Handling starts when the crew stops or empties the weapon, not only
    // when the next firing opportunity arrives. Cadence still gates the shot.
    if(!weaponReady(state,shooter,active)||op.elapsed<(shooter.nextShotAt??0))continue;
    const combat=shooter.combat??={shotSequence:0};
    const squad=effectiveSquad(state,shooter,state.squads.find(q=>q.id===shooter.squadId)!),area=squad.order.intent==='suppress'?squad.order.target:undefined;
    const known=new Set(squadContacts(state,shooter.squadId).filter(c=>c.visible).map(c=>c.soldierId));
    const faction=factions.get(shooter.squadId)!,candidates:SoldierState[]=[];
    const cx=Math.floor(shooter.x/cell),cz=Math.floor(shooter.z/cell);
    for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const s of buckets.get(`${x},${z}`)??[])
      if(able(s)&&factions.get(s.squadId)!==faction&&distance(shooter,s)<definition.range)candidates.push(s);
    // Hold a valid firing solution. A few centimetres of crossing movement
    // must not keep restarting acquisition (especially automatic weapons).
    // Visibility, range, sector and cover are still checked below every shot.
    candidates.sort((a,b)=>Number(b.id===shooter.aimTargetId)-Number(a.id===shooter.aimTargetId)||distance(shooter,a)-distance(shooter,b)||a.id-b.id);
    const mount=operatedPosition(state,shooter,'emplacement');
    const inSector=(p:{x:number;z:number})=>!mount||mount.facing===undefined||Math.cos(Math.atan2(p.x-shooter.x,p.z-shooter.z)-mount.facing)>=.34;
    // Candidates are already in deterministic priority order. Do not trace
    // every other defender after finding the first usable firing solution.
    let observed=0,observedInSector=false;
    let target:SoldierState|undefined,solution:ReturnType<typeof clearAimPoint>;
    for(const candidate of candidates){
      if(!known.has(candidate.id)||!canSpot(state,terrain,shooter,candidate))continue;
      observed++;
      if(inSector(candidate)){observedInSector=true;solution=clearAimPoint(terrain,shooter,candidate,state);if(solution){target=candidate;break;}}
    }
    if(!target&&!area){combat.pauseReason=observedInSector?'Firing edge obstructed · cannot clear cover':observed?'Outside mounted gun firing sector':'No observed target in weapon range';forgetTarget(shooter);continue;}
    const point=area?{...area,y:terrain.heightAt(area.x,area.z)+.8}:solution!;
    const muzzle=muzzlePoint(terrain,{...shooter,heading:Math.atan2(point.x-shooter.x,point.z-shooter.z)},state);
    if(area){
      // Suppression may deliberately strike the enemy's protection. Reject an
      // obstructed local firing edge, not every distant parapet on the ray.
      // The authoritative shot still stops at the first real obstacle.
      const t=Math.min(1,8/Math.max(.01,distance(muzzle,point))),edge={x:muzzle.x+(point.x-muzzle.x)*t,z:muzzle.z+(point.z-muzzle.z)*t,y:muzzle.y+(point.y-muzzle.y)*t};
      if(!terrain.objects.trace(muzzle,edge,muzzle.y,edge.y,false,true).clear){combat.pauseReason='Suppression firing edge blocked by cover';continue;}
    }
    if(!inSector(point)){combat.pauseReason='Outside mounted gun firing sector';continue;}
    const heading=Math.atan2(point.x-shooter.x,point.z-shooter.z),range=distance(shooter,point),spread=dispersionMultiplier(state,shooter,area?undefined:target)*definition.spread;
    if(range>definition.range)continue;
    // A conservative envelope for fire discipline, bounded by the same physical
    // cone as the shot. Raw stress multipliers must not withhold point-blank fire.
    const envelope=Math.min(rifleSpread(range)*spread,maximumShotOffset(Math.hypot(range,point.y-muzzlePoint(terrain,shooter,state).y)));
    if(!area&&definition.burst===1&&.8/(2*Math.PI*envelope**2)<.003&&!squad.order.pushThrough){combat.pauseReason='Holding ammunition · aimed hit implausible';continue;}
    const aimId=area?undefined:target?.id;
    if(shooter.aimTargetId!==aimId||!combat.aim||area&&distance(combat.aim.point,point)>2){
      weapon.burstLeft=0;
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
    consume(state,weaponStock(state,shooter)!,'ammo',1);shooter.ammunition=shooter.carried!.ammo;
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
    if(event.hitId!==undefined){
      const hit=candidates.find(s=>s.id===event.hitId)!;
      if(op.casualtyRules)combatWound(state,hit,event);
      else if(able(hit)){
        // Legacy injury rules also resolve in shot order, not at the end of
        // the volley; later shooters must not acquire an already dead person.
        const fatal=hit.health<=RIFLE_RULES.damage;if(!fatal)hit.health-=RIFLE_RULES.damage;
        hit.morale=Math.max(0,hit.morale-RIFLE_RULES.damage*.3);hit.lastHitAt=state.elapsed;
        if(fatal)recordDeath(state,hit,{cause:'combat-fire',at:state.elapsed,eventId:event.id,shooterId:event.shooterId,squadId:event.squadId});
        else if(hit.health<15){hit.needs!.life='incapacitated';hit.action='incapacitated';dropCargo(state,hit);delete hit.duty;}
      }
      op.hits++;
    }
  }
}
