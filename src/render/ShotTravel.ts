import type {ShotEvent,Point3} from '../combat/types';

export type ShotView='full'|'incoming'|'hidden';
const length=(shot:ShotEvent)=>Math.hypot(shot.to.x-shot.from.x,shot.to.y-shot.from.y,shot.to.z-shot.from.z);
export const travelDuration=(shot:ShotEvent,view:ShotView)=>view==='incoming'?.065:Math.max(.055,Math.min(.20,length(shot)/2000));
/** A short segment moving along the resolved ray, not another projectile or
 * hit calculation. Unknown origins are clipped to the final eight metres. */
export function shotTravelSegment(shot:ShotEvent,age:number,view:ShotView):[Point3,Point3]|undefined {
  if(view==='hidden'||age<0||![shot.from,shot.to].every(p=>[p.x,p.y,p.z].every(Number.isFinite)))return;
  const d=length(shot),duration=travelDuration(shot,view);if(d<.01||d>1200||age>duration+.025)return;
  const start=view==='incoming'?Math.max(0,d-8):0,span=d-start,tail=Math.min(span,Math.max(1.2,Math.min(14,d*.045)));
  const head=start+Math.min(span,Math.max(Math.min(tail*.3,1),span*age/duration));
  const point=(along:number)=>along>=d?{...shot.to}:along<=0?{...shot.from}:({x:shot.from.x+(shot.to.x-shot.from.x)*along/d,y:shot.from.y+(shot.to.y-shot.from.y)*along/d,z:shot.from.z+(shot.to.z-shot.from.z)*along/d});
  return [point(Math.max(start,head-tail)),point(head)];
}
interface Cue {shot:ShotEvent;view:ShotView;born:number;arrived:boolean}
/** Bounded render-clock cues keep real shot cadence readable at fast-forward.
 * No RNG, inventory, contacts, damage, or simulation state is written here. */
export class ShotTravel {
  private cues:Cue[]=[];
  private seen=new Set<number>();
  private identity?:object;
  private previous?:number;
  private previousSimulation=0;
  private clock=0;
  update(identity:object|undefined,shots:ShotEvent[],simulationAt:number,now:number,running:boolean,view:(shot:ShotEvent)=>ShotView){
    if(this.identity!==identity||simulationAt<this.previousSimulation){this.cues=[];this.seen.clear();this.identity=identity;this.clock=0;this.previous=now;}
    if(running)this.clock+=Math.min(.1,Math.max(0,now-(this.previous??now)));this.previous=now;this.previousSimulation=simulationAt;
    const present=new Set(shots.map(s=>s.id));for(const id of this.seen)if(!present.has(id))this.seen.delete(id);
    for(const shot of shots){
      if(this.seen.has(shot.id))continue;this.seen.add(shot.id);
      if(simulationAt-shot.at>1||simulationAt<shot.at)continue;
      const visibility=view(shot);if(visibility==='hidden')continue;
      if(this.cues.length>=192)this.cues.shift();this.cues.push({shot,view:visibility,born:this.clock,arrived:false});
    }
    const segments:[Point3,Point3][]=[],arrivals:ShotEvent[]=[];
    this.cues=this.cues.filter(c=>{
      // A lost visual contact cannot leave a stored line leading back to it.
      const current=view(c.shot);if(current==='hidden')return false;if(current==='incoming')c.view='incoming';
      const age=this.clock-c.born;
      if(age>=travelDuration(c.shot,c.view)&&!c.arrived){c.arrived=true;arrivals.push(c.shot);}
      const segment=shotTravelSegment(c.shot,age,c.view);if(segment)segments.push(segment);
      return age<=travelDuration(c.shot,c.view)+.025;
    });
    return {segments,arrivals};
  }
}
