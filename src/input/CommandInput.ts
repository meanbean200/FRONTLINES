import type { BattlefieldState, Vec2 } from '../core/types';
import type { StrategyCamera } from '../render/StrategyCamera';
import { factionOf } from '../operations/types';
import type {trenchDraft} from '../ui/TrenchDraft';
import {MIN_TRENCH_LENGTH,type FacilityPreview} from '../construction/ConstructionReadout';
import {marchPreview,marchMinutes} from '../ui/MarchPreview';

export type InteractionMode = 'select' | 'trench' | 'crater' | 'move' | 'facility'|'observe'|'suppress'|'assault'|'fall-back'|'defend'|'mortarHE'|'mortarSmoke'|'smokeGrenades'|'deploy'|'person-move';

/** The symbol is drawn above its observed ground location. Clicking it must
 * target that knowledge, not the unrelated terrain behind the floating icon. */
function observedMarkerPoint(event:PointerEvent):Vec2|undefined {
  const marker=event.target instanceof Element?event.target.closest<HTMLElement>('.contact-marker'):null;
  if(!marker||marker.dataset.x===undefined||marker.dataset.z===undefined)return;
  const x=Number(marker.dataset.x),z=Number(marker.dataset.z);
  return Number.isFinite(x)&&Number.isFinite(z)?{x,z}:undefined;
}

interface CommandInputOptions {
  canvas: HTMLCanvasElement;
  camera: StrategyCamera;
  getState: () => BattlefieldState;
  getMode: () => InteractionMode;
  setMode: (mode: InteractionMode) => void;
  selectedSquads: Set<number>;
  onSelectionChanged: () => void;
  onInspectPerson?:(id:number)=>boolean;
  onInspectTrench?:(point:Vec2)=>boolean;
  onPersonMove?:(point:Vec2)=>boolean;
  onMove: (point: Vec2) => void;
  onDrawPath: (points:Vec2[],append:boolean,intent?:'assault'|'fall-back')=>void;
  onTrench: (points: Vec2[]) => void;
  previewTrench?:(points:Vec2[])=>ReturnType<typeof trenchDraft>;
  previewFacility?:(point:Vec2)=>FacilityPreview|undefined;
  notify?:(message:string)=>void;
  onDefend?:(points:Vec2[])=>void;
  onCrater: (point: Vec2) => void;
  onFacility?: (point:Vec2)=>boolean;
  onTactical?:(mode:'observe'|'suppress'|'assault'|'fall-back',point:Vec2)=>void;
  onSupport?:(kind:'mortarHE'|'mortarSmoke'|'smokeGrenades',point:Vec2)=>boolean;
  supportDangerRadius?:()=>number;
  onDeploy?:(point:Vec2)=>void;
  previewDeployment?:(point:Vec2)=>{valid:boolean;reason:string;positions:Vec2[]};
}

export class CommandInput {
  private readonly box: HTMLDivElement;
  private readonly routePreview: SVGSVGElement;
  private readonly routeLine: SVGPolylineElement;
  private pointerStart?: { x: number; y: number };
  private contactPoint?:Vec2;
  private trenchPoints: Vec2[] = [];
  private lastTrenchScreen?: { x: number; y: number };
  private gesture?:InteractionMode;
  private button=0;
  private drawDistance=0;
  private readonly draft=document.createElement('div');
  private readonly plotted=document.createElementNS('http://www.w3.org/2000/svg','g');
  private hover?:{x:number;y:number};
  private previewMode:InteractionMode='select';

  constructor(private readonly options: CommandInputOptions) {
    this.box = document.createElement('div');
    this.box.className = 'selection-box';
    this.box.hidden = true;
    options.canvas.parentElement!.append(this.box);
    this.routePreview = document.createElementNS('http://www.w3.org/2000/svg','svg');
    this.routePreview.classList.add('route-preview');
    this.routePreview.style.display='none';
    this.routeLine = document.createElementNS('http://www.w3.org/2000/svg','polyline');
    this.routeLine.setAttribute('fill','none');this.routeLine.setAttribute('stroke','#f2ce86');this.routeLine.setAttribute('stroke-width','3');
    this.routePreview.innerHTML='<defs><marker id="plot-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="#dbca96" stroke-width="1.4"/></marker></defs>';
    this.routePreview.append(this.routeLine,this.plotted);
    options.canvas.parentElement!.append(this.routePreview);
    this.draft.className='draft-readout';this.draft.hidden=true;options.canvas.parentElement!.append(this.draft);
    options.canvas.addEventListener('pointerdown', this.onPointerDown);
    options.canvas.addEventListener('pointermove', this.onPointerMove);
    options.canvas.addEventListener('pointerup', this.onPointerUp);
    options.canvas.addEventListener('contextmenu', this.onContextMenu);
    // A flag is part of the battlefield, not an obstacle to drawing from the unit.
    window.addEventListener('pointerdown',event=>{
      if(event.target instanceof Element&&event.target.closest('.squad-marker,.trench-capacity,.contact-marker')&&(event.button===2||this.options.getMode()!=='select')){
        event.preventDefault();this.onPointerDown(event);
      }
    },true);
    window.addEventListener('contextmenu',event=>{if(event.target instanceof Element&&event.target.closest('.tactical-overlay'))event.preventDefault();});
    window.addEventListener('pointermove',event=>{if(event.target instanceof Element&&event.target.closest('.contact-marker'))this.onPointerMove(event);},true);
    options.canvas.addEventListener('pointercancel',()=>this.cancel());
    window.addEventListener('blur',()=>this.cancel());
    window.addEventListener('frontlines-menu',()=>this.cancel());
    window.addEventListener('keydown', this.onKeyDown);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if(document.documentElement.dataset.menu||document.documentElement.dataset.help||document.documentElement.dataset.fieldMap)return;
    const op=this.options.getState().operation;
    if((document.documentElement.dataset.replay||op&&op.status!=='active')&&(event.button===2||this.options.getMode()!=='select'))return;
    if (event.button !== 0&&event.button!==2) return;
    if(event.button===2&&this.options.getMode()!=='select'){this.cancel();return;}
    if(event.button===2&&!this.options.selectedSquads.size)return;
    this.button=event.button;
    this.drawDistance=0;
    this.gesture=event.button===2?'move':this.options.getMode();
    this.options.canvas.dataset.gesture=this.gesture;
    this.options.canvas.focus({preventScroll:true});
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.contactPoint=observedMarkerPoint(event);
    this.options.canvas.setPointerCapture(event.pointerId);
    if (this.gesture === 'trench'||this.gesture==='move'||this.gesture==='defend'||this.gesture==='assault'||this.gesture==='fall-back') {
      const point = ['move','assault','fall-back'].includes(this.gesture)?this.contactPoint??this.options.camera.groundPoint(event.clientX,event.clientY):this.options.camera.groundPoint(event.clientX,event.clientY);
      this.trenchPoints = point ? [point] : [];
      this.lastTrenchScreen = { x: event.clientX, y: event.clientY };
      this.routePreview.style.display='block';
      this.routeLine.setAttribute('fill','none');
      this.routeLine.setAttribute('points',`${event.clientX},${event.clientY}`);
      this.plotted.replaceChildren();this.draft.hidden=true;
      this.routeLine.setAttribute('stroke',this.gesture==='trench'?'#c5ae7d':'#dbca96');
      this.routeLine.setAttribute('stroke-width','2');
      this.routeLine.setAttribute('stroke-dasharray',this.gesture==='defend'?'10 5':this.gesture==='trench'?'6 3':'none');
      this.routeLine.setAttribute('marker-end',this.gesture==='move'||this.gesture==='assault'||this.gesture==='fall-back'?'url(#plot-arrow)':'none');
    } else if (this.options.getMode() === 'select') {
      this.box.hidden = false;
      this.updateBox(event.clientX, event.clientY);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.hover={x:event.clientX,y:event.clientY};
    const preview=this.options.getMode();
    if(preview==='facility'||preview==='deploy'){this.updatePreview();return;}
    if(['mortarHE','mortarSmoke','smokeGrenades'].includes(preview)&&!document.documentElement.dataset.menu){const p=observedMarkerPoint(event)??this.options.camera.groundPoint(event.clientX,event.clientY);if(p){const radius=preview==='mortarHE'?(this.options.supportDangerRadius?.()??40):preview==='mortarSmoke'?18:11;const points=Array.from({length:49},(_,i)=>this.options.camera.project({x:p.x+Math.sin(i*Math.PI/24)*radius,z:p.z+Math.cos(i*Math.PI/24)*radius},.6));this.plotted.replaceChildren();this.routeLine.setAttribute('marker-end','none');this.routeLine.setAttribute('stroke-dasharray','5 4');this.routeLine.setAttribute('points',points.map(p=>`${p.x},${p.y}`).join(' '));this.routeLine.setAttribute('stroke',preview==='mortarHE'?'#b8796b':'#b8bbaa');this.routeLine.setAttribute('fill',preview==='mortarHE'?'#b8796b18':'#e6e0cb18');this.routePreview.style.display='block';}return;}
    if (!this.pointerStart) return;
    const mode = this.gesture;
    if (mode === 'select') this.updateBox(event.clientX, event.clientY);
    if ((mode === 'trench'||mode==='move'||mode==='defend'||mode==='assault'||mode==='fall-back') && this.lastTrenchScreen) {
      const screenDistance = Math.hypot(event.clientX - this.lastTrenchScreen.x, event.clientY - this.lastTrenchScreen.y);
      if (screenDistance > 5) {
        this.drawDistance+=screenDistance;
        const point = this.options.camera.groundPoint(event.clientX, event.clientY);
        if (point) this.trenchPoints.push(point);
        this.lastTrenchScreen = { x: event.clientX, y: event.clientY };
      }
      const screens=this.trenchPoints.map(p=>this.options.camera.project(p,.3));
      this.routeLine.setAttribute('points',[...screens,{x:event.clientX,y:event.clientY}].map(p=>`${p.x},${p.y}`).join(' '));
      if(mode==='trench')this.showDraft(screens);
      else if(mode==='move'||mode==='assault'||mode==='fall-back'){
        const r=marchPreview(this.options.getState(),this.options.selectedSquads,this.trenchPoints);
        this.draft.hidden=false;this.draft.dataset.invalid=String(r.atRisk>0);
        this.draft.innerHTML=`<strong>ROUTE / ${Math.round(r.length)} METRES</strong><br>~${marchMinutes(r.travelSeconds)} travel + ~${marchMinutes(r.restSeconds)} rest at 1×${r.atRisk?'<br>Food may run short · slower recovery, never starvation':''}`;
      }
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.draft.hidden=true;
    if(document.documentElement.dataset.replay&&this.gesture!=='select'){this.cancel();return;}
    if (event.button !== this.button || !this.pointerStart) return;
    const start = this.pointerStart;
    const contactPoint=Math.hypot(event.clientX-start.x,event.clientY-start.y)<8?this.contactPoint:undefined;
    this.contactPoint=undefined;
    this.pointerStart = undefined;
    const mode = this.gesture;this.gesture=undefined;
    delete this.options.canvas.dataset.gesture;
    if (mode === 'select') {
      this.box.hidden = true;
      const dragDistance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (dragDistance < 6) this.selectPoint(event.clientX, event.clientY, event.shiftKey,event.altKey);
      else this.selectBox(start, { x: event.clientX, y: event.clientY }, event.shiftKey);
    } else if (mode === 'trench'||mode==='defend') {
      this.routePreview.style.display='none';
      const point = this.options.camera.groundPoint(event.clientX, event.clientY);
      if (point && (this.trenchPoints.length === 0 || distance2D(point, this.trenchPoints.at(-1)!) > 3)) this.trenchPoints.push(point);
      const length=routeLength(this.trenchPoints);
      if(mode==='trench'&&length<MIN_TRENCH_LENGTH){this.options.notify?.(`Trench too short: ${Math.round(length)} m. Drag at least ${MIN_TRENCH_LENGTH} m.`);this.trenchPoints=[];return;}
      if(this.trenchPoints.length>=2){if(mode==='defend')this.options.onDefend?.(this.trenchPoints);else this.options.onTrench(this.trenchPoints);}
      this.trenchPoints = [];
      this.options.setMode('select');
    } else if(mode==='person-move') {
      const point=contactPoint??this.options.camera.groundPoint(event.clientX,event.clientY);if(point&&this.options.onPersonMove?.(point))this.options.setMode('select');
    } else if(mode==='deploy') {
      const point=this.options.camera.groundPoint(event.clientX,event.clientY);if(point)this.options.onDeploy?.(point);
    } else if(mode==='facility') {
      const point=this.options.camera.groundPoint(event.clientX,event.clientY);
      if(point&&this.options.onFacility?.(point)){this.options.setMode('select');this.routePreview.style.display='none';this.draft.hidden=true;}
    } else if(mode==='observe'||mode==='suppress'||mode==='assault'||mode==='fall-back'){
      const point=contactPoint??this.options.camera.groundPoint(event.clientX,event.clientY);if(point&&(mode==='assault'||mode==='fall-back')&&this.drawDistance>8){this.trenchPoints.push(point);this.options.onDrawPath(this.trenchPoints,event.shiftKey,mode);}else if(point)this.options.onTactical?.(mode,point);this.trenchPoints=[];this.routePreview.style.display='none';this.options.setMode('select');
    } else if(mode==='mortarHE'||mode==='mortarSmoke'||mode==='smokeGrenades'){
      const point=contactPoint??this.options.camera.groundPoint(event.clientX,event.clientY);if(point&&this.options.onSupport?.(mode,point)){this.routePreview.style.display='none';this.options.setMode('select');}
    } else if (mode === 'crater') {
      const point = this.options.camera.groundPoint(event.clientX, event.clientY);
      if (point) this.options.onCrater(point);
      this.options.setMode('select');
    } else if(mode==='move') {
      this.routePreview.style.display='none';
      const point=contactPoint??this.options.camera.groundPoint(event.clientX,event.clientY);
      if(point)this.trenchPoints.push(point);
      if(this.drawDistance>8&&this.trenchPoints.length>=2)this.options.onDrawPath(this.trenchPoints,event.shiftKey);
      else if(point)this.options.onMove(point);
      this.trenchPoints=[];
      this.options.setMode('select');
    }
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      this.cancel();
    }
  };
  private cancel():void {this.pointerStart=undefined;this.contactPoint=undefined;this.gesture=undefined;delete this.options.canvas.dataset.gesture;this.options.setMode('select');this.trenchPoints=[];this.box.hidden=true;this.routePreview.style.display='none';this.draft.hidden=true;}

  private showDraft(screens:{x:number;y:number}[]):void {
    const report=this.options.previewTrench?.(this.trenchPoints);if(!report)return;
    this.draft.hidden=false;this.draft.dataset.invalid=String(report.blocked.length>0||report.tooShort);
    this.draft.innerHTML=`<strong>ENGINEER PLOT / ${Math.round(report.length)} METRES</strong>${report.blocked.length?'Obstruction · red segments cross water or a building':report.tooShort?`Extend the line to ${MIN_TRENCH_LENGTH} metres`:'Drawn line clear · smoothed route checked on release'}<br>Release to assign works · Esc cancels`;
    this.plotted.replaceChildren();
    for(const {a,b} of report.blocked){const p=this.options.camera.project(a,.4),q=this.options.camera.project(b,.4),line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const[k,v]of Object.entries({x1:p.x,y1:p.y,x2:q.x,y2:q.y,stroke:'#b8796b','stroke-width':4}))line.setAttribute(k,String(v));this.plotted.append(line);}
    let last:{x:number;y:number}|undefined;
    for(const [i,p]of screens.entries())if(!last||i===screens.length-1||Math.hypot(p.x-last.x,p.y-last.y)>34){const tick=document.createElementNS('http://www.w3.org/2000/svg','rect');tick.setAttribute('x',String(p.x-3));tick.setAttribute('y',String(p.y-3));tick.setAttribute('width','6');tick.setAttribute('height','6');tick.setAttribute('fill','#1c2422');tick.setAttribute('stroke','#e6e0cb');this.plotted.append(tick);last=p;}
  }

  updatePreview():void{
    const mode=this.options.getMode();
    if(mode!==this.previewMode){if(!this.pointerStart){this.routePreview.style.display='none';this.draft.hidden=true;this.plotted.replaceChildren();}this.previewMode=mode;}
    if(mode==='deploy'&&this.hover&&!document.documentElement.dataset.menu&&!document.documentElement.dataset.help&&!document.documentElement.dataset.fieldMap){
      const point=this.options.camera.groundPoint(this.hover.x,this.hover.y),report=point&&this.options.previewDeployment?.(point);if(!report)return;
      this.routePreview.style.display='block';this.routeLine.setAttribute('points','');this.plotted.replaceChildren();
      for(const p of report.positions){const screen=this.options.camera.project(p,.3),mark=document.createElementNS('http://www.w3.org/2000/svg','rect');for(const [key,value] of Object.entries({x:screen.x-3,y:screen.y-3,width:6,height:6,fill:report.valid?'#dbca96':'#b8796b'}))mark.setAttribute(key,String(value));this.plotted.append(mark);}
      this.draft.hidden=false;this.draft.dataset.valid=String(report.valid);this.draft.textContent=report.reason+' · Esc / right-click cancels';this.draft.style.left=Math.min(this.hover.x+18,window.innerWidth-350)+'px';this.draft.style.top=Math.max(80,Math.min(this.hover.y+18,window.innerHeight-120))+'px';return;
    }
    if(mode!=='facility'||!this.hover||document.documentElement.dataset.menu||document.documentElement.dataset.help||document.documentElement.dataset.fieldMap)return;
    const point=this.options.camera.groundPoint(this.hover.x,this.hover.y);if(!point)return;
    const report=this.options.previewFacility?.(point);if(!report)return;
    const tint=report.valid?'#dbca96':'#b8796b',shape=report.kind==='emplacement'?[[-1.2,-.6],[-1.2,.7],[1.2,.7],[1.2,-.6]]:report.kind==='mortar'?Array.from({length:9},(_,i)=>[Math.sin(i*Math.PI/4)*2.8,Math.cos(i*Math.PI/4)*2.8]):[[-2.8,-2.8],[2.8,-2.8],[2.8,2.8],[-2.8,2.8],[-2.8,-2.8]],angle=report.facing??0,outline=shape.map(([x,z])=>this.options.camera.project({x:report.position.x+x*Math.cos(angle)+z*Math.sin(angle),z:report.position.z-x*Math.sin(angle)+z*Math.cos(angle)},.35));
    this.routePreview.style.display='block';this.routeLine.setAttribute('points',outline.map(p=>`${p.x},${p.y}`).join(' '));this.routeLine.setAttribute('fill',report.valid?'#dbca9630':'#b8796b30');this.routeLine.setAttribute('stroke',tint);this.routeLine.setAttribute('stroke-width','2');this.routeLine.setAttribute('stroke-dasharray','none');this.routeLine.setAttribute('marker-end','none');this.plotted.replaceChildren();
    const segment=(a:Vec2,b:Vec2,arrow=false)=>{const aa=this.options.camera.project(a,.35),bb=this.options.camera.project(b,.35),line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const[k,v]of Object.entries({x1:aa.x,y1:aa.y,x2:bb.x,y2:bb.y,stroke:tint,'stroke-width':3,'marker-end':arrow?'url(#plot-arrow)':'none'}))line.setAttribute(k,String(v));this.plotted.append(line);};
    if(report.sites){this.routeLine.setAttribute('points','');for(const site of report.sites){const outline=document.createElementNS('http://www.w3.org/2000/svg','polygon');outline.setAttribute('points',[[-2.7,-3],[2.7,-3],[2.7,3],[-2.7,3]].map(([x,z])=>this.options.camera.project({x:site.x+x*Math.cos(angle)+z*Math.sin(angle),z:site.z-x*Math.sin(angle)+z*Math.cos(angle)},.35)).map(p=>`${p.x},${p.y}`).join(' '));outline.setAttribute('fill',tint+'30');outline.setAttribute('stroke',tint);this.plotted.append(outline);segment(site,{x:site.x+Math.sin(angle)*6,z:site.z+Math.cos(angle)*6},true);}}
    if(report.kind==='emplacement'){if(report.segment)segment(report.segment[0],report.segment[1]);segment(report.position,{x:report.position.x+Math.sin(angle)*9,z:report.position.z+Math.cos(angle)*9},true);}else if(report.origin)segment(report.origin,report.position);
    if(report.kind==='mortar')segment(report.position,{x:report.position.x+Math.sin(angle)*15,z:report.position.z+Math.cos(angle)*15},true);
    this.draft.hidden=false;this.draft.dataset.invalid=String(!report.valid);
    const heading=report.kind==='mortar'?` · FACING ${(Math.round(angle*180/Math.PI)+360)%360}°`:'';
    const text=`${report.name.toUpperCase()} / ${report.cost} MATERIALS${heading}\n${report.reason}\n${Math.floor(report.materials)} in trench stores · Esc / right-click cancels`;
    if(this.draft.textContent!==text)this.draft.textContent=text;
  }

  private selectPoint(x: number, y: number, additive: boolean, individual=false): void {
    const state = this.options.getState();
    if(individual){
      const people=state.soldiers.filter(s=>s.needs?.life!=='dead'&&state.squads.some(q=>q.id===s.squadId&&q.faction!=='enemy')).map(s=>({s,p:this.options.camera.project(s,1)})).filter(({p})=>p.visible&&Math.hypot(p.x-x,p.y-y)<18).sort((a,b)=>Math.hypot(a.p.x-x,a.p.y-y)-Math.hypot(b.p.x-x,b.p.y-y));
      if(people[0]&&this.options.onInspectPerson?.(people[0].s.id))return;
      this.options.notify?.('Alt-click a friendly person at closer zoom.');return;
    }
    const ground=this.options.camera.groundPoint(x,y);if(ground&&this.options.onInspectTrench?.(ground))return;
    let bestId: number | undefined;
    let bestDistance = 32;
    for (const squad of state.squads) {
      if(factionOf(squad)==='enemy')continue;
      const position=this.options.camera.project(squad,2);
      const sx=position.x,sy=position.y;
      const distance = Math.hypot(sx - x, sy - y);
      if (position.visible && distance < bestDistance) {
        bestDistance = distance;
        bestId = squad.id;
      }
    }
    for(const soldier of state.soldiers){if(state.squads.some(s=>s.id===soldier.squadId&&factionOf(s)==='enemy'))continue;const p=this.options.camera.project(soldier,1);const d=Math.hypot(p.x-x,p.y-y);if(p.visible&&d<Math.min(bestDistance,18)){bestDistance=d;bestId=soldier.squadId;}}
    const point=this.options.camera.groundPoint(x,y);
    if(bestId===undefined&&point&&this.options.onInspectTrench?.(point))return;
    if (!additive) this.options.selectedSquads.clear();
    if (bestId !== undefined) {
      if (additive && this.options.selectedSquads.has(bestId)) this.options.selectedSquads.delete(bestId);
      else this.options.selectedSquads.add(bestId);
    }
    this.options.onSelectionChanged();
  }

  private selectBox(a: { x: number; y: number }, b: { x: number; y: number }, additive: boolean): void {
    const state = this.options.getState();
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (!additive) this.options.selectedSquads.clear();
    for (const squad of state.squads) {
      if(factionOf(squad)==='enemy')continue;
      const position=this.options.camera.project(squad,2);
      const sx=position.x,sy=position.y;
      if (position.visible && sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) this.options.selectedSquads.add(squad.id);
    }
    for(const soldier of state.soldiers){if(state.squads.some(s=>s.id===soldier.squadId&&factionOf(s)==='enemy'))continue;const p=this.options.camera.project(soldier,1);if(p.visible&&p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY)this.options.selectedSquads.add(soldier.squadId);}
    this.options.onSelectionChanged();
  }

  private updateBox(x: number, y: number): void {
    if (!this.pointerStart) return;
    const left = Math.min(this.pointerStart.x, x);
    const top = Math.min(this.pointerStart.y, y);
    this.box.style.left = `${left}px`;
    this.box.style.top = `${top}px`;
    this.box.style.width = `${Math.abs(x - this.pointerStart.x)}px`;
    this.box.style.height = `${Math.abs(y - this.pointerStart.y)}px`;
  }
}

const distance2D = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
const routeLength = (points: Vec2[]): number => points.slice(1).reduce((sum, point, index) => sum + distance2D(points[index], point), 0);
