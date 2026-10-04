import {distance,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {commandEnemy,type EnemyMemory,type EnemyObservation} from './EnemyCommander';
import {atDepth,frontDepth} from './OperationGeometry';
import {type FrontGeometry,type OperationalCommandMemory,type ArmyPlanPhase,type OperationalSectorId,type OperationalSectorMemory} from './OperationalTypes';
import {buildingUtility} from '../terrain/BuildingUtility';

export interface OperationalKnowledge {
  mission?:{kind:import('./MissionContent').MissionKind;houseId:number;house:Vec2;secondHouseId?:number;secondHouse?:Vec2;preparationSeconds:number;frontage:number};
  intent:'defend'|'penetrate'|'contest';front:FrontGeometry;rear:Vec2;deploymentDepth:number;
  targets:{id:string;point:Vec2}[];
  staging?:{id:string;point:Vec2}[];
  positions?:{id:number;point:Vec2;defenders:number;prepared:number;support:number;ammo:number;materials:number}[];
  logistics?:{blocked:number;loads:number;ammo:number;materials:number};
  knownSmoke?:{x:number;z:number;radius:number;until:number}[];
}
const MANEUVER_SECTORS=['left','center','right'] as const;
const lateral=(k:OperationalKnowledge,p:Vec2)=>(p.x-k.front.origin.x)*k.front.right.x+(p.z-k.front.origin.z)*k.front.right.z;
const sectorOf=(k:OperationalKnowledge,p:Vec2):Exclude<OperationalSectorId,'rear'>=>lateral(k,p)<-170?'left':lateral(k,p)>170?'right':'center';
const sectorOffset=(id:Exclude<OperationalSectorId,'rear'>)=>id==='left'?-360:id==='right'?360:0;
function summarizeSectors(o:EnemyObservation):OperationalSectorMemory[]{
  const k=o.operational!,rows:OperationalSectorMemory[]=MANEUVER_SECTORS.map(id=>({id,friendly:0,ready:0,contacts:0,suppression:0,ammo:0,prepared:0,support:0,exposed:false,center:atDepth(k.front,k.deploymentDepth-180,sectorOffset(id))}));
  for(const q of o.squads){const row=rows.find(r=>r.id===sectorOf(k,q))!;row.friendly+=q.able;row.ready+=q.able>=3&&q.energy>=25&&q.morale>=30&&q.suppression<65?1:0;row.suppression+=q.suppression;row.ammo+=q.ammo;}
  for(const c of o.contacts.filter(c=>c.active&&o.at-c.lastSeen<=20))rows.find(r=>r.id===sectorOf(k,c))!.contacts++;
  for(const p of k.positions??[]){const row=rows.find(r=>r.id===sectorOf(k,p.point))!;row.prepared+=p.prepared;row.support+=p.support;row.ammo+=p.ammo;}
  for(const row of rows){row.suppression/=Math.max(1,o.squads.filter(q=>sectorOf(k,q)===row.id).length);row.exposed=row.contacts*3>row.friendly+row.support*2;}
  const rear=o.squads.filter(q=>frontDepth(k.front,q)>k.deploymentDepth+80);
  return [...rows,{id:'rear',friendly:rear.reduce((n,q)=>n+q.able,0),ready:rear.filter(q=>q.able>=3&&q.energy>=25&&q.morale>=30).length,contacts:0,suppression:rear.reduce((n,q)=>n+q.suppression,0)/Math.max(1,rear.length),ammo:rear.reduce((n,q)=>n+q.ammo,0),prepared:0,support:0,exposed:false,center:atDepth(k.front,k.deploymentDepth+180,0)}];
}
/** Takes ONLY the information-firewall observation. It cannot inspect the live world,
 * objective oracle, player orders, hidden casualties or mission-completion progress. */
export function commandOperationalEnemy(o:EnemyObservation,terrain:TerrainSystem,previous?:EnemyMemory,old?:OperationalCommandMemory){
  const k=o.operational!,combat=o.squads.filter(q=>!q.working);
  const ready=combat.filter(q=>q.able>=3&&q.ammo>=8&&q.energy>=25&&q.morale>=30&&q.suppression<65);
  const fit=combat.filter(q=>q.able>=3&&q.energy>=25&&q.morale>=30&&q.suppression<65);
  const able=combat.reduce((n,q)=>n+q.able,0),start=old?.startingAble??able;
  const report=o.contacts.filter(c=>o.at-c.lastSeen<=12&&c.active).sort((a,b)=>b.lastSeen-a.lastSeen)[0];
  const exhausted=fit.length<2||able<start*.45||old?.phase==='withdrawing'&&o.at-old.since<60;
  const scouts=ready.filter(q=>!q.emplaced).slice(0,2),scoutProgress=scouts.length>=2&&scouts.every(q=>frontDepth(k.front,q)<k.deploymentDepth-180);
  // Public terrain ahead of the deployment line is useful reconnaissance.
  // Choosing the closest town to the rear instead sent the opening scouts
  // backwards and needlessly delayed pressure on an otherwise open front.
  const forwardSites=k.staging?.filter(site=>frontDepth(k.front,site.point)<k.deploymentDepth-100);
  const approach=atDepth(k.front,k.deploymentDepth,0);
  const staging=(forwardSites?.length?forwardSites:k.staging)?.slice().sort((a,b)=>distance(approach,a.point)-distance(approach,b.point)||a.id.localeCompare(b.id))[0];
  const reached=staging&&scouts.some(q=>distance(q,staging.point)<160);
  const assembled=staging&&ready.filter(q=>!q.emplaced&&distance(q,staging.point)<200).length>=3;
  const contested=staging&&o.contacts.some(c=>c.active&&o.at-c.lastSeen<20&&distance(c,staging.point)<120);
  const developed=assembled&&!contested;
  const sectors=summarizeSectors(o),maneuver=sectors.filter((s):s is OperationalSectorMemory&{id:Exclude<OperationalSectorId,'rear'>}=>s.id!=='rear');
  let failures=(old?.failedApproaches??[]).filter(f=>f.cooldownUntil>o.at-180).slice(-6);
  const currentDepth=Math.min(k.deploymentDepth,...ready.map(q=>frontDepth(k.front,q))),oldAttack=old?.attack;
  const failed=old?.planPhase==='assaulting'&&oldAttack&&o.at-oldAttack.since>=45&&(able<=oldAttack.startingAble*.76||currentDepth>oldAttack.startingDepth-45);
  if(failed&&!failures.some(f=>f.at===oldAttack.since))failures.push({sector:oldAttack.sector,at:o.at,loss:Math.max(0,oldAttack.startingAble-able),progress:Math.max(0,oldAttack.startingDepth-currentDepth),heavyResistance:maneuver.find(s=>s.id===oldAttack.sector)!.suppression>=45,support:oldAttack.support,cooldownUntil:o.at+150});
  const cooled=(id:Exclude<OperationalSectorId,'rear'>)=>failures.some(f=>f.sector===id&&f.cooldownUntil>o.at);
  const terrainValue=(id:Exclude<OperationalSectorId,'rear'>)=>{const p=atDepth(k.front,k.deploymentDepth-260,sectorOffset(id));return (terrain.distanceToRoad(p.x,p.z)<90?3:0)+Math.min(3,terrain.buildings.filter(b=>distance(b,p)<180).length);};
  const candidate=maneuver.filter(s=>!cooled(s.id)).sort((a,b)=>(a.contacts*6-a.ready*1.5-terrainValue(a.id))-(b.contacts*6-b.ready*1.5-terrainValue(b.id))||a.id.localeCompare(b.id))[0]??maneuver.slice().sort((a,b)=>a.contacts-b.contacts||a.id.localeCompare(b.id))[0];
  const threatened=maneuver.slice().sort((a,b)=>Number(b.exposed)-Number(a.exposed)||b.contacts-a.contacts||a.id.localeCompare(b.id))[0];
  const lostPrepared=old?.sectors?.find(s=>s.id!=='rear'&&s.prepared>(maneuver.find(n=>n.id===s.id)?.prepared??0));
  const meanAmmo=ready.reduce((n,q)=>n+q.ammo,0)/Math.max(1,ready.length),logistics=k.logistics;
  let plan:ArmyPlanPhase=old?.planPhase??(k.intent==='defend'?'holding':'establishing-front'),planSince=old?.planSince??o.at,activeSector=old?.activeSector??candidate.id,planReason=old?.reason??(k.intent==='defend'?'Protect the belt; react only to received reports':'Two formations reconnoitre together; main body assembles in depth');
  const change=(next:ArmyPlanPhase,reason:string,sector=activeSector)=>{if(plan!==next){plan=next;planSince=o.at;}planReason=reason;activeSector=sector;};
  if(exhausted){
    const fallbackReady=old?.planPhase==='forming-fallback'||old?.planPhase==='withdrawing'&&o.at-(old.planSince??o.at)>=30;
    change(fallbackReady?'forming-fallback':'withdrawing',fallbackReady?'Hold the supplied fallback line while depleted formations recover':'Preserve viable formations and form a supplied fallback line',threatened.id);
  }
  else if(threatened.exposed&&threatened.contacts>=2)change(lostPrepared&&ready.length>=3?'counterattacking':'reinforcing',lostPrepared?'A prepared sector was lost; local strength permits a bounded counterattack':'Observed pressure exceeds local defense; move the reserve',threatened.id);
  else if((logistics?.blocked??0)>0&&meanAmmo<16||meanAmmo<8)change('resupplying','Offensive ambition reduced until physical ammunition and route access recover',activeSector);
  else if(failed)change('assessing','Assault failed to gain useful ground; cool this approach and reassess',candidate.id);
  else if(k.intent==='defend')change('holding','Staff the useful line, observe approaches and retain a mobile reserve',threatened.id);
  else if(plan==='establishing-front'&&o.at-planSince>=30)change('probing','Two forward formations probe while the main body and reserve remain in depth',candidate.id);
  else if(plan==='probing'&&(maneuver.some(s=>s.contacts>0)||o.at-planSince>=60))change('assessing','Delivered reports are sufficient for a bounded sector comparison',candidate.id);
  else if(plan==='assessing'&&o.at-planSince>=12)change('preparing-attack','Assemble support and fit formations on the best legitimate approach',candidate.id);
  else if(plan==='preparing-attack'&&(o.at-planSince>=30||ready.filter(q=>sectorOf(k,q)===activeSector).length>=3))change('assaulting','Commit the assembled force behind physical support; retain the reserve',activeSector);
  else if(plan==='assaulting'&&oldAttack&&currentDepth<oldAttack.startingDepth-140)change('consolidating','Useful ground gained; secure the new line before another advance',activeSector);
  else if(plan==='consolidating'&&o.at-planSince>=35)change('probing','Captured ground secured; probe again before choosing the next attack',candidate.id);
  else if(['reinforcing','counterattacking'].includes(plan)&&!threatened.exposed&&o.at-planSince>=24)change('holding','Threat stabilized; rebuild the reserve and maintain the line',threatened.id);
  else if(plan==='resupplying'&&meanAmmo>=18&&(logistics?.blocked??0)===0)change('assessing','Ammunition and route health support renewed planning',candidate.id);
  const reserveCount=ready.length>=7?2:ready.length>=4?1:0;
  const retained=(old?.reserveIds??[]).filter(id=>ready.some(q=>q.id===id)&&!ready.find(q=>q.id===id)?.emplaced);
  const reserveIds=[...retained,...ready.filter(q=>!retained.includes(q.id)&&!q.emplaced).sort((a,b)=>frontDepth(k.front,b)-frontDepth(k.front,a)||b.energy-a.energy||a.id-b.id).map(q=>q.id)].slice(0,reserveCount);
  const phase=exhausted?'withdrawing':k.intent==='defend'?'holding':staging?
    old?.phase==='committing'||developed&&old?.phase==='consolidating'&&o.at-old.since>=18?'committing':developed?'consolidating':'scouting':
    scoutProgress||report?'committing':old?.phase==='committing'?'committing':'scouting';
  const transitions=[...(old?.transitions??[])];if(!old?.planPhase||old.planPhase!==plan)transitions.push({phase:plan,at:o.at,reason:planReason,sector:activeSector});
  const commander:OperationalCommandMemory={phase,since:old?.phase===phase?old.since:o.at,startingAble:start,nextSupport:old?.nextSupport??0,reason:planReason,planPhase:plan,planSince,reviewAt:o.at+3,activeSector,reserveIds,sectors,failedApproaches:failures.slice(-6),transitions:transitions.slice(-32),attack:plan==='assaulting'?(old?.attack?.sector===activeSector&&!failed?old.attack:{sector:activeSector,since:o.at,startingAble:able,startingDepth:currentDepth,support:'none'}):undefined};
  const assignments=combat.map((q,i)=>{
    const target=k.targets[i%k.targets.length],reserve=k.mission?i===(k.mission?.kind==='breakthrough'?Math.max(1,combat.length-3):combat.length-1)&&combat.length>=4:reserveIds.includes(q.id);
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
    if(staging&&!exhausted){
      const guard=i===Math.max(2,combat.length-2);
      if(reserve||guard){goal=atDepth(k.front,k.deploymentDepth+(reserve?60:0),(i%3-1)*120);defend=true;}
      else if(phase!=='committing'){
        goal=scouts.some(s=>s.id===q.id)||reached?{x:staging.point.x+k.front.forward.x*(scouts.some(s=>s.id===q.id)?0:90)+k.front.right.x*(i%3-1)*35,z:staging.point.z+k.front.forward.z*(scouts.some(s=>s.id===q.id)?0:90)+k.front.right.z*(i%3-1)*35}:atDepth(k.front,k.deploymentDepth-100,(i%3-1)*120);
        defend=Boolean(reached&&distance(q,goal)<65||!reached&&!scouts.some(s=>s.id===q.id));
      }
    }
    if(!k.mission&&!exhausted){
      const lane=sectorOffset(activeSector),contact=o.contacts.filter(c=>c.active&&o.at-c.lastSeen<=20&&sectorOf(k,c)===activeSector).sort((a,b)=>b.lastSeen-a.lastSeen||a.soldierId-b.soldierId)[0];
      if(plan==='probing'){
        if(scouts.includes(q)){const offset=q.id===scouts[0]?.id?lane:lane+(activeSector==='left'?180:-180);goal=atDepth(k.front,k.deploymentDepth-260,offset);defend=false;}
        else {goal=atDepth(k.front,k.deploymentDepth-80,(i%3-1)*90);defend=true;}
      }else if(plan==='assessing'||plan==='preparing-attack'){
        goal=reserve?atDepth(k.front,k.deploymentDepth+70,lane*.35):atDepth(k.front,k.deploymentDepth-130,lane+(i%3-1)*35);defend=true;
      }else if(plan==='assaulting'){
        if(reserve){goal=atDepth(k.front,k.deploymentDepth-40,lane*.55);defend=true;}
        else {const depth=Math.max(-850,currentDepth-170);goal=contact?{x:contact.x+k.front.forward.x*45+k.front.right.x*(i%3-1)*22,z:contact.z+k.front.forward.z*45+k.front.right.z*(i%3-1)*22}:atDepth(k.front,depth,lane+(i%3-1)*45);defend=false;}
      }else if(plan==='consolidating'){goal={x:q.x,z:q.z};defend=true;}
      else if(plan==='reinforcing'||plan==='counterattacking'){
        goal=contact?{x:contact.x-k.front.forward.x*(plan==='reinforcing'?100:45),z:contact.z-k.front.forward.z*(plan==='reinforcing'?100:45)}:atDepth(k.front,k.deploymentDepth-80,lane);defend=plan==='reinforcing';
      }else if(plan==='resupplying'||plan==='forming-fallback'){
        const supplied=(k.positions??[]).filter(p=>p.ammo>0).sort((a,b)=>distance(q,a.point)-distance(q,b.point)||a.id-b.id)[0];goal=supplied?.point??atDepth(k.front,k.deploymentDepth+180,lane*.4);defend=true;
      }
    }
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
  if(!k.mission&&!exhausted){
    const occupied=new Set(combat.flatMap(q=>q.buildingOrder===undefined?[]:[q.buildingOrder]));
    for(const plan of result.memory.plans){
      const q=combat.find(q=>q.id===plan.squadId),command=result.commands.find(c=>c.squadId===plan.squadId);
      if(!q||q.emplaced||q.working||q.supportBusy||q.buildingOrder!==undefined||q.suppression>=30||plan.role!=='defend')continue;
      // A settled defender may need no tactical Move, but still reviews nearby
      // shelter. Do not interrupt an existing journey or an unexpired order.
      if(!command&&(q.moving||q.planning||(previous?.plans.find(p=>p.squadId===q.id)?.commitUntil??0)>o.at))continue;
      // Known terrain only. A nearby house may replace an exposed holding
      // point; no bonus, hidden occupancy oracle or long diversion is used.
      const houses=terrain.buildings.map((house,id)=>({house,id})).filter(b=>!occupied.has(b.id)&&distance(q,b.house)<60&&distance(plan.goal,b.house)<75);
      const value=(b:typeof houses[number])=>{const u=buildingUtility(b.house);return Math.min(q.able,u.places)*2+u.elevation*3-distance(q,b.house)*.35-u.road*.04;};
      const house=houses.sort((a,b)=>value(b)-value(a)||a.id-b.id)[0];
      if(house){
        occupied.add(house.id);
        const goal={x:house.house.x,z:house.house.z},reason='Use nearby sheltered firing positions; preserve the holding task';
        if(command){command.type='move';command.goal={...goal};command.reason=reason;}
        else {result.commands.push({squadId:q.id,type:'move',goal:{...goal},role:'defend',reason});plan.orders++;}
        // The serialized plan must describe the order actually issued, not its
        // superseded outdoor holding point.
        plan.goal=goal;plan.reason=reason;plan.lastIssued=o.at;plan.commitUntil=Math.max(plan.commitUntil,o.at+24);
      }
    }
  }
  let support:{kind:'mortarHE'|'mortarSmoke';squadId:number;target:Vec2}|undefined;
  const supportReport=o.contacts.filter(c=>c.active&&o.at-c.lastSeen<=12&&sectorOf(k,c)===activeSector).sort((a,b)=>b.lastSeen-a.lastSeen||a.soldierId-b.soldierId)[0]??report;
  const mortar=o.squads.find(q=>q.mortar&&q.mortarReady&&((q.mortarAmmo??0)>0||(q.mortarSmoke??0)>0)&&q.able>=2&&!q.working&&!q.supportBusy&&q.suppression<65&&q.morale>=30&&supportReport&&distance(q,supportReport)>=50&&distance(q,supportReport)<=900);
  if(!exhausted&&supportReport&&mortar&&o.at>=commander.nextSupport!){
    result.commands=result.commands.filter(c=>c.squadId!==mortar.id);
    if(!mortar.moving){const smokeUseful=(plan==='preparing-attack'||maneuver.find(s=>s.id===activeSector)!.suppression>=35)&&(mortar.mortarSmoke??0)>0&&!k.knownSmoke?.some(s=>s.until>o.at&&distance(s,supportReport)<s.radius+20);const kind=smokeUseful?'mortarSmoke':'mortarHE';if(kind==='mortarSmoke'||(mortar.mortarAmmo??0)>0){commander.nextSupport=o.at+30;support={kind,squadId:mortar.id,target:{x:supportReport.x,z:supportReport.z}};if(commander.attack)commander.attack.support=kind==='mortarSmoke'?'smoke':'he';}}
  }
  return {...result,commander,support};
}
