import {distance,type Vec2} from '../core/types';
import type {DeploymentZone,FrontGeometry} from './OperationalTypes';
export const atDepth=(f:FrontGeometry,depth:number,lateral=0):Vec2=>({x:f.origin.x+f.forward.x*depth+f.right.x*lateral,z:f.origin.z+f.forward.z*depth+f.right.z*lateral});
export const frontDepth=(f:FrontGeometry,p:Vec2)=>(p.x-f.origin.x)*f.forward.x+(p.z-f.origin.z)*f.forward.z;
export function inZone(p:Vec2,z:DeploymentZone):boolean{const x=p.x-z.center.x,d=p.z-z.center.z;return Math.abs(x*z.forward.x+d*z.forward.z)<=z.halfDepth&&Math.abs(x*z.forward.z-d*z.forward.x)<=z.halfWidth;}
export function zoneCorners(z:DeploymentZone):Vec2[]{return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:z.center.x+z.forward.x*z.halfDepth*a-z.forward.z*z.halfWidth*b,z:z.center.z+z.forward.z*z.halfDepth*a+z.forward.x*z.halfWidth*b}));}
export function corridorDistance(p:Vec2,points:Vec2[]):number{
  let best=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,distance(p,{x:a.x+dx*t,z:a.z+dz*t}));}return best;
}
