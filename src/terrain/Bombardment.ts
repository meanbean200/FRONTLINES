import {distance,type BattlefieldState,type Vec2} from '../core/types';

export const MAX_BOMBARDMENT_CRATERS=512;
/** Permanent, deterministic damage. Overlapping strikes deepen the same ground.
 * At the bound, coalesce the closest pair before retaining the newest impact. */
export function bombardGround(state:BattlefieldState,p:Vec2):void {
  const nearby=state.craters.filter(c=>distance(c,p)<c.radius*.65).sort((a,b)=>distance(a,p)-distance(b,p)||a.id-b.id)[0];
  if(nearby){nearby.depth=Math.min(2.2,nearby.depth+.18);nearby.radius=Math.max(nearby.radius,Math.min(9,distance(nearby,p)+5.8));return;}
  if(state.craters.length>=MAX_BOMBARDMENT_CRATERS){
    let ai=0,bi=1,best=Infinity;
    for(let a=0;a<state.craters.length;a++)for(let b=a+1;b<state.craters.length;b++){
      const score=distance(state.craters[a],state.craters[b]);if(score<best){ai=a;bi=b;best=score;}
    }
    const a=state.craters[ai],b=state.craters[bi];
    if(best+a.radius<=b.radius){a.x=b.x;a.z=b.z;a.radius=b.radius;}
    else if(best+b.radius>a.radius){
      const radius=(best+a.radius+b.radius)/2,shift=best?(radius-a.radius)/best:0;
      a.x+=(b.x-a.x)*shift;a.z+=(b.z-a.z)*shift;a.radius=radius;
    }
    a.depth=Math.max(a.depth,b.depth);
    state.craters.splice(bi,1);
  }
  state.craters.push({id:state.nextEntityId++,x:p.x,z:p.z,radius:5.8,depth:1.15});
}
