import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import {buildingContains,buildingFloors,doorPoint,firingPoints,floorHeight,stairPoint} from '../terrain/BuildingGeometry';

export function beginBuildingTravel(s:SoldierState,id:number,level:0|1,target:Vec2,terrain:TerrainSystem,nav:SquadNavigation):boolean {
  const site=terrain.buildings[id];if(!site||level>=buildingFloors(site))return false;
  const entrance=doorPoint(site,8),approach=nav.segmentClear(s,entrance,.45)?[entrance]:nav.plan(s,entrance);if(!approach.length)return false;
  s.building={id,floor:0,vertical:0,route:[...approach,entrance,doorPoint(site,-1),...(level?[{...stairPoint(site),z:site.z-2}]:[{x:site.x,z:site.z},target])],index:0,stage:'approach',target:{...target},targetFloor:level,stairTime:0};return true;
}

/** Explicit interior intent. Normal formation navigation never squeezes a squad
 * through a wall; individual people use the same door and stairs. */
export function stepBuildings(state:BattlefieldState,terrain:TerrainSystem,nav:SquadNavigation,dt:number):void {
  for(const q of state.squads){
    const order=q.order.building,site=order?terrain.buildings[order.id]:undefined;
    const people=state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life==='active');
    if(site&&order)for(const [index,s] of people.entries()){
      if(s.building||s.combat?.owner==='reaction'||s.combat?.owner==='casualty')continue;
      const points=firingPoints(site),level=Math.min(order.floor,buildingFloors(site)-1) as 0|1;
      const occupied=state.soldiers.filter(p=>p!==s&&p.building?.id===order.id&&p.building.targetFloor===level).map(p=>p.building!.target);
      const target=points.find(p=>!occupied.some(o=>distance(p,o)<.8));
      if(!target){(s.combat??={shotSequence:0}).pauseReason='Building firing positions occupied';s.action='waiting for building space';continue;}
      if(!beginBuildingTravel(s,order.id,level,target,terrain,nav)){(s.combat??={shotSequence:0}).pauseReason='Building entrance blocked';continue;}
      // A short stagger prevents everyone aiming for the threshold on one tick.
      s.nextShotAt=Math.max(s.nextShotAt??0,state.elapsed+index*.12);
    }
    for(const s of people){
      const inside=s.building;if(!inside)continue;
      const b=terrain.buildings[inside.id],c=s.combat??={shotSequence:0};if(!b){delete s.building;continue;}
      const exitRoute=()=>{const i=q.soldierIds.indexOf(s.id),out=doorPoint(b,8);return [{x:b.x,z:b.z-2},doorPoint(b,-1),doorPoint(b,4),{x:out.x+(i%4-1.5)*1.6,z:out.z-Math.floor(i/4)*1.6}];};
      const task=c.careTask,patient=task?state.soldiers.find(p=>p.id===task.patientId):undefined;
      if(c.owner==='support'||c.owner==='casualty'&&(!task||task.stage==='treat')||c.reaction==='pinned')continue;
      const patientInside=patient?.building&&terrain.buildingAt(patient)===patient.building.id;
      const personalOrder=task?(task.stage==='approach'&&patientInside?{id:patient.building!.id,floor:patient.building!.floor}:undefined):order;
      const leaving=!personalOrder||personalOrder.id!==inside.id||c.reaction==='broken';
      if(c.owner==='reaction'&&!leaving){s.action='crouching';continue;}
      c.owner=task?'casualty':'building';
      // A new rescue/withdrawal may arrive during a stair traversal. Finish
      // that physical traversal before selecting the correct downward route.
      if(leaving&&!inside.exitRequested&&inside.stage!=='stairs'){
        inside.exitRequested=true;q.orderNote='Leaving building';
        if(inside.floor===1){inside.targetFloor=0;inside.route=[{...stairPoint(b),z:b.z+2}];inside.index=0;inside.stage='inside';}
        else {inside.stage='exit';inside.route=exitRoute();inside.index=0;}
      }
      if(!leaving&&inside.stage==='station'&&personalOrder&&personalOrder.floor!==inside.floor&&personalOrder.floor<buildingFloors(b)){inside.targetFloor=personalOrder.floor;inside.route=[{...stairPoint(b),z:b.z+(personalOrder.floor?-2:2)}];inside.index=0;inside.stage='inside';}
      if(inside.stage==='stairs'){
        inside.stairTime=Math.min(8,inside.stairTime+dt);const t=inside.stairTime/8;
        const from=inside.stairFrom??{x:stairPoint(b).x,z:b.z+(inside.targetFloor?-2:2)},to={x:stairPoint(b).x,z:b.z+(inside.targetFloor?2:-2)};
        inside.vertical=floorHeight(b)*(inside.targetFloor?t:1-t);s.x=from.x+(to.x-from.x)*t;s.z=from.z+(to.z-from.z)*t;s.action='climbing stairs';
        if(t>=1){inside.floor=inside.targetFloor;inside.stairTime=0;const exiting=inside.exitRequested&&inside.floor===0;inside.stage=exiting?'exit':'inside';inside.route=exiting?exitRoute():[inside.target];inside.index=0;}continue;
      }
      const target=inside.route[inside.index];
      if(!target){
        if(inside.stage==='exit'){delete s.building;c.owner=s.duty?'duty':'order';s.action='holding';continue;}
        if(inside.floor!==inside.targetFloor){if(state.soldiers.some(o=>o!==s&&o.building?.id===inside.id&&o.building.stage==='stairs')){s.action='waiting at stair';continue;}inside.stage='stairs';inside.stairTime=0;inside.stairFrom={x:s.x,z:s.z};continue;}
        inside.stage='station';s.action=task?'at casualty':'watching';c.pauseReason=undefined;
        const dx=s.x-b.x,dz=s.z-b.z;s.heading=Math.abs(dx)/(b.width/2)>Math.abs(dz)/(b.depth/2)?Math.sign(dx)*Math.PI/2:dz<0?Math.PI:0;
        continue;
      }
      const d=distance(s,target);if(d<(inside.stage==='exit'&&inside.index===inside.route.length-1?.25:inside.index<inside.route.length-1||inside.floor!==inside.targetFloor?.65:.03)){inside.index++;continue;}
      const step=Math.min(d,dt*1.35),p={x:s.x+(target.x-s.x)/d*step,z:s.z+(target.z-s.z)/d*step};
      const floorY=terrain.baseHeightAt(b.x,b.z)+inside.vertical+1;
      const blocked=(p:{x:number;z:number})=>terrain.structure(inside.id).some(box=>box.role==='wall'&&Math.abs(p.x-box.x)<box.rx+.22&&Math.abs(p.z-box.z)<box.rz+.22&&Math.abs(floorY-(terrain.baseHeightAt(b.x,b.z)+box.y))<box.ry+.6);
      // If stair handover or a loaded formation already overlaps, permit
      // continuous movement apart instead of trapping both people forever.
      const crowded=(p:{x:number;z:number})=>state.soldiers.some(o=>o!==s&&o.needs?.life==='active'&&Math.abs((o.building?.vertical??0)-inside.vertical)<1&&distance(o,p)<.58&&distance(o,p)<=distance(o,s)+.000001);
      if(crowded(p)&&!blocked(p)){
        const heading=Math.atan2(target.x-s.x,target.z-s.z);
        for(const angle of [.65,-.65,1.2,-1.2,Math.PI/2,-Math.PI/2,Math.PI]){const candidate={x:s.x+Math.sin(heading+angle)*step,z:s.z+Math.cos(heading+angle)*step};if(!crowded(candidate)&&!blocked(candidate)){p.x=candidate.x;p.z=candidate.z;break;}}
      }
      if(blocked(p)||crowded(p)){s.action='waiting at doorway';c.pauseReason=blocked(p)?'Building route blocked':'Yielding at narrow doorway';continue;}
      s.heading=Math.atan2(target.x-s.x,target.z-s.z);s.x=p.x;s.z=p.z;s.action='walking to firing position';
      if(inside.stage==='approach'&&buildingContains(b,s,.4))inside.stage='inside';
      s.cover=terrain.coverAt(s.x,s.z);
    }
  }
  for(const helper of state.soldiers){const task=helper.combat?.careTask;if(!task||!['carry','evacuate'].includes(task.stage))continue;const patient=state.soldiers.find(p=>p.id===task.patientId);if(patient&&helper.building){patient.x=helper.x;patient.z=helper.z;patient.building=structuredClone(helper.building);patient.action='being carried';}}
}
