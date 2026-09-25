import {distance,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {commandEnemy,type EnemyMemory,type EnemyObservation} from './EnemyCommander';
import {atDepth,frontDepth} from './OperationGeometry';
import {type FrontGeometry,type OperationalCommandMemory} from './OperationalTypes';

export interface OperationalKnowledge {
  mission?:{kind:import('./MissionContent').MissionKind;houseId:number;house:Vec2;secondHouseId?:number;secondHouse?:Vec2;preparationSeconds:number;frontage:number};
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
  const scouts=ready.filter(q=>!q.emplaced).slice(0,2),scoutProgress=scouts.length>=2&&scouts.every(q=>frontDepth(k.front,q)<k.deploymentDepth-180);
  const phase=exhausted?'withdrawing':k.intent==='defend'?'holding':scoutProgress||report?'committing':old?.phase==='committing'?'committing':'scouting';
  const commander:OperationalCommandMemory={phase,since:old?.phase===phase?old.since:o.at,startingAble:start,nextSupport:old?.nextSupport??0,reason:exhausted?'Regroup: insufficient fit squads':k.intent==='defend'?'Protect the belt; react only to received reports':phase==='scouting'?'Two formations reconnoitre together; main body assembles in depth':'Commit the assembled force using received reports; retain a reserve'};
  const assignments=combat.map((q,i)=>{
    const target=k.targets[i%k.targets.length],reserve=i===(k.mission?.kind==='breakthrough'?Math.max(1,combat.length-3):combat.length-1)&&combat.length>=4;
    let goal:Vec2=target.point,defend=false;
    if(exhausted){goal=k.rear;defend=true;}
    else if(k.intent==='defend'){
      const penetration=report&&frontDepth(k.front,report)>k.deploymentDepth;
      goal=penetration&&reserve?{x:report.x+k.front.forward.x*80,z:report.z+k.front.forward.z*80}:atDepth(k.front,k.deploymentDepth+(reserve?180:0),(i%3-1)*600);
      // Keep occupied prepared positions; don't march to arbitrary points on first review.
      if(!penetration&&distance(q,goal)<240)goal={x:q.x,z:q.z};defend=true;
    }else if(reserve){goal=atDepth(k.front,k.deploymentDepth-150,(i%3-1)*200);defend=true;}
    else if(phase==='scouting'&&!scouts.some(s=>s.id===q.id)){goal=atDepth(k.front,k.deploymentDepth-100,(i%3-1)*(k.mission?35:120));defend=true;}
    else if(k.intent==='penetrate'){goal=phase==='scouting'?atDepth(k.front,0,(i%3-1)*450):target.point;}
    // The mixed-equipped rear formation must be able to bring its mortar into
    // range of a delivered report. Being the reserve is not a permanent class
    // lock at deployment. No report means no pursuit of hidden coordinates.
    if(!exhausted&&q.mortar&&(q.mortarAmmo??0)>0&&report&&distance(q,report)>750){
      const d=distance(q,report);goal={x:report.x+(q.x-report.x)/d*650,z:report.z+(q.z-report.z)/d*650};defend=true;
    }
    if(k.mission&&!exhausted){
      const m=k.mission;
      if(o.at<m.preparationSeconds){goal={x:q.x,z:q.z};defend=true;}
      else if(m.kind==='breakthrough'){
        // Keep the firing line occupied; a real reserve walks into the defended house.
        goal=reserve?m.house:{x:q.x,z:q.z};defend=!reserve;
      }else if(m.kind==='line-defense'&&phase==='scouting'&&!scouts.some(s=>s.id===q.id)){
        goal=atDepth(k.front,k.deploymentDepth-80,(i%3-1)*35);defend=true;
      }else if(reserve&&o.at<(old?.since??o.at)+45){goal={x:q.x,z:q.z};defend=true;}
      else {goal=m.kind==='meeting'&&m.secondHouse&&i%2?m.secondHouse:atDepth(k.front,15,(i%3-1)*32);defend=false;}
    }
    return {squadId:q.id,objectiveId:target.id,goal,defend};
  });
  const result=commandEnemy({...o,assignments},terrain,previous);
  if(k.mission&&o.at<k.mission.preparationSeconds){
    // The tactical cover search must not turn a staging goal into an early
    // advance. Local fire/reactions remain in the ordinary soldier loop.
    result.commands=combat.map(q=>({squadId:q.id,type:'hold',goal:{x:q.x,z:q.z},role:'defend',reason:'Staging before the scout advance'}));
  }
  if(k.mission&&!exhausted&&o.at>=k.mission.preparationSeconds){
    // The same Move command used by the player enters a physical building. No
    // interior coordinates or targets are fabricated in the commander.
    const houses=[{id:k.mission.houseId,point:k.mission.house},...(k.mission.secondHouse&&k.mission.secondHouseId!==undefined?[{id:k.mission.secondHouseId,point:k.mission.secondHouse}]:[])],used=new Set<number>();
    for(const house of houses){const candidate=combat.find(q=>!used.has(q.id)&&q.buildingOrder===undefined&&!q.emplaced&&!q.working&&q.able>=3&&q.suppression<30&&distance(q,house.point)<65);
      if(candidate&&!combat.some(q=>q.buildingOrder===house.id)){used.add(candidate.id);result.commands=result.commands.filter(c=>c.squadId!==candidate.id);result.commands.push({squadId:candidate.id,type:'move',goal:{...house.point},role:'defend',reason:'Occupy the road house and cover its approaches'});}
    }
  }
  let support:{squadId:number;target:Vec2}|undefined;
  const mortar=o.squads.find(q=>q.mortar&&q.mortarReady&&(q.mortarAmmo??0)>0&&q.able>=2&&!q.working&&!q.supportBusy&&q.suppression<65&&q.morale>=30&&report&&distance(q,report)>=50&&distance(q,report)<=900);
  if(!exhausted&&report&&mortar&&o.at>=commander.nextSupport!){
    result.commands=result.commands.filter(c=>c.squadId!==mortar.id);
    if(!mortar.moving){commander.nextSupport=o.at+30;support={squadId:mortar.id,target:{x:report.x,z:report.z}};}
  }
  return {...result,commander,support};
}
