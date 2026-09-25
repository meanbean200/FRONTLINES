import type {BattlefieldState,Vec2} from '../core/types';
import type {StrategyCamera} from '../render/StrategyCamera';
import {factionOf} from '../operations/types';
import {clippedPaths} from './ProjectedPaths';

/** Player order ink is not a debug view. Projects with the current camera. */
export class OrderOverlay {
  private readonly svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  private readonly paths=new Map<string,SVGPathElement>();
  constructor(private state:()=>BattlefieldState,private selected:Set<number>,private camera:StrategyCamera){
    this.svg.classList.add('order-ink');this.svg.setAttribute('aria-hidden','true');
    this.svg.innerHTML='<defs><marker id="order-arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="8" markerHeight="8" orient="auto"><path d="m2 2 9 4-9 4" fill="none" stroke="#dbca96" stroke-width="1.2"/></marker></defs>';
    document.querySelector('#app')!.append(this.svg);
  }
  update(){
    const state=this.state(),active=new Set<string>();
    const draw=(id:string,points:Vec2[],defend=false)=>{
      if(points.length<2)return;active.add(id);let path=this.paths.get(id);
      if(!path){path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('fill','none');path.setAttribute('stroke',defend?'#9bacb2':'#dbca96');path.setAttribute('stroke-width','1.5');path.setAttribute('stroke-dasharray',defend?'12 5':'none');if(!defend)path.setAttribute('marker-end','url(#order-arrow)');this.svg.append(path);this.paths.set(id,path);}
      const d=clippedPaths(points.map(p=>this.camera.project(p,.7)),window.innerWidth,window.innerHeight).map(line=>line.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')).join(' ');
      path.setAttribute('d',d);
    };
    for(const q of state.squads)if(this.selected.has(q.id)&&factionOf(q)==='player'&&q.order.type==='move')draw('s'+q.id,q.order.drawnPath??[q,...q.route.slice(q.routeIndex)]);
    for(const g of state.living?.garrisons??[])if(g.faction!=='enemy'&&g.frontage&&g.squadIds.some(id=>this.selected.has(id)))draw('g'+g.id,g.frontage,true);
    for(const[id,path]of this.paths)if(!active.has(id)){path.remove();this.paths.delete(id);}
  }
}
