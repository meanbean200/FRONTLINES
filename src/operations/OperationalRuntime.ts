import {clamp,distance,type BattlefieldState,type SoldierState} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {transfer} from '../garrison/Inventory';
import {factionOf,type Faction} from './types';
import {type ObjectiveSpec,type OperationRuntime,type OperationalPhase,type OperationalRoute} from './OperationalTypes';
import {corridorDistance,frontDepth,inZone} from './OperationGeometry';
import {configuredDefinition} from './BattleSetup';
import {stepPhysicalMission} from './MissionRuntime';

export function operationalForces(state:BattlefieldState):Record<Faction,SoldierState[]>{
  const squads=new Map(state.squads.map(q=>[q.id,q]));
  const result:Record<Faction,SoldierState[]>={player:[],enemy:[]};
  for(const s of state.soldiers){const q=squads.get(s.squadId)!;
    if(s.health>=25&&s.needs?.life==='active'&&s.needs.energy>=15&&s.morale>=20&&s.suppression<75&&(s.carried?.ammo??0)>0&&s.combat?.reaction!=='broken')result[factionOf(q)].push(s);
  }return result;
}

/** Real road access: collision/deformation and a credible opposing force can cut a
 * corridor. One man at a flag cannot close all three alternatives. No stock moves here. */
const routeGeometry=new WeakMap<TerrainSystem,{revision:number;routes:WeakMap<OperationalRoute,boolean>}>();
export function updateRouteAccess(r:OperationRuntime,terrain:TerrainSystem,forces:ReturnType<typeof operationalForces>):void {
  let cache=routeGeometry.get(terrain);if(!cache||cache.revision!==terrain.revision){cache={revision:terrain.revision,routes:new WeakMap()};routeGeometry.set(terrain,cache);}
  for(const route of r.routes){
    const own=forces[route.side],other=forces[route.side==='player'?'enemy':'player'];
    const nearby=other.filter(s=>corridorDistance(s,route.points)<=route.width);
    const interdicted=nearby.some(s=>nearby.filter(p=>distance(p,s)<100).length>=3&&nearby.filter(p=>distance(p,s)<100).length>own.filter(p=>distance(p,s)<125).length);
    let usable=cache.routes.get(route);
    if(usable===undefined){usable=true;for(let i=1;usable&&i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i],n=Math.max(1,Math.ceil(distance(a,b)/4));
      for(let j=0;j<=n;j++){const p={x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n};
        if(terrain.obstacleAt(p.x,p.z,1.6)||terrain.groundTypeAt(p.x,p.z)==='river'||terrain.deformationAt(p.x,p.z)<-.35){usable=false;break;}}
    }cache.routes.set(route,usable);}r.routeAccess[route.id]=usable&&!interdicted;
  }
}
interface Evaluation {satisfied:boolean;failed?:boolean;pressure?:boolean;reason:string}
interface Context {state:BattlefieldState;r:OperationRuntime;own:SoldierState[];other:SoldierState[];side:Faction}
const occupies=(ctx:Context,zone:string,people=ctx.own)=>people.filter(s=>inZone(s,ctx.r.zones.find(z=>z.id===zone)!));
const connected=(ctx:Context,routes:string[],people:SoldierState[])=>routes.some(id=>ctx.r.routeAccess[id]&&people.some(p=>distance(p,ctx.r.routes.find(r=>r.id===id)!.destination)<500));
function penetration(ctx:Context,spec:Extract<ObjectiveSpec,{type:'breakthrough'|'hold-line'}>,hostile=false):Evaluation{
  const people=occupies(ctx,spec.zone,hostile?ctx.other:ctx.own),opponents=occupies(ctx,spec.zone,hostile?ctx.own:ctx.other);
  const viable=people.length>=spec.minimum&&new Set(people.map(p=>p.squadId)).size>=spec.squads&&people.length>opponents.length;
  const access=viable&&connected(ctx,spec.routes,people);
  return {satisfied:access,reason:!viable?'A viable force must establish itself beyond the boundary':!access?'Deep force needs an open road connection':'Force established with rear access'};
}
/** Add an objective evaluator here, not a new mission branch in the simulation. */
const EVALUATORS:{[K in ObjectiveSpec['type']]:(c:Context,s:Extract<ObjectiveSpec,{type:K}>)=>Evaluation}={
  'physical-mission':()=>({satisfied:false,reason:'Evaluated by physical mission rules'}),
  'area-control':(c,s)=>{const held=s.zones.filter(id=>occupies(c,id).length>=s.minimum&&occupies(c,id,c.other).length===0).length;return {satisfied:held>=s.required,reason:held>=s.required?'Terrain secured; maintain a viable presence':'Establish control of the key terrain'};},
  'route-control':(c,s)=>({satisfied:s.routes.some(id=>c.r.routeAccess[id]),reason:'Keep at least one corridor open'}),
  breakthrough:(c,s)=>penetration(c,s),
  'hold-line':(c,s)=>{const enemy=penetration(c,s,true);return {satisfied:c.state.operation!.elapsed>=s.duration||c.other.length<4,pressure:enemy.satisfied,reason:enemy.satisfied?'Enemy penetration threatens rear access':'Rear boundary remains denied'};},
};
function evaluate(c:Context,s:ObjectiveSpec):Evaluation {
  // Narrowing at this single typed dispatch boundary keeps mission content out of the evaluator.
  return (EVALUATORS[s.type] as (c:Context,s:ObjectiveSpec)=>Evaluation)(c,s);
}
function phase(r:OperationRuntime,next:OperationalPhase,at:number,reason:string){
  if(r.phase===next)return;r.phase=next;r.phaseSince=at;r.history.push({phase:next,at,reason});if(r.history.length>32)r.history.shift();
}

/** Fixed-clock, serialized evaluation schedule. Save/load cannot gain consolidation time. */
export function stepOperationalRuntime(state:BattlefieldState,terrain:TerrainSystem):void {
  if(state.operation?.runtime?.missionPlan){stepPhysicalMission(state,terrain);return;}
  const op=state.operation!,r=op.runtime!;if(op.elapsed+1e-8<r.nextEvaluation)return;
  const dt=Math.max(0,op.elapsed-r.lastEvaluation);r.lastEvaluation=op.elapsed;r.nextEvaluation=op.elapsed+1;
  const forces=operationalForces(state);updateRouteAccess(r,terrain,forces);
  for(const objective of r.objectives){
    const p=r.progress.find(p=>p.id===objective.id)!,side=objective.side;
    const e=evaluate({state,r,side,own:forces[side],other:forces[side==='player'?'enemy':'player']},objective.spec);
    p.satisfied=e.satisfied;p.reason=e.reason;p.heldFor=e.satisfied?p.heldFor+dt:0;p.pressureFor=e.pressure?p.pressureFor+dt:0;
    p.failed=objective.spec.type==='hold-line'&&p.pressureFor>=objective.spec.breachSeconds;
    p.complete=!p.failed&&e.satisfied&&(objective.spec.type==='hold-line'?op.elapsed>=objective.spec.duration||p.heldFor>=30:'holdSeconds' in objective.spec&&p.heldFor>=objective.spec.holdSeconds);
  }
  const finish=(status:'victory'|'defeat',reason:string)=>{op.status=status;op.reason=reason;state.simSpeed=0;};
  const primary=r.objectives.find(o=>o.side==='player'&&o.priority==='primary')!,progress=r.progress.find(p=>p.id===primary.id)!;
  const definition=configuredDefinition(r.definitionId,op.setup);
  // Dead personnel, not sleeping or temporarily pinned men, determine irrecoverable loss.
  const combatSquads=new Set(state.squads.filter(q=>q.faction!=='enemy').map(q=>q.id));
  const survivors=state.soldiers.filter(s=>combatSquads.has(s.squadId)&&s.needs?.life!=='dead').length;
  const survivingSquads=new Set(state.soldiers.filter(s=>combatSquads.has(s.squadId)&&s.needs?.life!=='dead').map(s=>s.squadId)).size;
  const required=primary.spec.type==='breakthrough'?primary.spec.minimum:primary.spec.type==='area-control'?primary.spec.minimum*primary.spec.required:3;
  const requiredSquads=primary.spec.type==='breakthrough'?primary.spec.squads:1;
  const future=state.operation?.campaign?.replacements;
  const pending=future&&(future.reserve.player>0||future.manifests.some(m=>m.side==='player'&&m.stage!=='arrived'));
  if(progress.failed)finish('defeat','A viable enemy force established sustained access into your rear.');
  else if((survivors<required||survivingSquads<requiredSquads)&&!pending)finish('defeat','Too few surviving combat personnel or formations remain to carry out the operation.');
  else for(const condition of r.victory){
    const other=condition.side==='player'?'enemy':'player';
    const effective=forces[other].length/Math.max(1,other==='enemy'?op.initialEnemy:op.initialPlayer);
    if(condition.objectives.every(id=>r.progress.find(p=>p.id===id)?.complete)&&(condition.opponentEffectivenessBelow===undefined||effective<=condition.opponentEffectivenessBelow)){
      finish(condition.side==='player'?'victory':'defeat',condition.side==='player'?`${definition.title}: the operational objective is secured.`:'The opposing force achieved its operational objective.');break;
    }
  }
  const contact=(op.intelligence?.command.player??op.contacts?.player??[]).some(c=>c.active);
  const breached=forces.player.filter(s=>frontDepth(r.front,s)>r.front.beltDepth+180).length>=8;
  const incapable=forces.player.length<8&&survivors>=3;
  const consolidating=primary.spec.type==='hold-line'?progress.pressureFor>0:progress.satisfied;
  phase(r,incapable?'withdrawal':consolidating&&primary.spec.type!=='hold-line'?'consolidation':breached&&primary.spec.type==='breakthrough'?'exploitation':op.shots>0?'engagement':contact?'contact':'preparation',op.elapsed,incapable?'Combat effectiveness requires recovery':progress.reason);
}

/** Cache control is a supporting tactical effect, not the operation's score. */
export function updateOperationalCaches(state:BattlefieldState,active:SoldierState[],factions:Map<number,Faction>,dt:number):void {
  const op=state.operation!,r=op.runtime!;
  for(const objective of op.objectives){
    const location=r.locations.find(l=>l.id===objective.id)!,zone=r.zones.find(z=>z.id===location.zoneId)!;
    const people=active.filter(s=>inZone(s,zone)&&s.suppression<75);
    const player=people.filter(s=>factions.get(s.squadId)==='player').length,enemy=people.length-player;
    objective.contested=player>0&&enemy>0||objective.owner==='player'&&enemy>0||objective.owner==='enemy'&&player>0;
    if(!(player&&enemy)&&Math.max(player,enemy)>=5){objective.control=clamp(objective.control+(player?1:-1)*dt/45,-1,1);if(Math.abs(objective.control)===1)objective.owner=objective.control>0?'player':'enemy';else if(objective.owner==='player'&&objective.control<=0||objective.owner==='enemy'&&objective.control>=0)objective.owner='neutral';}
    const crate=state.living!.crates.find(c=>c.id===objective.cacheId);
    if(crate&&!objective.contested)for(const s of people){if(factions.get(s.squadId)!==objective.owner||distance(s,crate)>12||s.duty||s.action!=='holding')continue;
      for(const [key,cap,rate] of [['ammo',60,4],['food',2,.25],['water',3,.25]] as const)transfer(crate.stock,s.carried!,key,Math.min(dt*rate,cap-s.carried![key]));s.ammunition=s.carried!.ammo;}
  }
}
