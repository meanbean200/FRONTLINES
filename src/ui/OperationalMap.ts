import type {Vec2} from '../core/types';
import type {OperationRuntime} from '../operations/OperationalTypes';
import {zoneCorners} from '../operations/OperationGeometry';

/** Public briefing geometry only. Never paints the objective oracle's route access,
 * unseen troops, hidden control or a supposedly omniscient moving front. */
export function drawOperationPlan(ctx:CanvasRenderingContext2D,r:OperationRuntime,screen:(p:Vec2)=>{x:number;y:number},labels=false):void {
  ctx.save();
  const line=(points:Vec2[],color:string,dash:number[],width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();points.forEach((p,i)=>{const v=screen(p);if(i)ctx.lineTo(v.x,v.y);else ctx.moveTo(v.x,v.y);});ctx.stroke();};
  for(const id of ['player-deployment',r.definitionId==='line-defense'?'fallback':r.definitionId==='meeting'?'contested':'enemy-belt',...(r.definitionId==='breakthrough'||r.definitionId==='open-front'?['deep']:[])]){
    const z=r.zones.find(z=>z.id===id)!,corners=zoneCorners(z);
    line([...corners,corners[0]],id==='player-deployment'?'#456170':id==='deep'?'#626847':'#854c41',[8,5]);
    if(labels){const p=screen(z.center);ctx.setLineDash([]);ctx.font='12px Consolas';ctx.fillStyle=id==='player-deployment'?'#344f60':id==='deep'?'#464c31':'#733e34';ctx.textAlign='center';ctx.fillText(id==='deep'?'CONSOLIDATION AREA · CHOOSE A ROAD':z.name.toUpperCase(),p.x,p.y-10);}
  }
  for(const route of r.routes.filter(route=>route.side===(r.definitionId==='line-defense'?'enemy':'player'))){
    line(route.points,'#766741',[3,7],labels?1.4:1);
    if(labels){const p=screen(route.destination);ctx.setLineDash([]);ctx.fillStyle='#e6e0cb';ctx.fillRect(p.x-8,p.y-8,16,16);ctx.strokeStyle='#665b39';ctx.strokeRect(p.x-8,p.y-8,16,16);ctx.font='11px Consolas';ctx.textAlign='left';ctx.fillStyle='#4a4832';ctx.fillText(route.name,p.x+13,p.y+4);}
  }
  ctx.restore();
}
