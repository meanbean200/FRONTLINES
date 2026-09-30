import {distance,type BattlefieldState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {GarrisonSystem} from '../garrison/GarrisonSystem';
import {squadHasEquipment} from '../combat/Equipment';
import {reservedConstructionTeam} from '../construction/WorkAssignments';
import {atDepth,frontDepth} from './OperationGeometry';
import {polylineLength} from '../core/types';

export interface OpenFrontWorksCommands {
  create:(points:Vec2[],builderId:number)=>number|undefined;
  assist:(squadId:number,trenchId:number)=>boolean;
}
/** Deterministic construction intentions, not generated completed fortifications.
 * Uses own formations, public ground and delivered reports only. Production
 * workers still walk, take cover, dig and haul every support material. */
export function stepOpenFrontWorks(state:BattlefieldState,terrain:TerrainSystem,garrisons:GarrisonSystem,commands:OpenFrontWorksCommands):void {
  const r=state.operation?.runtime,m=r?.openFront;if(!r||!m||state.elapsed<m.nextWorks)return;
  m.nextWorks=state.elapsed+5;
  const own=state.squads.filter(q=>q.faction==='enemy'),reports=state.operation!.intelligence?.command.enemy??[];
  for(const work of m.works){
    const trench=state.trenches.find(t=>t.id===work.trenchId);if(!trench||work.stage!=='building'||trench.status!=='complete')continue;
    if(r.commander?.phase==='withdrawing'&&reports.some(c=>c.active&&state.elapsed-c.lastSeen<20&&distance(c,trench.points[Math.floor(trench.points.length/2)])<140))continue;
    const survivors=work.squadIds.filter(id=>own.some(q=>q.id===id&&q.soldierIds.some(person=>state.soldiers.some(s=>s.id===person&&s.needs?.life==='active'))));
    // Teams can finish their production work on adjacent ticks. Do not mark
    // the entire project occupied after assigning only the first team.
    if(survivors.some(id=>own.some(q=>q.id===id&&q.order.type==='construct-trench')))continue;
    const available=survivors.filter(id=>own.some(q=>q.id===id&&q.order.type!=='move'));
    if(!available.length||!garrisons.assign(available,trench.id))continue;
    const g=state.living!.garrisons.find(g=>g.squadIds.some(id=>available.includes(id)))!;
    g.front=Math.atan2(-r.front.forward.x,-r.front.forward.z);g.readiness='alert';g.nextDecision=0;g.nextSupport=state.elapsed;
    work.stage='occupying';state.operation!.campaign!.enemyTrench=g.trenchId;
  }
  // Do not consume the mobile force: two mixed-equipped formations establish
  // the first useful line while the others scout, cover and remain in reserve.
  if(!m.works.length){
    const builders=own.filter(q=>squadHasEquipment(state,q,'tools')&&!reservedConstructionTeam(state,q.id)&&q.order.type!=='construct-trench').slice(-2);
    if(builders.length<2)return;
    for(let attempt=0;attempt<36;attempt++){
      const center=atDepth(r.front,315+Math.floor(attempt/6)*8,45+(attempt%6-2)*16);
      const points=[-40,-20,0,20,40].map((n,i)=>({x:center.x+r.front.right.x*n+r.front.forward.x*(i%2*3),z:center.z+r.front.right.z*n+r.front.forward.z*(i%2*3)}));
      if(!safeWork(points,terrain,reports,state.elapsed))continue;
      const id=commands.create(points,builders[0].id);if(id===undefined)continue;
      const members=[builders[0].id];if(commands.assist(builders[1].id,id))members.push(builders[1].id);
      m.works.push({side:'enemy',trenchId:id,squadIds:members,stage:'building'});return;
    }
    return;
  }
  if(m.works.some(w=>w.stage==='building')||m.works.length>=9||state.elapsed<180)return;
  const lines=m.works.filter(w=>polylineLength(state.trenches.find(t=>t.id===w.trenchId)?.points??[])>=65),home=lines.at(-1)??m.works[0],trench=state.trenches.find(t=>t.id===home.trenchId)!;
  const g=state.living!.garrisons.find(g=>g.trenchId===home.trenchId);
  if(!g||!state.living!.facilities.some(f=>f.garrisonId===g.id&&f.kind==='emplacement'&&f.progress===1))return;
  const next=forwardWorkIntent(state,home.trenchId);
  if(next&&lines.length<3){
    // A reported fight and our own sustained forward deployment justify a new
    // line. Do not follow hidden opponents, reclaim installed crews, or erase
    // the older earthworks/stocks. The old position remains a physical rear hub.
    const teams=own.filter(q=>!reservedConstructionTeam(state,q.id)&&!q.order.building&&squadHasEquipment(state,q,'tools')&&distance(q,next)<240&&state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life==='active'&&s.needs.energy>35&&s.suppression<60).length>=4)
      .sort((a,b)=>distance(a,next)-distance(b,next)||a.id-b.id).slice(0,2);
    if(teams.length===2)for(let attempt=0;attempt<12;attempt++){
      const center={x:next.x+r.front.right.x*((attempt%5-2)*12)+r.front.forward.x*Math.floor(attempt/5)*12,z:next.z+r.front.right.z*((attempt%5-2)*12)+r.front.forward.z*Math.floor(attempt/5)*12};
      const points=[-36,-18,0,18,36].map((n,i)=>({x:center.x+r.front.right.x*n+r.front.forward.x*(i%2*3),z:center.z+r.front.right.z*n+r.front.forward.z*(i%2*3)}));
      if(!safeWork(points,terrain,reports,state.elapsed)||state.trenches.some(t=>t.points.some(p=>distance(p,center)<60)))continue;
      const id=commands.create(points,teams[0].id);if(id===undefined)continue;
      const members=[teams[0].id];if(commands.assist(teams[1].id,id))members.push(teams[1].id);
      m.works.push({side:'enemy',trenchId:id,squadIds:members,stage:'building'});return;
    }
  }
  if(r.commander?.phase==='withdrawing'||m.works.filter(w=>polylineLength(state.trenches.find(t=>t.id===w.trenchId)?.points??[])<65).length>=2)return;
  // A connected rear/flank extension, useful even without privileged enemy
  // coordinates. Leave existing weapon crews and active support works alone.
  const builder=own.filter(q=>!home.squadIds.includes(q.id)&&q.order.type==='hold'&&squadHasEquipment(state,q,'tools')&&!reservedConstructionTeam(state,q.id)&&distance(q,g.entrance)<220).sort((a,b)=>distance(a,g.entrance)-distance(b,g.entrance)||a.id-b.id)[0];
  if(!builder)return;
  const start=trench.points[m.works.length===1?0:trench.points.length-1];
  const points=[start,{x:start.x+r.front.forward.x*16,z:start.z+r.front.forward.z*16},{x:start.x+r.front.forward.x*30+r.front.right.x*(m.works.length===1?-18:18),z:start.z+r.front.forward.z*30+r.front.right.z*(m.works.length===1?-18:18)}];
  if(!safeWork(points,terrain,reports,state.elapsed))return;
  const id=commands.create(points,builder.id);if(id!==undefined)m.works.push({side:'enemy',trenchId:id,squadIds:[builder.id],stage:'building'});
}
/** Broad construction intent from our own force and delivered reports only.
 * Two formations must actually establish themselves forward before another
 * line is considered. A flank scout alone cannot drag all engineers forward. */
export function forwardWorkIntent(state:BattlefieldState,trenchId:number):Vec2|undefined {
  const r=state.operation?.runtime,t=state.trenches.find(t=>t.id===trenchId);if(!r?.openFront||!t||state.elapsed<240)return;
  const center=t.points[Math.floor(t.points.length/2)],depth=frontDepth(r.front,center),reports=(state.operation!.intelligence?.command.enemy??[]).filter(c=>c.active&&state.elapsed-c.lastSeen<30);
  if(!reports.length)return;
  const teams=state.squads.filter(q=>q.faction==='enemy'&&!reservedConstructionTeam(state,q.id)&&!q.order.building&&state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life==='active'&&s.needs.energy>35&&s.suppression<60).length>=4);
  if(teams.length<2)return;
  const established=teams.filter(q=>frontDepth(r.front,q)<depth-160);
  const retreat=r.commander?.phase==='withdrawing'&&reports.some(c=>distance(c,center)<140);
  if(!retreat&&established.length<2)return;
  const holders=retreat?teams:established,sorted=holders.map(q=>frontDepth(r.front,q)).sort((a,b)=>a-b),middle=sorted[Math.floor(sorted.length/2)];
  const nextDepth=Math.max(-850,Math.min(850,retreat?depth+170:middle+55)),lateral=Math.max(-400,Math.min(400,holders.reduce((n,q)=>n+(q.x-r.front.origin.x)*r.front.right.x+(q.z-r.front.origin.z)*r.front.right.z,0)/holders.length));
  return Math.abs(nextDepth-depth)>=120?atDepth(r.front,nextDepth,lateral):undefined;
}
function safeWork(points:Vec2[],terrain:TerrainSystem,reports:{x:number;z:number;lastSeen:number;active:boolean}[],at:number):boolean {
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.ceil(distance(a,b)/2);
    for(let j=0;j<=n;j++){const p={x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n};
      if(terrain.obstacleAt(p.x,p.z,5)||terrain.distanceToRoad(p.x,p.z)<12||terrain.groundTypeAt(p.x,p.z)==='river'||reports.some(c=>c.active&&at-c.lastSeen<20&&distance(c,p)<60))return false;
    }
  }return true;
}
