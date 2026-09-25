import type {Vec2} from '../core/types';
import type {OperationRuntime} from '../operations/OperationalTypes';
import {zoneCorners} from '../operations/OperationGeometry';

/** Public briefing geometry only. Never paints the objective oracle's route access,
 * unseen troops, hidden control or a supposedly omniscient moving front. */
export function drawOperationPlan(ctx:CanvasRenderingContext2D,r:OperationRuntime,screen:(p:Vec2)=>{x:number;y:number},labels=false,dark=false,textScale=1,label?:(text:string,x:number,y:number,priority:number)=>void):void {
  ctx.save();
  const line=(points:Vec2[],color:string,dash:number[],width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();points.forEach((p,i)=>{const v=screen(p);if(i)ctx.lineTo(v.x,v.y);else ctx.moveTo(v.x,v.y);});ctx.stroke();};
  if(r.missionPlan){
    const m=r.missionPlan,p=screen(m.house),ink=dark?'#ded1a8':'#645330';
    for(const work of m.prepared)line(work.points,work.side==='player'?(dark?'#a6bdc6':'#456170'):(dark?'#c38e80':'#854c41'),[4,3],2);
    for(const route of r.routes.filter(r=>r.side==='player'))line(route.points,dark?'#c0b288':'#766741',[3,7],1.4);
    ctx.setLineDash([]);ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.strokeRect(p.x-7,p.y-7,14,14);
    if(labels){ctx.fillStyle=ink;ctx.font=`${12*textScale}px Bahnschrift`;ctx.textAlign='left';label?label(m.place+' / ROAD HOUSE',p.x+13,p.y+4,1):ctx.fillText(m.place+' / ROAD HOUSE',p.x+13,p.y+4);}
    ctx.restore();return;
  }
  for(const id of ['player-deployment',r.definitionId==='line-defense'?'fallback':r.definitionId==='meeting'?'contested':'enemy-belt',...(r.definitionId==='breakthrough'||r.definitionId==='open-front'?['deep']:[])]){
    const z=r.zones.find(z=>z.id===id)!,corners=zoneCorners(z);
    line([...corners,corners[0]],id==='player-deployment'?(dark?'#a6bdc6':'#456170'):id==='deep'?(dark?'#bac39b':'#626847'):(dark?'#c38e80':'#854c41'),[8,5]);
    if(labels){const p=screen(z.center);ctx.setLineDash([]);ctx.font=`${12*textScale}px Bahnschrift`;ctx.fillStyle=dark?'#e1ded0':id==='player-deployment'?'#344f60':id==='deep'?'#464c31':'#733e34';ctx.textAlign='center';label?label(id==='deep'?'CONSOLIDATION AREA':z.name.toUpperCase(),p.x,p.y-18*textScale,2):ctx.fillText(id==='deep'?'CONSOLIDATION AREA · CHOOSE A ROAD':z.name.toUpperCase(),p.x,p.y-18*textScale);}
  }
  for(const route of r.routes.filter(route=>route.side===(r.definitionId==='line-defense'?'enemy':'player'))){
    line(route.points,dark?'#c0b288':'#766741',[3,7],labels?1.4:1);
    if(labels){const p=screen(route.destination);ctx.setLineDash([]);ctx.fillStyle=dark?'#1c2c25':'#e6e0cb';ctx.fillRect(p.x-8,p.y-8,16,16);ctx.strokeStyle=dark?'#bfb28d':'#665b39';ctx.strokeRect(p.x-8,p.y-8,16,16);ctx.font=`${12*textScale}px Bahnschrift`;ctx.textAlign='left';ctx.fillStyle=dark?'#dfd6b9':'#4a4832';label?label(route.name,p.x+13,p.y+4,1):ctx.fillText(route.name,p.x+13,p.y+4);}
  }
  ctx.restore();
}
