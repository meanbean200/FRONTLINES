import {polylineLength,pointAlongPolyline,type Vec2} from '../core/types';
import {excavatedPoints} from '../core/TrenchGeometry';
import type {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import type {StrategyCamera} from '../render/StrategyCamera';
import type {PersonalOrder} from '../garrison/types';
import {friendlyTrenches,trenchName,trenchPeople,trenchWorkforce,distanceToPolyline} from './TrenchReadout';
import {fieldIcon} from './FieldSymbols';

interface Actions {defend:(id:number)=>void;resume:(id:number)=>void;area:(id:number)=>void;move:()=>void;cancel:()=>void;notify:(text:string)=>void}
/** Inspection is read-only. Explicit buttons cross into simulation authority. */
export class TrenchPanel {
  readonly element=document.createElement('section');
  private readonly button=document.createElement('button');
  private readonly overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
  private readonly planned=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  private readonly built=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  private readonly personMarker=document.createElementNS('http://www.w3.org/2000/svg','circle');
  private trenchId=0;private personId=0;private last=0;private members='';
  constructor(private sim:BattlefieldSimulation,private camera:StrategyCamera,private selected:ReadonlySet<number>,private actions:Actions){
    const root=document.querySelector<HTMLElement>('#ui-root')!;
    this.button.id='trenches-command';this.button.innerHTML=fieldIcon('defend')+'Trenches';this.button.setAttribute('aria-expanded','false');this.button.setAttribute('aria-controls','trench-panel');
    root.querySelector('.hud-tools summary')!.after(this.button);
    this.element.id='trench-panel';this.element.className='trench-panel';this.element.hidden=true;this.element.setAttribute('aria-label','Trench management');
    this.element.innerHTML=`<header><div><small>FIELD WORKS</small><h2>Trenches</h2></div><button data-trench-close aria-label="Close trench management">×</button></header>
      <label>Find a trench<select id="trench-choice" aria-label="Trench"></select></label><p class="trench-overview"></p><p class="trench-workforce"></p>
      <div class="trench-actions"><button data-trench-focus>Locate</button><button data-trench-defend>Assign selected squads</button><button data-trench-resume>Resume digging</button><button data-trench-area>Area routines</button></div>
      <h3>Personnel <small class="trench-person-count"></small></h3><p class="trench-help">Select a person below, or Alt-click them on the battlefield. Only that person receives these orders.</p><div class="trench-person-list" role="group" aria-label="Trench personnel"></div>
      <section class="trench-person-detail" hidden><h3 class="trench-person-name"></h3><p class="trench-person-state"></p><p class="trench-person-reason"></p><div class="person-orders">${[['move','Reposition'],['watch','Watch'],['rest','Rest'],['meal','Eat / drink'],['auto','Area duties']].map(([id,label])=>`<button data-person-order="${id}">${label}</button>`).join('')}</div><p class="trench-help">Personal orders last up to 2 campaign hours, then area routines resume. Safety and later squad orders take priority.</p></section>`;
    // Keep the selected person's controls above the roster, including in short windows.
    this.element.querySelector('h3')!.before(this.element.querySelector('.trench-person-detail')!);
    root.append(this.element);this.overlay.classList.add('trench-inspection-overlay');this.overlay.setAttribute('aria-hidden','true');this.overlay.append(this.planned,this.built,this.personMarker);document.querySelector('#app')!.append(this.overlay);
    this.planned.setAttribute('class','inspection-planned');this.built.setAttribute('class','inspection-built');this.personMarker.setAttribute('r','9');this.personMarker.setAttribute('class','inspection-person');
    this.button.onclick=()=>this.element.hidden?this.open():this.close();
    this.element.querySelector('[data-trench-close]')!.addEventListener('click',()=>this.close());
    this.element.querySelector('#trench-choice')!.addEventListener('change',e=>{this.actions.cancel();this.trenchId=Number((e.target as HTMLSelectElement).value);this.personId=0;this.update(true);this.element.scrollTop=0;this.focus();});
    this.element.querySelector('[data-trench-focus]')!.addEventListener('click',()=>this.focus());
    this.element.querySelector('[data-trench-defend]')!.addEventListener('click',()=>{if(!this.locked()){this.actions.defend(this.trenchId);this.update(true);}});
    this.element.querySelector('[data-trench-resume]')!.addEventListener('click',()=>{if(!this.locked())this.actions.resume(this.trenchId);});
    this.element.querySelector('[data-trench-area]')!.addEventListener('click',()=>{const id=this.trenchId;this.close();this.actions.area(id);});
    this.element.addEventListener('click',e=>{
      const row=(e.target as Element).closest<HTMLButtonElement>('[data-person]');if(row){this.actions.cancel();this.personId=Number(row.dataset.person);this.update(true);this.element.scrollTop=0;const s=this.sim.state.soldiers.find(s=>s.id===this.personId);if(s)this.camera.focus(s,110);}
      const order=(e.target as Element).closest<HTMLButtonElement>('[data-person-order]');if(!order||this.locked())return;
      if(order.dataset.personOrder==='move'){this.actions.move();this.actions.notify('Click free floor in this connected trench. Esc cancels.');return;}
      const result=this.sim.garrisons.orderPerson(this.personId,order.dataset.personOrder as PersonalOrder);this.actions.notify(result.reason);this.update(true);
    });
    window.addEventListener('frontlines-menu',()=>this.close());
    root.addEventListener('click',e=>{if((e.target as Element).closest('#build-command,#support-command,[data-hud-panel]'))this.close();});
    window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!this.element.hidden){this.close();e.preventDefault();e.stopImmediatePropagation();window.dispatchEvent(new Event('frontlines-menu'));}},true);
  }
  private locked(){return this.sim.commandsLocked||Boolean(document.documentElement.dataset.menu||document.documentElement.dataset.help||document.documentElement.dataset.replay);}
  open(id?:number):void {
    window.dispatchEvent(new Event('frontlines-menu'));
    this.trenchId=id??this.trenchId;this.personId=0;this.element.hidden=false;this.button.setAttribute('aria-expanded','true');this.update(true);this.element.scrollTop=0;
  }
  close():void{this.element.hidden=true;this.overlay.style.display='none';this.button.setAttribute('aria-expanded','false');this.actions.cancel();}
  private focus():void{const t=this.sim.state.trenches.find(t=>t.id===this.trenchId);if(t)this.camera.focus(pointAlongPolyline(t.points,.5),Math.max(100,Math.min(600,polylineLength(t.points)*1.6)));}
  inspectPerson(id:number):boolean{
    const s=this.sim.state.soldiers.find(s=>s.id===id);if(!s)return false;
    const choices=friendlyTrenches(this.sim.state,this.sim.garrisons.network).filter(t=>trenchPeople(this.sim.state,this.sim.garrisons.network,t).some(p=>p.id===id));
    choices.sort((a,b)=>distanceToPolyline(s,a.points).distance-distanceToPolyline(s,b.points).distance);
    if(!choices[0])return false;this.open(choices[0].id);this.personId=id;this.update(true);return true;
  }
  inspectAt(point:Vec2):boolean{
    const t=friendlyTrenches(this.sim.state,this.sim.garrisons.network).find(t=>distanceToPolyline(point,t.points).distance<Math.max(3,t.width/2));
    if(!t)return false;this.open(t.id);return true;
  }
  movePerson(point:Vec2):boolean{if(this.locked()||this.element.hidden)return false;const result=this.sim.garrisons.orderPerson(this.personId,'move',point);this.actions.notify(result.reason);this.update(true);return result.accepted;}
  update(force=false):void{
    this.button.disabled=this.locked();if(this.element.hidden)return;
    const state=this.sim.state,network=this.sim.garrisons.network;
    if(force||performance.now()-this.last>250){
      this.last=performance.now();const trenches=friendlyTrenches(state,network),choice=this.element.querySelector<HTMLSelectElement>('#trench-choice')!;
      if(!trenches.some(t=>t.id===this.trenchId)){this.trenchId=trenches[0]?.id??0;this.personId=0;}
      const key=trenches.map(t=>`${t.id}:${Math.floor(t.progress*100)}`).join('|');
      if(choice.dataset.key!==key){choice.dataset.key=key;choice.replaceChildren();for(const t of trenches)choice.add(new Option(`${trenchName(state,t.id)} · ${Math.round(polylineLength(t.points))} m · ${t.status==='complete'?'dug':Math.floor(t.progress*100)+'%'}`,String(t.id)));if(!trenches.length)choice.add(new Option('No friendly trenches yet','0'));}
      choice.value=String(this.trenchId);const t=trenches.find(t=>t.id===this.trenchId),component=t?network.component(t.id):undefined;
      const groups=component===undefined?[]:state.living!.garrisons.filter(g=>g.faction!=='enemy'&&network.component(g.trenchId)===component),people=t?trenchPeople(state,network,t):[];
      this.element.querySelector('h2')!.textContent=t?trenchName(state,t.id):'Trenches';
      this.element.querySelector('.trench-overview')!.textContent=t?`${Math.round(polylineLength(t.points)*t.progress)} / ${Math.round(polylineLength(t.points))} m excavated · ${groups.reduce((n,g)=>n+g.squadIds.reduce((n,id)=>n+state.soldiers.filter(s=>s.squadId===id&&s.needs?.life!=='dead').length,0),0)} assigned / ${network.capacity(component??-1)} connected capacity`:'Build → Draw trench to plan a new line.';
      const {digging:workers,helpers}=trenchWorkforce(state,t);
      this.element.querySelector('.trench-workforce')!.textContent=t?(workers||helpers?`${workers} digging · ${helpers} clearing spoil. Fewer working hands means slower excavation.`:t.status==='complete'?`${groups.reduce((n,g)=>n+g.watchPresent,0)} on watch · ${people.filter(s=>s.action==='sleeping').length} sleeping in this network`:state.simSpeed===0?'Paused · press Space to start work.':'Waiting / approaching · assign builders or resume digging.') :'';
      this.element.querySelector<HTMLButtonElement>('[data-trench-focus]')!.disabled=!t;
      this.element.querySelector<HTMLButtonElement>('[data-trench-defend]')!.disabled=this.locked()||!t||component===undefined||!this.selected.size;
      const claimed=t&&state.squads.some(q=>q.order.type==='construct-trench'&&(q.order.trenchId===t.id||q.engineerWork?.crews.some(c=>c.trenchId===t.id)||(q.constructionQueue??[]).some(job=>typeof job==='number'?job===t.id:job.kind==='trench'&&job.id===t.id)));
      const resume=this.element.querySelector<HTMLButtonElement>('[data-trench-resume]')!;resume.disabled=this.locked()||!t||t.status==='complete'||Boolean(claimed);resume.title=claimed?'Already assigned to a work detail. Unpause to continue.':'Send the selected tool-equipped formation to this worksite.';
      this.element.querySelector<HTMLButtonElement>('[data-trench-area]')!.disabled=!groups.length;
      this.element.querySelector('.trench-person-count')!.textContent=String(people.length);
      if(!people.some(s=>s.id===this.personId))this.personId=0;
      const list=this.element.querySelector('.trench-person-list')!,members=people.map(s=>s.id).join('|');
      if(members!==this.members){this.members=members;list.replaceChildren();for(const s of people){const b=document.createElement('button');b.dataset.person=String(s.id);b.innerHTML='<strong></strong><span></span>';list.append(b);}}
      for(const s of people){const b=list.querySelector<HTMLButtonElement>(`[data-person="${s.id}"]`)!,q=state.squads.find(q=>q.id===s.squadId)!;b.querySelector('strong')!.textContent=`${q.name} · ${String(q.soldierIds.indexOf(s.id)+1).padStart(2,'0')}`;b.querySelector('span')!.textContent=s.needs?.life==='active'?s.action:s.needs?.life??s.action;b.setAttribute('aria-pressed',String(s.id===this.personId));}
      const s=people.find(s=>s.id===this.personId),detail=this.element.querySelector<HTMLElement>('.trench-person-detail')!;detail.hidden=!s;
      if(s){const q=state.squads.find(q=>q.id===s.squadId)!;detail.querySelector('h3')!.textContent=`${q.name} · person ${q.soldierIds.indexOf(s.id)+1}`;detail.querySelector('.trench-person-state')!.textContent=`${s.action} · ${s.cover} cover\nEnergy ${Math.round(s.needs?.energy??0)} · Morale ${Math.round(s.morale)} · Hunger ${Math.round(s.needs?.hunger??0)} · Thirst ${Math.round(s.needs?.thirst??0)}`;detail.querySelector('.trench-person-reason')!.textContent=s.combat?.pauseReason??s.duty?.reason??'Working detail — squad construction order.';for(const b of detail.querySelectorAll<HTMLButtonElement>('button')){b.disabled=this.locked()||s.needs?.life!=='active'||!s.garrisonId;b.title=!s.garrisonId?'Assign the squad to defend this trench before giving personal duties.':'Applies only to this person.';}}
    }
    const t=state.trenches.find(t=>t.id===this.trenchId);this.overlay.style.display=t&&!document.documentElement.dataset.fieldMap&&!document.documentElement.dataset.menu?'':'none';
    const plot=(element:SVGPolylineElement,points:Vec2[])=>{const screens=points.map(p=>this.camera.project(p,.12));element.setAttribute('points',screens.some(p=>p.visible)?screens.map(p=>`${p.x},${p.y}`).join(' '):'');};
    if(t){plot(this.planned,t.points);plot(this.built,excavatedPoints(t));}
    const s=state.soldiers.find(s=>s.id===this.personId),p=s?this.camera.project(s,1):undefined;this.personMarker.style.display=p?.visible?'':'none';if(p){this.personMarker.setAttribute('cx',String(p.x));this.personMarker.setAttribute('cy',String(p.y));}
  }
}
