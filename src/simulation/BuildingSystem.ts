import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import {buildingContains,buildingFloors,doorPoint,firingPoints,floorHeight,stairPoint} from '../terrain/BuildingGeometry';
import {postureSpeed} from '../combat/Posture';
import {bodyBlocks,sameSide} from '../navigation/FriendlyTraffic';
import {detachedFromFormation} from '../operations/AssaultPlan';

/** Formation navigation uses a coarse grid. Its rounded first cell is not a
 * safe individual leg past a house corner. Validate every exterior leg and
 * route around actual footprint corners when that first leg clips masonry. */
function exteriorApproach(from:Vec2,id:number,terrain:TerrainSystem,nav:SquadNavigation):Vec2[]{
  const b=terrain.buildings[id],entrance=doorPoint(b,8);
  const clear=(a:Vec2,z:Vec2)=>{
    const n=Math.max(1,Math.ceil(distance(a,z)/.35));
    for(let i=1;i<=n;i++){const t=i/n;if(terrain.obstacleAt(a.x+(z.x-a.x)*t,a.z+(z.z-a.z)*t,.45))return false;}
    return true;
  };
  if(clear(from,entrance))return [entrance];
  const planned=nav.plan(from,entrance);
  if(planned.length&&planned.every((p,i)=>clear(i?planned[i-1]:from,p)))return planned;
  const corners=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,z])=>({x:b.x+x*(b.width/2+1.4),z:b.z+z*(b.depth/2+1.4)}));
  const points=[from,entrance,...corners],cost=points.map(()=>Infinity),previous=points.map(()=>-1),seen=new Set<number>();cost[0]=0;
  for(let n=0;n<points.length;n++){
    let index=-1;for(let i=0;i<points.length;i++)if(!seen.has(i)&&(index<0||cost[i]<cost[index]))index=i;
    if(index<0||!Number.isFinite(cost[index]))break;if(index===1){const route:Vec2[]=[];for(let i=1;i!==0;i=previous[i])route.unshift({...points[i]});return route;}
    seen.add(index);for(let i=1;i<points.length;i++)if(!seen.has(i)&&clear(points[index],points[i])){const d=cost[index]+distance(points[index],points[i]);if(d<cost[i]){cost[i]=d;previous[i]=index;}}
  }
  return [];
}

export function beginBuildingTravel(s:SoldierState,id:number,level:0|1,target:Vec2,terrain:TerrainSystem,nav:SquadNavigation):boolean {
  const site=terrain.buildings[id];if(!site||level>=buildingFloors(site))return false;
  const entrance=doorPoint(site,8),approach=exteriorApproach(s,id,terrain,nav);if(!approach.length)return false;
  s.building={id,floor:0,vertical:0,route:[...approach,entrance,doorPoint(site,-1),...(level?[{...stairPoint(site),z:site.z-2}]:[{x:site.x,z:site.z},target])],index:0,stage:'approach',target:{...target},targetFloor:level,stairTime:0};return true;
}

/** Explicit interior intent. Normal formation navigation never squeezes a squad
 * through a wall; individual people use the same door and stairs. */
export function stepBuildings(state:BattlefieldState,terrain:TerrainSystem,nav:SquadNavigation,dt:number):void {
  const sides=new Map(state.squads.map(q=>[q.id,q.faction??'player']));
  for(const q of state.squads){
    const order=q.order.building,site=order?terrain.buildings[order.id]:undefined;
    const people=state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life==='active');
    if(site&&order)for(const s of people){
      if(detachedFromFormation(state,s)||s.building||s.combat?.owner==='reaction'||s.combat?.owner==='casualty'||s.selfCare&&s.selfCare.stage!=='return')continue;
      const points=firingPoints(site),level=Math.min(order.floor,buildingFloors(site)-1) as 0|1;
      const occupied=state.soldiers.filter(p=>p!==s&&p.needs?.life==='active'&&sides.get(p.squadId)===(q.faction??'player')).flatMap(p=>p.selfCare?.home.building?.id===order.id&&p.selfCare.home.building.floor===level?[p.selfCare.home.building.target]:p.building?.id===order.id&&p.building.targetFloor===level&&!p.building.exitRequested?[p.building.target]:[]);
      const reserved=s.selfCare?.home.building;
      const target=reserved?.id===order.id?reserved.target:points.find(p=>!occupied.some(o=>distance(p,o)<.8));
      if(!target){const c=s.combat??={shotSequence:0};c.owner='building';c.pauseReason='Building floor full · waiting outside; choose another floor or building';s.action='waiting for building space';continue;}
      if(!beginBuildingTravel(s,order.id,level,target,terrain,nav)){(s.combat??={shotSequence:0}).pauseReason='Building entrance blocked';continue;}
    }
    for(const s of people){
      const inside=s.building;if(!inside)continue;
      const b=terrain.buildings[inside.id],c=s.combat??={shotSequence:0};if(!b){delete s.building;continue;}
      if(c.owner==='self-care')continue;
      const exitRoute=()=>{const i=q.soldierIds.indexOf(s.id),out=doorPoint(b,8);return [{x:b.x,z:b.z-2},doorPoint(b,-1),doorPoint(b,4),{x:out.x+(i%4-1.5)*1.6,z:out.z-Math.floor(i/4)*1.6}];};
      const task=c.careTask,patient=task?state.soldiers.find(p=>p.id===task.patientId):undefined;
      if(c.owner==='support'||c.owner==='casualty'&&(!task||task.stage==='treat')||c.reaction==='pinned')continue;
      const patientInside=patient?.building&&terrain.buildingAt(patient)===patient.building.id;
      const personalOrder=task?(task.stage==='approach'&&patientInside?{id:patient.building!.id,floor:patient.building!.floor}:undefined):s.selfCare?.stage==='exit'||detachedFromFormation(state,s)?undefined:order;
      const leaving=!personalOrder||personalOrder.id!==inside.id||c.reaction==='broken';
      // An Occupy reservation exists during the exterior approach. Cancelling
      // it for aid/withdrawal is not an indoor exit: walking to the hall first
      // would drive a flank arrival into masonry and block every other arrival.
      // Also release that impossible first exit leg from earlier saved runs.
      if(inside.floor===0&&!buildingContains(b,s,-.25)&&(leaving&&inside.stage==='approach'||inside.exitRequested&&inside.stage==='exit'&&inside.index===0)){
        delete s.building;c.owner=task?'casualty':s.duty?'duty':'order';s.action='holding';delete c.pauseReason;continue;
      }
      if(c.owner==='reaction'&&!leaving){s.action='crouching';continue;}
      c.owner=task?'casualty':'building';
      // Keep the route and reservation during a physical recovery break.
      // Danger interrupts sleep; neither this nor food heals combat wounds.
      if(!task&&!leaving&&inside.stage!=='stairs'&&s.suppression<15&&state.elapsed-(c.lastIncoming??-1000)>15){
        if(s.needs!.energy<12)inside.recovering=true;
        if(inside.recovering&&s.needs!.energy>=28)delete inside.recovering;
        if(inside.recovering){s.action='sleeping';s.posture='prone';c.pauseReason='Exhausted · recovery break; building order retained';continue;}
      }
      if(leaving)delete inside.recovering;
      // A new rescue/withdrawal may arrive during a stair traversal. Finish
      // that physical traversal before selecting the correct downward route.
      if(leaving&&!inside.exitRequested&&inside.stage!=='stairs'){
        inside.exitRequested=true;if(!s.selfCare)q.orderNote='Leaving building';
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
      let target=inside.route[inside.index];
      if(!target){
        if(inside.stage==='exit'){delete s.building;c.owner=s.duty?'duty':'order';s.action='holding';continue;}
        if(inside.floor!==inside.targetFloor){if(state.soldiers.some(o=>o!==s&&o.building?.id===inside.id&&o.building.stage==='stairs')){s.action='waiting at stair';continue;}inside.stage='stairs';inside.stairTime=0;inside.stairFrom={x:s.x,z:s.z};continue;}
        inside.stage='station';s.action=task?'at casualty':'watching';c.pauseReason=undefined;
        const dx=s.x-b.x,dz=s.z-b.z;s.heading=Math.abs(dx)/(b.width/2)>Math.abs(dz)/(b.depth/2)?Math.sign(dx)*Math.PI/2:dz<0?Math.PI:0;
        continue;
      }
      // One physical passage at a time. Exiting people have priority; waiting
      // arrivals spread either side of the approach instead of filling the door.
      const door=doorPoint(b,0),traffic=state.soldiers.filter(p=>sides.get(p.squadId)===(q.faction??'player')&&p.needs?.life==='active'&&p.combat?.reaction!=='pinned'&&p.building?.id===inside.id&&p.building.floor===0&&(p.building.stage==='approach'||p.building.stage==='exit'||p.building.stage==='inside'&&p.z<door.z+2.5)&&distance(p,door)<18);
      // Distance priority oscillates when a flank approach first needs to move
      // away from the doorway. Finish passages already inside, then use stable
      // identity among waiting arrivals; moving a step never forfeits priority.
      traffic.sort((a,b)=>Number(b.building!.stage==='exit')-Number(a.building!.stage==='exit')||Number(b.building!.stage==='inside')-Number(a.building!.stage==='inside')||a.id-b.id);
      const waiting=inside.stage==='approach'&&distance(s,door)<16&&traffic[0]?.id!==s.id&&!!traffic[0]&&!sameSide(state,s,traffic[0]);
      if(waiting){const queue=traffic.filter(p=>p.building!.stage==='approach').sort((a,b)=>a.id-b.id),rank=Math.max(0,queue.indexOf(s));target={x:door.x+(rank%2?1:-1)*3.2,z:door.z-10-Math.floor(rank/2)*1.4};if(terrain.obstacleAt(target.x,target.z,.5)){s.action='waiting at doorway';c.pauseReason='Doorway queue · approach obstructed';continue;}}
      const d=distance(s,target);if(d<(waiting?.15:inside.stage==='exit'&&inside.index===inside.route.length-1?.25:inside.index<inside.route.length-1||inside.floor!==inside.targetFloor?.65:.03)){if(!waiting)inside.index++;else{s.action='waiting at doorway';c.pauseReason='Doorway queue · yielding to passage';}continue;}
      const step=Math.min(d,dt*1.35*postureSpeed(s)),p={x:s.x+(target.x-s.x)/d*step,z:s.z+(target.z-s.z)/d*step};
      const floorY=terrain.baseHeightAt(b.x,b.z)+inside.vertical+1;
      const blocked=(p:{x:number;z:number})=>terrain.structure(inside.id).some(box=>box.role==='wall'&&Math.abs(p.x-box.x)<box.rx+.22&&Math.abs(p.z-box.z)<box.rz+.22&&Math.abs(floorY-(terrain.baseHeightAt(b.x,b.z)+box.y))<box.ry+.6);
      // If stair handover or a loaded formation already overlaps, permit
      // continuous movement apart instead of trapping both people forever.
      const crowded=(p:{x:number;z:number})=>state.soldiers.some(o=>Math.abs((o.building?.vertical??0)-inside.vertical)<1&&bodyBlocks(state,s,o,p,.58));
      if(crowded(p)&&!blocked(p)){
        const heading=Math.atan2(target.x-s.x,target.z-s.z);
        for(const angle of [.65,-.65,1.2,-1.2,Math.PI/2,-Math.PI/2,Math.PI]){const candidate={x:s.x+Math.sin(heading+angle)*step,z:s.z+Math.cos(heading+angle)*step};if(!crowded(candidate)&&!blocked(candidate)){p.x=candidate.x;p.z=candidate.z;break;}}
      }
      if(blocked(p)||crowded(p)){
        // Repair an old saved approach, or one displaced by a combat/rescue
        // interruption. Keep the same destination and move through its new legs.
        if(blocked(p)&&inside.stage==='approach'&&!waiting&&state.elapsed>=(inside.routeReviewAt??0)){
          inside.routeReviewAt=state.elapsed+3;const approach=exteriorApproach(s,inside.id,terrain,nav);
          if(approach.length){const doorway=doorPoint(b,-1),entry=inside.route.findIndex(v=>distance(v,doorway)<.1);if(entry>=0){inside.route=[...approach,...inside.route.slice(entry)];inside.index=0;}}
        }
        s.action='waiting at doorway';c.pauseReason=blocked(p)?'Building route blocked':'Yielding at narrow doorway';continue;
      }
      s.heading=Math.atan2(target.x-s.x,target.z-s.z);s.x=p.x;s.z=p.z;s.action=waiting?'joining doorway queue':inside.stage==='exit'?'leaving building':'walking to firing position';c.pauseReason=waiting?'Doorway queue · yielding to passage':undefined;
      if(inside.stage==='approach'&&buildingContains(b,s,.4))inside.stage='inside';
      s.cover=terrain.coverAt(s.x,s.z);
    }
  }
  for(const helper of state.soldiers){const task=helper.combat?.careTask;if(!task||!['carry','evacuate'].includes(task.stage))continue;const patient=state.soldiers.find(p=>p.id===task.patientId);if(patient&&helper.building){patient.x=helper.x;patient.z=helper.z;patient.building=structuredClone(helper.building);patient.action='being carried';}}
}
