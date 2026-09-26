import type {BattlefieldState} from '../core/types';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {AsyncSquadPlanner} from '../navigation/AsyncSquadPlanner';

export type SessionKind='player'|'attract'|'editor-test';
/** An owned simulation lifetime. The render host survives world changes, the simulation does not. */
export class WorldSession {
 private static serial=0;
 static readonly ownership={created:0,disposed:0,active:0,planners:0};
 readonly generation=++WorldSession.serial;
 readonly simulation:BattlefieldSimulation;
 readonly lifetime=new AbortController();
 private planner?:AsyncSquadPlanner;
 private closed=false;
 constructor(readonly kind:SessionKind,readonly state:BattlefieldState,asyncNavigation=typeof Worker!=='undefined'){
  this.simulation=new BattlefieldSimulation(state);WorldSession.ownership.created++;WorldSession.ownership.active++;
  if(asyncNavigation){this.planner=new AsyncSquadPlanner();WorldSession.ownership.planners++;const generation=this.generation;
   this.simulation.scheduleNavigation=(start,goal,done)=>this.planner?.plan(start,goal,state,route=>{if(!this.closed&&this.generation===generation)done(route);});}
 }
 get disposed():boolean{return this.closed;}
 step():void{if(!this.closed)this.simulation.stepFixed();}
 save<T>(write:(state:BattlefieldState)=>T):T{if(this.closed||this.kind!=='player')throw new Error('Only an active player session can save a campaign');return write(this.state);}
 dispose():void{if(this.closed)return;this.closed=true;this.lifetime.abort();this.simulation.scheduleNavigation=undefined;if(this.planner){this.planner.dispose();this.planner=undefined;WorldSession.ownership.planners--;}WorldSession.ownership.disposed++;WorldSession.ownership.active--;}
}

/** Stable, narrow adapter for persistent camera/UI consumers. Methods bind to the current owner. */
export function simulationPort(current:()=>BattlefieldSimulation):BattlefieldSimulation{
 const ports=new Set(['terrain','trenches','navigation','garrisons','engineers','operations','network','logistics']);
 const proxy=(get:()=>any):any=>{const nested=new Map<PropertyKey,unknown>();return new Proxy({}, {
  get:(_,key)=>{const target=get(),value=target[key];if(typeof value==='function')return (...args:unknown[])=>get()[key](...args);
   if(ports.has(String(key))&&value&&typeof value==='object'){if(!nested.has(key))nested.set(key,proxy(()=>get()[key]));return nested.get(key);}return value;},
  set:(_,key,value)=>{get()[key]=value;return true;},
 });};
 return proxy(current);
}
