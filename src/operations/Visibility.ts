import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {factionOf,type Contact} from './types';
import {isWalkingAction} from '../core/SoldierActions';
import {smokeTransmission} from '../combat/SupportWeapons';
import {postureOf} from '../combat/Posture';
import {SIGHT_RULES} from './SightRules';

export {SIGHT_RULES} from './SightRules';

export function bodyFloor(terrain:TerrainSystem,s:Vec2&Partial<SoldierState>):number {
  if(s.building&&s.building.stage!=='approach'&&s.building.stage!=='exit'){const b=terrain.buildings[s.building.id];if(b)return terrain.baseHeightAt(b.x,b.z)+.14+s.building.vertical;}
  const floor=terrain.heightAt(s.x,s.z);
  const peeking=s.duty?.kind==='watch'&&s.duty.arrivedAt!==undefined&&postureOf(s)==='standing'&&(s.suppression??0)<65&&s.needs?.life==='active';
  return peeking?Math.max(floor,terrain.baseHeightAt(s.x,s.z)-1.15):floor;
}
export function eyeHeight(terrain:TerrainSystem,s:Vec2&Partial<SoldierState>):number {
  const floor=bodyFloor(terrain,s);
  if(postureOf(s)==='prone')return floor+.4;
  if(postureOf(s)==='crouched')return floor+.95;
  return floor+1.6;
}

/** Uses the same buildings and ground as movement; trench firing positions peek over the lip. */
export function lineOfFire(terrain:TerrainSystem,a:Vec2,b:Vec2):boolean {
  return terrain.objects.trace(a,b,eyeHeight(terrain,a),eyeHeight(terrain,b),false).clear;
}

export function visibilitySignal(state:BattlefieldState,terrain:TerrainSystem,observer:SoldierState,target:Vec2&Partial<SoldierState>):number {
  return sightSignal(state,terrain,observer,target,false);
}

// Tracking is recognition hysteresis, not a visibility timer. The same observer
// must still have a clear ray through largely open space on every sight scan.
function sightSignal(state:BattlefieldState,terrain:TerrainSystem,observer:SoldierState,target:Vec2&Partial<SoldierState>,tracking:boolean):number {
  if(observer.health<=0||observer.needs?.life!=='active'||observer.action==='sleeping')return 0;
  const hour=(state.living?.campaignHours??12)%24,d=distance(observer,target);
  const night=hour<6||hour>=20,recentShot=target.lastShotAt!==undefined&&state.elapsed-target.lastShotAt<2;
  if(d>(night?SIGHT_RULES.nightRange:SIGHT_RULES.dayRange))return 0;
  const facing=((target.x-observer.x)*Math.sin(observer.heading)+(target.z-observer.z)*Math.cos(observer.heading))/Math.max(1,d);
  const attention=d<35||recentShot?1:facing<-.25?.28:facing<.25?.7:1;
  const tired=.55+(observer.needs?.energy??100)*.0045,stress=1-observer.suppression*.006;
  const posture=postureOf(target)==='prone'?.45:postureOf(target)==='crouched'?.7:terrain.coverAt(target.x,target.z)==='trench'?(target.duty?.kind==='watch'?.78:.48):1;
  const movement=isWalkingAction(target.action??'holding')||target.action==='following drawn path'?1.35:1;
  const light=night?.18:hour<7||hour>=19?.55:1;
  const angularSize=1/(1+(d/230)**2);
  const potential=angularSize*attention*tired*stress*(posture*movement*light+(recentShot?.65:0))+(d<25?.45:0);
  if(potential<(tracking?SIGHT_RULES.trackingSignal:SIGHT_RULES.recognitionSignal))return 0;
  const ray=terrain.objects.trace(observer,target,eyeHeight(terrain,observer),eyeHeight(terrain,target));
  if(!ray.clear)return 0;
  const transmission=ray.transmission*smokeTransmission(state,observer,target);
  const signal=Math.min(1,transmission*potential);
  // Weak tracking cannot see through foliage or smoke. Strong recognition is
  // unchanged, so this does not improve acquisition or small-arms accuracy.
  return signal>=SIGHT_RULES.recognitionSignal||tracking&&transmission>=SIGHT_RULES.openTransmission?signal:0;
}
export function playerCanSeePoint(state:BattlefieldState,terrain:TerrainSystem,p:Vec2):boolean {
  if(!state.operation)return true;
  const friendly=new Set(state.squads.filter(q=>factionOf(q)==='player').map(q=>q.id));
  return state.soldiers.some(s=>friendly.has(s.squadId)&&visibilitySignal(state,terrain,s,p)>=.24);
}
export function canSpot(state:BattlefieldState,terrain:TerrainSystem,observer:SoldierState,target:SoldierState):boolean {
  return visibilitySignal(state,terrain,observer,target)>=.24;
}

export function updateContacts(state:BattlefieldState,terrain:TerrainSystem,bucket?:number):void {
  const op=state.operation;if(!op)return;
  const intel=op.intelligence??={squads:[],reports:[],command:{player:[],enemy:[]},sounds:[]};
  const factions=new Map(state.squads.map(s=>[s.id,factionOf(s)]));
  const observers=state.soldiers.filter(s=>s.health>0&&s.needs?.life==='active'&&s.action!=='sleeping');
  const dt=bucket===undefined?Math.min(.5,Math.max(0,state.elapsed-(op.lastObservationAt??state.elapsed-.5))):.5;
  for(const squad of state.squads){
    const side=factionOf(squad);
    let local=intel.squads.find(row=>row.squadId===squad.id);
    if(!local){local={squadId:squad.id,contacts:[],exposure:[],link:'connected',nextReport:state.elapsed};intel.squads.push(local);}
    const previous=new Map(local.contacts.map(c=>[c.soldierId,c])),exposure=new Map(local.exposure.map(p=>[p.soldierId,p.exposure]));
    const progress:{soldierId:number;exposure:number}[]=[];
    const scouts=observers.filter(s=>s.squadId===squad.id),contacts:Contact[]=[];
    for(const target of state.soldiers){
      if(factions.get(target.squadId)===side)continue;
      if(bucket!==undefined&&target.id%10!==bucket){const old=previous.get(target.id);if(old&&state.elapsed-old.lastSeen<=SIGHT_RULES.memorySeconds)contacts.push(old);const pending=exposure.get(target.id);if(pending)progress.push({soldierId:target.id,exposure:pending});continue;}
      const candidates=scouts.filter(s=>Math.abs(s.x-target.x)<=SIGHT_RULES.dayRange&&Math.abs(s.z-target.z)<=SIGHT_RULES.dayRange).sort((a,b)=>distance(a,target)-distance(b,target));
      const old=previous.get(target.id),tracker=old?.visible?candidates.find(s=>s.id===old.observerId):undefined;
      // Keep the real observer in the bounded scan. Rotating attention must not
      // drop a contact just because a different squad member checked this tick.
      const scanning=candidates.length>2&&distance(candidates[0],target)>35?[candidates[0],candidates[1+(Math.floor(state.elapsed*2)+target.id)%(candidates.length-1)]]:candidates;
      const sweep=tracker?[tracker,...scanning.filter(s=>s.id!==tracker.id)]:scanning;
      let signal=0,observerId:number|undefined,trackingSignal=0;
      for(const scout of sweep){
        const tracking=scout===tracker&&state.elapsed<(old?.trackedUntil??0);
        const value=sightSignal(state,terrain,scout,target,tracking);
        if(value>signal){signal=value;observerId=scout.id;}
        if(tracking)trackingSignal=value;
        if(signal>=.62||old?.visible&&signal>=.24)break;
      }
      const accumulated=Math.max(0,Math.min(1,(exposure.get(target.id)??0)+dt*(signal>=.24?signal*1.6:-.7)));
      if(accumulated>0)progress.push({soldierId:target.id,exposure:accumulated});
      const recognized=signal>=.62||signal>=.24&&(accumulated>=.6||old?.visible===true);
      const tracked=trackingSignal>=SIGHT_RULES.trackingSignal;
      if(recognized||tracked)contacts.push({soldierId:target.id,squadId:target.squadId,x:target.x,z:target.z,lastSeen:state.elapsed,visible:true,active:target.health>0&&target.needs?.life==='active',status:'confirmed',uncertainty:0,observerId:recognized?observerId:tracker!.id,trackedUntil:recognized?state.elapsed+SIGHT_RULES.trackingSeconds:old!.trackedUntil});
      else if(old&&state.elapsed-old.lastSeen<=SIGHT_RULES.memorySeconds)contacts.push({...old,visible:false,status:'last-reported',uncertainty:Math.min(60,(state.elapsed-old.lastSeen)*2)});
    }
    local.contacts=contacts;local.exposure=progress;
    if(state.elapsed>=local.nextReport){
      local.nextReport=state.elapsed+4;
      const leader=scouts.find(s=>s.combat?.weapon?.id==='smg')??scouts.find(s=>s.id===squad.soldierIds[squad.kind==='rifle'?7:0]),nearLink=state.squads.some(q=>q.id!==squad.id&&factionOf(q)===side&&distance(q,squad)<250&&observers.some(s=>s.squadId===q.id));
      local.link=leader||nearLink?'connected':'isolated';
      if(local.link==='connected'&&contacts.length){
        const rear=side==='enemy'?state.living?.enemySupply?.rear:state.living?.rear;
        intel.reports.push({squadId:squad.id,side,deliverAt:state.elapsed+(leader?3:8)+Math.min(8,rear?distance(rear,squad)/500:0),contacts:structuredClone(contacts)});
      }
    }
  }
  for(const side of ['player','enemy'] as const){
    const delivered=new Map(intel.command[side].filter(c=>state.elapsed-c.lastSeen<=SIGHT_RULES.memorySeconds).map(c=>[c.soldierId,{...c,visible:state.elapsed-c.lastSeen<12,status:'last-reported' as const,uncertainty:(state.elapsed-c.lastSeen)*2}]));
    for(const report of intel.reports.filter(r=>r.side===side&&r.deliverAt<=state.elapsed))for(const c of report.contacts){if(state.elapsed-c.lastSeen<=SIGHT_RULES.memorySeconds&&c.lastSeen>=(delivered.get(c.soldierId)?.lastSeen??-1))delivered.set(c.soldierId,{...c,visible:state.elapsed-c.lastSeen<12,status:'last-reported',uncertainty:(state.elapsed-c.lastSeen)*2});}
    intel.command[side]=[...delivered.values()];
    // Presentation combines friendly local views; it is never input to a remote planner or shooter.
    const local=new Map<number,Contact>();
    for(const row of intel.squads.filter(r=>factions.get(r.squadId)===side))for(const c of row.contacts){const old=local.get(c.soldierId);if(!old||c.lastSeen>old.lastSeen||c.visible&&!old.visible)local.set(c.soldierId,c);}
    (op.contacts??={player:[],enemy:[]})[side]=[...local.values()].map(c=>({...c}));
  }
  intel.reports=intel.reports.filter(r=>r.deliverAt>state.elapsed).slice(-state.squads.length*4);
  intel.sounds=intel.sounds.filter(s=>state.elapsed-s.at<15);
  op.lastObservationAt=state.elapsed;delete op.sightProgress;
}

export function squadContacts(state:BattlefieldState,squadId:number):Contact[]{
  const intel=state.operation?.intelligence;
  if(intel)return intel.squads.find(q=>q.squadId===squadId)?.contacts??[];
  const side=state.squads.find(q=>q.id===squadId)?.faction??'player';return state.operation?.contacts?.[side]??[];
}

export function playerVisibleEnemies(state:BattlefieldState):Set<number>{
  return new Set((state.operation?.contacts?.player??[]).filter(c=>c.visible).map(c=>c.soldierId));
}
export function observedEnemySquad(state:BattlefieldState,squadId:number):{x:number;z:number;visible:boolean;able:number;lastSeen:number}|undefined {
  const contacts=(state.operation?.contacts?.player??[]).filter(c=>c.squadId===squadId&&state.elapsed-c.lastSeen<=SIGHT_RULES.memorySeconds);
  if(!contacts.length)return;
  const visible=contacts.filter(c=>c.visible),used=visible.length?visible:contacts;
  return {x:used.reduce((n,c)=>n+c.x,0)/used.length,z:used.reduce((n,c)=>n+c.z,0)/used.length,visible:visible.length>0,able:visible.filter(c=>c.active).length,lastSeen:Math.max(...used.map(c=>c.lastSeen))};
}
