import {distance,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {commandEnemy,type EnemyMemory,type EnemyObservation} from './EnemyCommander';
import {atDepth,frontDepth} from './OperationGeometry';
import {type FrontGeometry,type OperationalCommandMemory} from './OperationalTypes';

export interface OperationalKnowledge {
  intent:'defend'|'penetrate'|'contest';front:FrontGeometry;rear:Vec2;deploymentDepth:number;
  targets:{id:string;point:Vec2}[];
}
/** Takes ONLY the information-firewall observation. It cannot inspect the live world,
 * objective oracle, player orders, hidden casualties or mission-completion progress. */
export function commandOperationalEnemy(o:EnemyObservation,terrain:TerrainSystem,previous?:EnemyMemory,old?:OperationalCommandMemory){
  const k=o.operational!,combat=o.squads.filter(q=>!q.working);
  const ready=combat.filter(q=>q.able>=3&&q.ammo>=8&&q.energy>=25&&q.morale>=30&&q.suppression<65);
  const able=combat.reduce((n,q)=>n+q.able,0),start=old?.startingAble??able;
  const report=o.contacts.filter(c=>o.at-c.lastSeen<=12&&c.active).sort((a,b)=>b.lastSeen-a.lastSeen)[0];
  const exhausted=ready.length<2||able<start*.45||old?.phase==='withdrawing'&&o.at-old.since<60;
  const scout=ready[0],scoutProgress=scout&&frontDepth(k.front,scout)<k.deploymentDepth-300;
  const phase=exhausted?'withdrawing':k.intent==='defend'?'holding':scoutProgress||report?'committing':old?.phase==='committing'?'committing':'scouting';
  const commander:OperationalCommandMemory={phase,since:old?.phase===phase?old.since:o.at,startingAble:start,nextSupport:old?.nextSupport??0,reason:exhausted?'Regroup: insufficient fit squads':k.intent==='defend'?'Protect the belt; react only to received reports':phase==='scouting'?'Scout approaches before committing the main force':'Advance toward operational depth with a reserve'};
  const assignments=combat.map((q,i)=>{
    const target=k.targets[i%k.targets.length],reserve=i===combat.length-1&&combat.length>=4;
    let goal:Vec2=target.point,defend=false;
    if(exhausted){goal=k.rear;defend=true;}
    else if(k.intent==='defend'){
      const penetration=report&&frontDepth(k.front,report)>k.deploymentDepth;
      goal=penetration&&reserve?{x:report.x+k.front.forward.x*80,z:report.z+k.front.forward.z*80}:atDepth(k.front,k.deploymentDepth+(reserve?180:0),(i%3-1)*600);
      // Keep occupied prepared positions; don't march to arbitrary points on first review.
      if(!penetration&&distance(q,goal)<240)goal={x:q.x,z:q.z};defend=true;
    }else if(reserve){goal=atDepth(k.front,k.deploymentDepth-150,(i%3-1)*200);defend=true;}
    else if(phase==='scouting'&&q.id!==scout?.id){goal=atDepth(k.front,k.deploymentDepth-160,(i%3-1)*230);defend=true;}
    else if(k.intent==='penetrate'){goal=phase==='scouting'?atDepth(k.front,0,(i%3-1)*450):target.point;}
    // The mixed-equipped rear formation must be able to bring its mortar into
    // range of a delivered report. Being the reserve is not a permanent class
    // lock at deployment. No report means no pursuit of hidden coordinates.
    if(!exhausted&&q.mortar&&(q.mortarAmmo??0)>0&&report&&distance(q,report)>750){
      const d=distance(q,report);goal={x:report.x+(q.x-report.x)/d*650,z:report.z+(q.z-report.z)/d*650};defend=true;
    }
    return {squadId:q.id,objectiveId:target.id,goal,defend};
  });
  const result=commandEnemy({...o,assignments},terrain,previous);
  let support:{squadId:number;target:Vec2}|undefined;
  const mortar=o.squads.find(q=>q.mortar&&(q.mortarAmmo??0)>0&&q.able>=2&&!q.working&&!q.supportBusy&&q.suppression<65&&q.morale>=30&&report&&distance(q,report)>=50&&distance(q,report)<=900);
  if(!exhausted&&report&&mortar&&o.at>=commander.nextSupport!){
    result.commands=result.commands.filter(c=>c.squadId!==mortar.id);
    result.commands.push({squadId:mortar.id,type:'hold',goal:{x:mortar.x,z:mortar.z},role:'support',reason:'Deploy carried mortar against delivered report'});
    if(!mortar.moving){commander.nextSupport=o.at+30;support={squadId:mortar.id,target:{x:report.x,z:report.z}};}
  }
  return {...result,commander,support};
}
