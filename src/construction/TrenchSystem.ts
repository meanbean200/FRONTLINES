import {
  type BattlefieldState,
  type TrenchState,
  type Vec2,
  type ConstructionRequest,
  type ConstructionJob,
  distance,
  polylineLength,
} from '../core/types';
import {simplifyRoute} from '../core/Polyline';
import { inventory } from '../garrison/types';
import {atDistance} from '../core/Polyline';
import {excavatedSpan} from '../core/TrenchGeometry';
import {SUPPORT_WORKS} from './ConstructionReadout';

export const METRES_PER_PERSON=2.5;
export const ENTRANCE_LENGTH=5;
export function trenchCapacity(trench:TrenchState):number {
  return Math.max(0,Math.floor((polylineLength(trench.points)*trench.progress-ENTRANCE_LENGTH-1)/METRES_PER_PERSON));
}

export class TrenchSystem {
  constructor(private state: BattlefieldState) {}

  setState(state: BattlefieldState): void {
    this.state = state;
  }

  request(request:ConstructionRequest):number|undefined {
    if(request.kind==='trench')return this.create(request.points,request.engineerSquadId).id;
    const w=this.state.living,g=w?.garrisons.find(g=>g.id===request.garrisonId);
    const engineers=this.state.squads.filter(q=>q.kind==='engineer'&&g?.squadIds.includes(q.id)&&q.order.type==='occupy-trench');
    if(!w||!g||!engineers.length||distance(request.origin,request.position)>40)return;
    const connector=this.create([request.origin,request.position]);connector.width=7.2;connector.progress=.001;connector.status='building';
    const kind=request.facilityKind,id=this.state.nextEntityId++;
    w.facilities.push({id,...request.position,garrisonId:g.id,kind,facing:g.front,connectorId:connector.id,progress:0,capacity:kind==='rest'?8:kind==='meal'?6:kind==='aid'?4:kind==='emplacement'?3:20,paid:false,stock:inventory(),materialCost:SUPPORT_WORKS[kind].cost});
    for(const q of engineers)(q.constructionQueue??=[]).push({kind:'facility',id});
    return id;
  }

  /** Shared work application for both main earthworks and supplied support jobs. */
  applyWork(job:ConstructionJob,seconds:number,rate:number):void {
    if(job.kind==='trench'){
      const t=this.state.trenches.find(t=>t.id===job.id);if(!t)return;
      if(t.excavation)this.applyFrontWork(t,1,seconds*rate);
      else {t.progress=Math.min(1,t.progress+seconds*rate/Math.max(1,polylineLength(t.points)));if(t.progress===1)t.status='complete';}
    }else{
      const f=this.state.living?.facilities.find(f=>f.id===job.id);if(!f?.paid||f.progress===1)return;
      const t=this.state.trenches.find(t=>t.id===f.connectorId);if(!t)return;
      if(t.progress<1)this.applyWork({kind:'trench',id:t.id},seconds,rate*.2);
      else f.progress=Math.min(1,f.progress+seconds*rate/90);
      if(f.progress===1)for(const q of this.state.squads)q.constructionQueue=q.constructionQueue?.filter(j=>typeof j==='number'||j.kind!=='facility'||j.id!==f.id);
    }
  }

  create(points: Vec2[], engineerSquadId?: number): TrenchState {
    const smoothed = smoothRoute(simplifyRoute(points));
    const trench: TrenchState = {
      id: this.state.nextEntityId++,
      points: smoothed,
      progress: 0,
      status: engineerSquadId ? 'building' : 'planned',
      width: 4.2,
      depth: 1.75,
      engineerSquadId,
    };
    this.state.trenches.push(trench);
    return trench;
  }

  update(dt: number): void {
    for (const trench of this.state.trenches) {
      if (trench.status !== 'building' || !trench.engineerSquadId) continue;
      const engineer = this.state.squads.find((squad) => squad.id === trench.engineerSquadId && squad.kind === 'engineer');
      if(engineer?.engineerWork)continue; // Crew fronts apply only physically completed work.
      if (!engineer || engineer.order.type !== 'construct-trench' || engineer.order.trenchId !== trench.id) continue;
      const head = this.constructionHead(trench);
      if (!engineer.workStarted) continue;
      const crew=this.state.soldiers.filter(s=>s.squadId===engineer.id);
      const workers=crew.filter(s=>(!s.needs||s.needs.life==='active')&&distance(s,head)<9).length;
      if(workers<Math.min(3,crew.length))continue;
      this.applyWork({kind:'trench',id:trench.id},dt,1.6);
      if (trench.progress >= 1) {
        trench.status = 'complete';
        engineer.order = { type: 'hold', issuedAt: this.state.elapsed };
        engineer.movementState = 'idle';
        engineer.route=[];engineer.routeIndex=0;
      }
    }
  }

  assignEngineer(trenchId: number, squadId: number): boolean {
    const trench = this.state.trenches.find((item) => item.id === trenchId);
    const squad = this.state.squads.find((item) => item.id === squadId && item.kind === 'engineer');
    if (!trench || !squad || trench.status === 'complete') return false;
    trench.engineerSquadId = squadId;
    trench.status = 'building';
    squad.order = { type: 'construct-trench', trenchId, issuedAt: this.state.elapsed };
    squad.movementState = 'digging';
    return true;
  }

  constructionHead(trench: TrenchState): Vec2 {
    return atDistance(trench.points,excavatedSpan(trench).end);
  }

  applyFrontWork(t:TrenchState,direction:-1|1,metres:number):void {
    if(!t.excavation||metres<=0)return;
    const length=polylineLength(t.points),span=t.excavation;
    if(direction<0)span.start=Math.max(0,span.start-metres);else span.end=Math.min(length,span.end+metres);
    t.progress=Math.min(1,(span.end-span.start)/length);
    if(span.start<.000001&&length-span.end<.000001){span.start=0;span.end=length;t.progress=1;t.status='complete';}
  }

  capacity(trench:TrenchState):number {return trenchCapacity(trench);}

  used(trench:TrenchState):number {return this.state.soldiers.filter(s=>s.trenchId===trench.id).length;}

  distribute(trench:TrenchState):void {
    const people=this.state.soldiers.filter(s=>s.trenchId===trench.id).sort((a,b)=>a.id-b.id);
    const length=Math.max(0,polylineLength(trench.points)*trench.progress-ENTRANCE_LENGTH-1);
    people.forEach((soldier,i)=>{soldier.trenchAlong=excavatedSpan(trench).start+ENTRANCE_LENGTH+(i+.5)*length/people.length;delete soldier.trenchSlot;});
  }

  nearestUsable(point: Vec2,people=1,excludedSquads:number[]=[]): TrenchState | undefined {
    let nearest: TrenchState | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const trench of this.state.trenches) {
      const reserved=this.state.soldiers.filter(s=>s.trenchId===trench.id&&!excludedSquads.includes(s.squadId)).length;
      if (this.capacity(trench)-reserved<people) continue;
      for (const candidate of trench.points) {
        const d = distance(point, candidate);
        if (d < nearestDistance) {
          nearest = trench;
          nearestDistance = d;
        }
      }
    }
    return nearest;
  }
}

function smoothRoute(points: Vec2[]): Vec2[] {
  if (points.length < 3) return points.map((point) => ({ ...point }));
  let route = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < 2; pass += 1) {
    const next: Vec2[] = [{ ...route[0] }];
    for (let i = 0; i < route.length - 1; i += 1) {
      const a = route[i];
      const b = route[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    next.push({ ...route.at(-1)! });
    route = next;
  }
  return route;
}
