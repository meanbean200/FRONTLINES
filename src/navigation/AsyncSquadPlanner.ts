import type {BattlefieldState,Vec2} from '../core/types';
import type {RouteRequest,RouteResponse} from './NavigationWorker';

export class AsyncSquadPlanner {
  private worker=new Worker(new URL('./NavigationWorker.ts',import.meta.url),{type:'module'});
  private nextId=1;
  private pending=new Map<number,(route:Vec2[])=>void>();
  private failed=false;
  private closed=false;
  constructor(){
    this.worker.onmessage=(event:MessageEvent<RouteResponse>)=>{if(this.closed)return;const done=this.pending.get(event.data.id);this.pending.delete(event.data.id);done?.(event.data.route);};
    this.worker.onerror=()=>{this.failed=true;for(const done of this.pending.values())done([]);this.pending.clear();};
  }
  plan(start:Vec2,goal:Vec2,state:BattlefieldState,done:(route:Vec2[])=>void):void {
    if(this.closed)return;
    if(this.failed){done([]);return;}
    const id=this.nextId++;
    this.pending.set(id,done);
    const request:RouteRequest={id,start:{x:start.x,z:start.z},goal,world:{seed:state.seed,trenches:state.trenches,craters:state.craters,buildingChanges:state.buildingChanges}};
    this.worker.postMessage(request);
  }
  dispose():void{if(this.closed)return;this.closed=true;this.worker.onmessage=null;this.worker.onerror=null;this.pending.clear();this.worker.terminate();}
}
