import {distance,type BattlefieldState,type SoldierState,type SquadState,type Vec2} from '../core/types';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import type {FormationWalker} from '../navigation/FormationWalker';
import type {GarrisonSystem} from '../garrison/GarrisonSystem';
import {ownsAction} from '../combat/Reactions';
import {squadContacts} from './Visibility';
import {knownTrenchNetworks,type KnownTrenchNetwork} from './TrenchIntelligence';
import type {PreparedOrder} from './PreparedOrders';

export interface RaidMember {id:number;entry:Vec2;entered:boolean;route:Vec2[];index:number;cell?:number;retryAt:number}
export interface TrenchRaid {
  phase:'wait'|'approach'|'entry'|'clearing'|'secured'|'regrouping'|'failed';
  entry:Vec2;home:Vec2;startingAble:number;members:RaidMember[];
  cleared:number[];nextReview:number;reason:string;securedAt?:number;
}
/** Ownership validation may inspect the physical extent, but returns no hidden
 * layout or occupants to the route planner. */
export function raidSearchComplete(state:BattlefieldState,network:TrenchNetwork,id:number):boolean{
  const component=network.component(id),group=state.preparedOrders?.filter(o=>o.raid&&o.networkId!==undefined&&network.component(o.networkId)===component)??[];
  if(!group.length)return true;
  const searched=new Set(group.flatMap(o=>o.raid!.cleared));
  const points=(state.terrainKnowledge?.sections??[]).filter(s=>s.side==='player'&&searched.has(s.id)).map(mid);
  return component!==undefined&&network.samples(component,6).every(p=>points.some(v=>distance(v,p)<5));
}
const active=(state:BattlefieldState,id:number)=>state.soldiers.filter(s=>s.squadId===id&&s.needs?.life==='active');
const mid=(s:KnownTrenchNetwork['sections'][number]):Vec2=>({x:(s.points[0].x+s.points[1].x)/2,z:(s.points[0].z+s.points[1].z)/2});
export function prepareRaid(state:BattlefieldState,q:SquadState,known:KnownTrenchNetwork,index:number,count:number,reserved:Vec2[]=[]):TrenchRaid{
  const dx=known.point.x-q.x,dz=known.point.z-q.z;
  const sections=[...known.sections].sort((a,b)=>{const p=mid(a),v=mid(b);return p.x*dz-p.z*dx-(v.x*dz-v.z*dx)||a.id-b.id;});
  const preferred=mid(sections[Math.min(sections.length-1,Math.floor((index+.5)/count*sections.length))]);
  // Preparing formations in separate clicks must not give every squad the same
  // central entry. Existing WAIT lanes remain stable when another joins.
  const entry=sections.map(mid).filter(p=>reserved.every(other=>distance(p,other)>=12)).sort((a,b)=>distance(a,preferred)-distance(b,preferred))[0]??preferred;
  return {phase:'wait',entry,home:{x:q.x,z:q.z},startingAble:active(state,q.id).length,members:[],cleared:[],nextReview:state.elapsed,reason:'WAIT FOR SIGNAL · staged at current position'};
}
/** Uses remembered geometry to choose routes. Live opponents are consulted only
 * by the ordinary capture validator, never to select a clearing destination. */
export class TrenchRaidSystem {
  private graph=new TrenchNetwork();
  private knowledgeKey='';
  private routeTick=-1;
  private entryPlans=0;
  constructor(private navigation:SquadNavigation,private walker:FormationWalker){}
  private knownGraph(known:KnownTrenchNetwork):TrenchNetwork{
    const key=known.sections.map(s=>`${s.id}:${s.points[0].x},${s.points[0].z}:${s.points[1].x},${s.points[1].z}`).join('|');
    if(key!==this.knowledgeKey){this.knowledgeKey=key;this.graph.sync(known.sections.map(s=>({id:s.id,points:s.points,width:s.width,depth:1,progress:1,status:'complete'})));}
    return this.graph;
  }
  step(state:BattlefieldState,q:SquadState,people:SoldierState[],dt:number):boolean{
    if(this.routeTick!==state.elapsed){this.routeTick=state.elapsed;this.entryPlans=0;}
    const order=state.preparedOrders?.find(o=>o.squadId===q.id&&o.releasedAt!==undefined&&o.raid),r=order?.raid;
    if(!order||!r||r.phase==='secured'||r.phase==='failed')return false;
    if(r.phase==='regrouping'){
      q.orderNote=r.reason='ASSAULT FAILED — FORMATION REGROUPING';
      if(people.every(s=>distance(s,r.home)<15)){r.phase='failed';r.reason='ASSAULT FAILED — REGROUPED · rest/resupply before preparing again';q.order={type:'hold',issuedAt:state.elapsed};q.route=[];}
      return false;
    }
    const able=people.filter(s=>s.needs?.life==='active'),broken=able.filter(s=>s.combat?.reaction==='broken').length;
    if(state.elapsed-order.releasedAt!>15&&(able.length<Math.max(2,r.startingAble*.45)||broken>able.length*.6||able.every(s=>(s.carried?.ammo??s.ammunition)<2))){
      r.phase='regrouping';r.reason='ASSAULT FAILED — FORMATION REGROUPING';q.orderNote=r.reason;
      q.order={type:'move',intent:'fall-back',target:{...r.home},issuedAt:state.elapsed};q.route=this.navigation.plan(q,r.home);q.routeIndex=0;
      for(const s of people)delete s.formationTravel;
      return true;
    }
    const known=knownTrenchNetworks(state).find(n=>n.id===order.networkId);
    if(!known){q.orderNote='Raid objective no longer reported · order retained';return true;}
    if(r.phase==='approach'){
      q.orderNote='ASSAULT · approaching assigned entry';
      if(!able.some(s=>distance(s,r.entry)<10))return false;
      r.phase='entry';
    }
    const graph=this.knownGraph(known),entryHit=graph.nearest(r.entry),component=entryHit&&graph.nodes[graph.edges[entryHit.edge].a].component;
    if(component===undefined)return true;
    const group=(state.preparedOrders??[]).filter(o=>o.networkId===order.networkId&&o.releasedAt!==undefined&&o.raid&&!['failed','regrouping'].includes(o.raid.phase));
    const live=new Set(state.soldiers.filter(s=>s.needs?.life==='active').map(s=>s.id));
    const cleared=new Set(group.flatMap(o=>o.raid!.cleared)),claimed=new Set(group.flatMap(o=>o.raid!.members.filter(m=>live.has(m.id)).map(m=>m.cell)));
    const contacts=squadContacts(state,q.id).filter(c=>c.active&&c.visible);
    // A confirmed counterattack reopens that passage. A remembered contact or
    // unseen live defender never supplies a destination to this planner.
    const contested=known.sections.filter(s=>contacts.some(c=>distance(c,mid(s))<9)).map(s=>s.id);
    for(const id of contested){cleared.delete(id);for(const o of group)o.raid!.cleared=o.raid!.cleared.filter(v=>v!==id);}
    for(const [i,s] of able.entries()){
      let m=r.members.find(m=>m.id===s.id);
      if(!m){
        const options=known.sections.map(v=>mid(v)).filter(p=>distance(p,r.entry)<24).sort((a,b)=>distance(a,r.entry)-distance(b,r.entry)||a.x-b.x||a.z-b.z);
        const entry=options[i%Math.max(1,options.length)]??r.entry;
        m={id:s.id,entry:{...entry},entered:false,route:[],index:0,retryAt:0};r.members.push(m);
      }
      if(!ownsAction(s,'order'))continue;
      const nearest=graph.nearest(s,component),inside=nearest&&nearest.distance<graph.edges[nearest.edge].width*.4;
      if(!m.entered&&inside){m.entered=true;m.route=[];m.index=0;r.phase='clearing';}
      if(m.entered&&!inside){m.entered=false;m.route=[];m.index=0;} // a reaction/errand physically left the passage
      if(m.index<m.route.length&&distance(s,m.route[m.index])<.65)m.index++;
      if(m.index>=m.route.length){m.route=[];m.index=0;}
      if(m.entered){
        for(const section of known.sections){if(!cleared.has(section.id)&&distance(s,mid(section))<4.5&&!contacts.some(c=>distance(c,mid(section))<9)){r.cleared.push(section.id);cleared.add(section.id);}}
        if(m.cell!==undefined&&cleared.has(m.cell)){m.cell=undefined;m.route=[];m.index=0;}
        if(!m.route.length&&state.elapsed>=m.retryAt){
          m.retryAt=state.elapsed+2+(s.id%5)*.1;
          const choices=known.sections.filter(v=>!cleared.has(v.id)&&!claimed.has(v.id)&&graph.component(v.id)===component).sort((a,b)=>distance(s,mid(a))-distance(s,mid(b))||a.id-b.id);
          const next=choices[0];
          if(next){m.cell=next.id;claimed.add(next.id);m.route=graph.route(s,mid(next),component);m.index=0;}
        }
      }else if(!m.route.length&&state.elapsed>=m.retryAt&&this.entryPlans<2){
        this.entryPlans++;
        m.retryAt=state.elapsed+8+(s.id%5)*.2;m.route=this.navigation.plan(s,m.entry,undefined,true,3000);m.index=0;
      }
      const target=m.route[m.index];
      if(target){this.walker.walk(s,target,dt,m.entered?graph:undefined);if(s.action==='advancing')s.action=m.entered?'walking trench assault':'approaching entrance';}
      else s.action=m.entered?'covering cleared passage':'waiting for entry route';
    }
    q.movementState='moving';q.orderNote=r.reason=r.phase==='entry'?'ASSAULT · entering trench':`CLEARING · ${cleared.size}/${known.sections.length} observed sections searched`;
    return true;
  }
  secure(state:BattlefieldState,garrisons:GarrisonSystem):void{
    const checked=new Set<number>();
    for(const o of state.preparedOrders??[]){const r=o.raid;if(!r||r.phase!=='clearing'||o.networkId===undefined||checked.has(o.networkId)||state.elapsed<r.nextReview)continue;
      r.nextReview=state.elapsed+2;checked.add(o.networkId);
      const group=state.preparedOrders!.filter(p=>p.networkId===o.networkId&&p.raid&&['approach','entry','clearing'].includes(p.raid.phase)),known=knownTrenchNetworks(state).find(n=>n.id===o.networkId);
      if(!known)continue;
      const cleared=new Set(group.flatMap(p=>p.raid!.cleared));if(known.sections.some(s=>!cleared.has(s.id)))continue;
      // This is an ownership gate, not planner knowledge. Unseen/unsearched
      // branches cannot be captured remotely by touching the first entry.
      if(!raidSearchComplete(state,garrisons.network,o.networkId)){r.reason='Known passages searched · more reconnaissance required';continue;}
      const ids=group.map(p=>p.squadId);
      if(garrisons.assign(ids,o.networkId))for(const p of group){p.raid!.phase='secured';p.raid!.securedAt=state.elapsed;p.raid!.reason='POSITION SECURED · reorganizing defense';const q=state.squads.find(q=>q.id===p.squadId);if(q)q.orderNote=p.raid!.reason;}
      else r.reason=garrisons.lastAssignment.reason;
    }
  }
}
export function validRaid(state:BattlefieldState,o:PreparedOrder):boolean{
  const r=o.raid;if(!r)return true;
  const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
  const point=(p:Vec2)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=2000&&Math.abs(p.z)<=2000;
  return o.intent==='assault'&&o.networkId!==undefined&&['wait','approach','entry','clearing','secured','regrouping','failed'].includes(r.phase)&&(r.phase==='wait'?o.releasedAt===undefined:o.releasedAt!==undefined)&&point(r.entry)&&point(r.home)&&Number.isInteger(r.startingAble)&&r.startingAble>0&&finite(r.nextReview)&&typeof r.reason==='string'&&Array.isArray(r.cleared)&&r.cleared.length<50000&&r.cleared.every(id=>Number.isInteger(id)&&id>0)&&Array.isArray(r.members)&&r.members.length<=state.squads.find(q=>q.id===o.squadId)!.soldierIds.length&&r.members.every(m=>m&&typeof m==='object')&&new Set(r.members.map(m=>m.id)).size===r.members.length&&r.members.every(m=>state.soldiers.some(s=>s.id===m.id&&s.squadId===o.squadId)&&point(m.entry)&&typeof m.entered==='boolean'&&Array.isArray(m.route)&&m.route.length<=8192&&m.route.every(point)&&Number.isInteger(m.index)&&m.index>=0&&m.index<=m.route.length&&finite(m.retryAt)&&(m.cell===undefined||Number.isInteger(m.cell)&&m.cell>0))&&(r.securedAt===undefined||finite(r.securedAt)&&r.securedAt<=state.elapsed);
}
