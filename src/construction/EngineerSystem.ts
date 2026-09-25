import {distance,distanceToSegment,polylineLength,type BattlefieldState,type EngineerCrew,type SoldierState,type SquadState,type TrenchState,type Vec2} from '../core/types';
import {atDistance,routeMetrics} from '../core/Polyline';
import {excavatedPoints,excavatedSpan} from '../core/TrenchGeometry';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import type {TrenchSystem} from './TrenchSystem';
import {hasEquipment,squadHasEquipment} from '../combat/Equipment';

type Move=(soldier:SoldierState,target:Vec2,dt:number,action:string)=>void;
type Front={trench:TrenchState;direction:-1|1;point:Vec2};
const jobId=(job:number|{kind:string;id:number})=>typeof job==='number'?job:job.kind==='trench'?job.id:undefined;
const mean=(people:SoldierState[]):Vec2=>({x:people.reduce((n,s)=>n+s.x,0)/people.length,z:people.reduce((n,s)=>n+s.z,0)/people.length});

/** Small stable work parties; no excavation without a fit engineer at the working face. */
export class EngineerSystem {
  private production=new Map<string,{trench:TrenchState;direction:-1|1;diggers:SoldierState[];helpers:SoldierState[]}>();
  beginFrame():void {this.production.clear();}
  finishFrame(dt:number):void {
    for(const face of this.production.values()){
      const diggers=face.diggers.length,helpers=face.helpers.length;
      for(const s of face.helpers)s.action=diggers?'clearing spoil':'waiting for tool crew';
      if(!diggers)continue;
      // A face has finite useful space. Extra hands help, but cannot multiply
      // cutting speed indefinitely or produce earthworks from a distant queue.
      const effort=Math.min(4,diggers)+Math.min(7,helpers)*.5+Math.min(4,Math.max(0,diggers-4))*.25;
      this.trenches.applyFrontWork(face.trench,face.direction,dt*.2*effort);
    }
  }
  constructor(private state:BattlefieldState,private navigation:SquadNavigation,private trenches:TrenchSystem){}
  replaceState(state:BattlefieldState):void {this.state=state;}

  initialize(t:TrenchState,from:Vec2,sources=this.state.trenches):void {
    if(t.excavation)return;
    const length=polylineLength(t.points);
    // Existing saves retain every metre already excavated; never relocate old work.
    if(t.progress>0){t.excavation={start:0,end:length*t.progress,origin:0};return;}
    const origin=this.connection(t,sources,from)??length/2;
    t.excavation={start:origin,end:origin,origin};
  }

  start(squad:SquadState,trench:TrenchState):boolean {
    const project=this.state.squads.find(q=>q.order.type==='construct-trench'&&(q.order.trenchId===trench.id||q.engineerWork?.projectTrenches?.includes(trench.id)));
    const equipped=project&&this.state.squads.some(q=>q.order.type==='construct-trench'&&(q===project||q.engineerWork?.projectId===project.engineerWork?.projectId)&&squadHasEquipment(this.state,q,'tools'));
    if(!squadHasEquipment(this.state,squad,'tools')&&!equipped)return false;
    this.initialize(trench,squad);
    let route:Vec2[]=[];
    for(const point of this.workFaces(trench,squad)){route=this.navigation.plan(squad,point);if(route.length)break;}
    if(!route.length)return false;
    const owner=this.state.squads.find(q=>q.id===trench.engineerSquadId&&q.order.type==='construct-trench'&&q.order.trenchId===trench.id);
    if(!owner)this.trenches.assignEngineer(trench.id,squad.id);
    else {squad.order={type:'construct-trench',trenchId:trench.id,issuedAt:this.state.elapsed};squad.movementState='digging';}
    squad.engineerWork={version:1,nextReview:0,crews:[],projectId:project?.engineerWork?.projectId??trench.id,projectTrenches:[...new Set([trench.id,...(project?.engineerWork?.projectTrenches??[]),...(project?.constructionQueue??[]).map(jobId).filter((id):id is number=>id!==undefined)])]};
    squad.route=route;squad.routeIndex=0;squad.workStarted=false;squad.formationHeading=undefined;squad.orderNote=undefined;
    return true;
  }

  /** Read-only candidates: Resume must compare both unfinished faces, not a remote finished end. */
  workFaces(t:TrenchState,from:Vec2):Vec2[] {
    if(t.status==='complete')return [];
    const length=polylineLength(t.points);
    if(!t.excavation&&t.progress===0)return [atDistance(t.points,this.connection(t,this.state.trenches,from)??length/2)];
    const span=excavatedSpan(t),points:Vec2[]=[];
    if(span.start>.000001)points.push(atDistance(t.points,span.start));
    if(length-span.end>.000001)points.push(atDistance(t.points,span.end));
    return points.sort((a,b)=>distance(from,a)-distance(from,b));
  }

  step(squad:SquadState,people:SoldierState[],dt:number,move:Move):void {
    people=people.filter(s=>s.health>0&&(!s.needs||s.needs.life==='active'));
    const work=squad.engineerWork??(squad.engineerWork={version:1,nextReview:0,crews:[]});work.projectId??=squad.order.trenchId;
    const partners=this.state.squads.filter(q=>q.order.type==='construct-trench'&&(q===squad||q.engineerWork?.projectId===work.projectId));
    const hasTools=people.some(s=>hasEquipment(this.state,s,'tools'))||partners.some(q=>q!==squad&&squadHasEquipment(this.state,q,'tools'));
    if(!hasTools){
      for(const s of people)if(!s.combat?.owner||s.combat.owner==='order')s.action='waiting for tool crew';
      squad.workStarted=false;squad.orderNote='No available construction tools';return;
    }
    const ids=new Set(partners.flatMap(q=>[q.order.trenchId,...(q.constructionQueue??[]).map(jobId),...(q.engineerWork?.projectTrenches??[])]).filter((id):id is number=>id!==undefined));
    const projectTrenches=[...ids];for(const q of partners)if(q.engineerWork)q.engineerWork.projectTrenches=projectTrenches;
    const jobs=this.state.trenches.filter(t=>ids.has(t.id));
    const unfinished=jobs.filter(t=>t.status!=='complete');
    if(!unfinished.length){
      squad.constructionQueue=squad.constructionQueue?.filter(j=>jobId(j)===undefined);
      squad.order={type:'hold',issuedAt:this.state.elapsed};squad.route=[];squad.routeIndex=0;squad.movementState='idle';
      delete squad.engineerWork;squad.workStarted=false;squad.orderNote=undefined;return;
    }
    // Legacy active jobs acquire a prefix interval without changing their terrain.
    const primary=jobs.find(t=>t.id===squad.order.trenchId)!;
    if(primary.status!=='complete')this.initialize(primary,squad);
    if(this.state.elapsed>=work.nextReview||!work.crews.length){
      work.nextReview=this.state.elapsed+2;
      let active=unfinished.filter(t=>t.excavation&&t.status==='building');
      if(!active.length){
        const next=unfinished[0];this.initialize(next,squad);next.status='building';next.engineerSquadId=squad.id;active=[next];
      }
      // Queue siblings join at a completed junction, not at an arbitrary distant end.
      for(const t of unfinished.filter(t=>!active.includes(t))){
        const junction=this.connection(t,this.state.trenches,squad);
        if(junction===undefined)continue;
        if(!t.excavation)t.excavation=t.progress>0?{start:0,end:polylineLength(t.points)*t.progress,origin:0}:{start:junction,end:junction,origin:junction};
        t.status='building';t.engineerSquadId=squad.id;active.push(t);
      }
      const fronts:Front[]=active.flatMap(t=>{
        const span=excavatedSpan(t),list:Front[]=[];
        if(span.start>.000001)list.push({trench:t,direction:-1,point:atDistance(t.points,span.start)});
        if(polylineLength(t.points)-span.end>.000001)list.push({trench:t,direction:1,point:atDistance(t.points,span.end)});
        return list;
      });
      this.assign(work.crews,people,fronts);
      // Keep a meaningful primary progress bar as earlier arms finish.
      if(primary.status==='complete'){
        const next=active[0];squad.order.trenchId=next.id;
        squad.constructionQueue=(squad.constructionQueue??[]).filter(j=>jobId(j)!==next.id&&jobs.find(t=>t.id===jobId(j))?.status!=='complete');
      }
    }
    let digging=0,helping=0;
    const loads=new Map<string,number>();
    for(const crew of work.crews){
      const team=crew.soldierIds.map(id=>people.find(s=>s.id===id)).filter((s):s is SoldierState=>!!s),t=jobs.find(t=>t.id===crew.trenchId);
      if(!team.length||!t?.excavation||t.status==='complete')continue;
      const available=team.filter(s=>!s.combat?.owner||s.combat.owner==='order');if(!available.length)continue;
      const span=excavatedSpan(t),along=crew.direction<0?span.start:span.end,head=atDistance(t.points,along),center=mean(available);
      if(!crew.approached){
        const waypoint=crew.route[crew.routeIndex]??head;
        if(distance(center,waypoint)<2.5){
          if(crew.routeIndex<crew.route.length-1)crew.routeIndex++;
          else crew.approached=true;
        }
        if(!crew.approached){
          const target=crew.route[crew.routeIndex]??head,angle=Math.atan2(target.x-center.x,target.z-center.z);
          team.forEach((s,i)=>move(s,{x:target.x+Math.cos(angle)*(i?-.65:.65),z:target.z-Math.sin(angle)*(i?-.65:.65)},dt,'moving to work front'));
          continue;
        }
      }
      const key=`${t.id}:${crew.direction}`,otherRows=this.state.squads.filter(q=>q.id<squad.id&&q.order.type==='construct-trench').flatMap(q=>q.engineerWork?.crews??[]).filter(c=>c.trenchId===t.id&&c.direction===crew.direction).length;
      const row=(loads.get(key)??0)+otherRows;loads.set(key,(loads.get(key)??0)+1);
      if(row>=4){for(const s of available)s.action='waiting for work-face space';continue;}
      const targetAlong=Math.max(span.start,Math.min(span.end,along-crew.direction*(.65+row*1.25)));
      const p=atDistance(t.points,targetAlong),a=atDistance(t.points,Math.max(0,targetAlong-.25)),b=atDistance(t.points,Math.min(polylineLength(t.points),targetAlong+.25));
      const heading=Math.atan2(b.x-a.x,b.z-a.z);
      const workFace=this.production.get(key)??{trench:t,direction:crew.direction,diggers:[],helpers:[]};this.production.set(key,workFace);
      team.forEach((s,i)=>{
        const side=i?-.65:.65,target={x:p.x+Math.cos(heading)*side,z:p.z-Math.sin(heading)*side};
        if(s.combat?.owner&&s.combat.owner!=='order')return;
        if(s.suppression>=65){s.action='taking cover';return;}
        move(s,target,dt,'moving along work front');
        if(distance(s,target)<.8){
          s.heading=heading+(crew.direction<0?Math.PI:0);
          if(hasEquipment(this.state,s,'tools')){s.action='digging';workFace.diggers.push(s);digging++;}
          else {workFace.helpers.push(s);helping++;}
        }
      });
    }
    // Tool carriers cut the face; the rest of the detail clear spoil. Helpers
    // cannot excavate an unattended face or conjure extra tools. Count only
    // physically present, unsuppressed people, once per fixed step.
    squad.workStarted=digging>0;squad.movementState=digging?'digging':'moving';
    const liveFronts=new Set(work.crews.filter(c=>jobs.some(t=>t.id===c.trenchId&&t.status!=='complete')).map(c=>`${c.trenchId}:${c.direction}`)).size;
    squad.orderNote=`${digging} digging · ${helping} clearing spoil · ${liveFronts} work fronts · ${unfinished.length} trench${unfinished.length===1?'':'es'}`;
  }

  private assign(crews:EngineerCrew[],people:SoldierState[],fronts:Front[]):void {
    const key=(c:{trenchId:number;direction:number})=>`${c.trenchId}:${c.direction}`;
    const valid=new Set(fronts.map(f=>`${f.trench.id}:${f.direction}`)),used=new Set<number>();
    for(const c of crews){c.soldierIds=c.soldierIds.filter(id=>people.some(s=>s.id===id)&&!used.has(id));c.soldierIds.forEach(id=>used.add(id));}
    const waiting=people.filter(s=>!used.has(s.id)),tools=waiting.filter(s=>hasEquipment(this.state,s,'tools')),helpers=waiting.filter(s=>!hasEquipment(this.state,s,'tools'));
    while(tools.length||helpers.length){
      const first=tools.shift()??helpers.shift()!,second=helpers.shift()??tools.shift();
      crews.push({soldierIds:[first.id,...(second?[second.id]:[])],trenchId:0,direction:1,route:[],routeIndex:0,approached:false});
    }
    for(let i=crews.length-1;i>=0;i--)if(!crews[i].soldierIds.length)crews.splice(i,1);
    const count=(f:Front)=>crews.filter(c=>valid.has(key(c))&&c.trenchId===f.trench.id&&c.direction===f.direction).length;
    const toolCrew=(c:EngineerCrew)=>c.soldierIds.some(id=>people.some(s=>s.id===id&&hasEquipment(this.state,s,'tools')));
    const foreign=this.state.squads.flatMap(q=>q.engineerWork?.crews??[]).filter(c=>!crews.includes(c));
    const toolCount=(f:Front)=>crews.filter(c=>toolCrew(c)&&key(c)===`${f.trench.id}:${f.direction}`).length+foreign.filter(c=>key(c)===`${f.trench.id}:${f.direction}`&&c.soldierIds.some(id=>this.state.soldiers.some(s=>s.id===id&&s.needs?.life==='active'&&hasEquipment(this.state,s,'tools')))).length;
    const place=(c:EngineerCrew,f:Front):boolean=>{
      const center=mean(c.soldierIds.map(id=>people.find(s=>s.id===id)!));
      const route=distance(center,f.point)<2?[f.point]:this.navigation.plan(center,f.point);
      if(!route.length)return false;
      c.trenchId=f.trench.id;c.direction=f.direction;c.route=route;c.routeIndex=0;c.approached=false;return true;
    };
    // New branches take a spare pair from a doubly staffed front, not the whole squad.
    for(const f of fronts.filter(f=>toolCount(f)===0)){
      const donor=crews.filter(c=>toolCrew(c)&&(!valid.has(key(c))||crews.filter(other=>toolCrew(other)&&key(other)===key(c)).length>1)).sort((a,b)=>distance(mean(a.soldierIds.map(id=>people.find(s=>s.id===id)!)),f.point)-distance(mean(b.soldierIds.map(id=>people.find(s=>s.id===id)!)),f.point))[0];
      if(donor)place(donor,f);
    }
    for(const c of crews.filter(c=>!valid.has(key(c))||!toolCrew(c)&&!fronts.some(f=>key(c)===`${f.trench.id}:${f.direction}`&&toolCount(f)>0))){
      const center=mean(c.soldierIds.map(id=>people.find(s=>s.id===id)!));
      const total=(f:Front)=>count(f)+foreign.filter(c=>key(c)===`${f.trench.id}:${f.direction}`).length;
      for(const f of fronts.filter(f=>(toolCrew(c)||toolCount(f)>0)&&total(f)<4).sort((a,b)=>total(a)-total(b)||distance(center,a.point)-distance(center,b.point)))if(place(c,f))break;
    }
  }

  /** Real segment intersections/near-touching corridors; only the completed part is eligible. */
  private connection(t:TrenchState,sources:TrenchState[],from:Vec2):number|undefined {
    const metrics=routeMetrics(t.points);let best=Infinity,result:number|undefined;
    const consider=(i:number,u:number)=>{const along=metrics.ends[i-1]+(metrics.ends[i]-metrics.ends[i-1])*u,p=atDistance(t.points,along),score=distance(from,p);if(score<best){best=score;result=along;}};
    for(const other of sources){
      if(other===t)continue;const built=excavatedPoints(other,.5),gap=(t.width+other.width)*.4-.6;
      for(let i=1;i<t.points.length;i++)for(let j=1;j<built.length;j++){
        const a=t.points[i-1],b=t.points[i],c=built[j-1],d=built[j];
        if(Math.max(a.x,b.x)+gap<Math.min(c.x,d.x)||Math.min(a.x,b.x)-gap>Math.max(c.x,d.x)||Math.max(a.z,b.z)+gap<Math.min(c.z,d.z)||Math.min(a.z,b.z)-gap>Math.max(c.z,d.z))continue;
        const rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,det=rx*sz-rz*sx;
        if(Math.abs(det)>1e-8){const u=((c.x-a.x)*sz-(c.z-a.z)*sx)/det,v=((c.x-a.x)*rz-(c.z-a.z)*rx)/det;if(u>=0&&u<=1&&v>=0&&v<=1)consider(i,u);}
        for(const p of [c,d]){const hit=distanceToSegment(p,a,b);if(hit.distance<gap)consider(i,hit.t);}
        if(distanceToSegment(a,c,d).distance<gap)consider(i,0);
        if(distanceToSegment(b,c,d).distance<gap)consider(i,1);
      }
    }
    return result;
  }
}
