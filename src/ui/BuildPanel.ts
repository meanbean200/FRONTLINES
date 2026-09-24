import type {BattlefieldState,Vec2} from '../core/types';
import type {Facility} from '../garrison/types';
import {fitEngineers,SUPPORT_WORKS,constructionStatus,selectedConstructionNetwork} from '../construction/ConstructionReadout';
import {localInventory} from '../garrison/Inventory';
import {fieldIcon} from './FieldSymbols';

interface BuildActions {place:(id:number,kind:Facility['kind'])=>void;assign:(id?:number)=>void;focus:(point:Vec2)=>void}
/** Contextual construction choices. Opening never changes orders or inventories. */
export class BuildPanel {
  readonly element=document.createElement('section');
  private readonly button=document.createElement('button');
  private networkId=0;
  private last=0;
  constructor(private getState:()=>BattlefieldState,private actions:BuildActions,private selected:()=>ReadonlySet<number>=()=>new Set()){
    const root=document.querySelector<HTMLElement>('#ui-root')!;
    this.button.id='build-command';this.button.innerHTML=fieldIcon('engineer')+'Build';this.button.setAttribute('aria-controls','build-panel');this.button.setAttribute('aria-expanded','false');
    root.querySelector('.command-dock>div')!.append(this.button);
    this.element.id='build-panel';this.element.className='build-panel';this.element.hidden=true;this.element.setAttribute('aria-label','Engineer construction');
    this.element.innerHTML=`<header><div><small>ENGINEERING</small><h2>Build</h2></div><button data-build-close aria-label="Close construction">×</button></header><div class="build-categories"><div class="build-trench"></div><button data-build-category="support">${fieldIcon('force')}<span><strong>Support structures</strong><small>Supply, shelter and casualty care</small></span></button><button data-build-category="jobs">${fieldIcon('resume')}<span><strong>Worksites</strong><small>Inspect queued and active construction</small></span></button></div><section class="build-context" data-build-page="support" hidden><button data-build-back>← Construction</button><h3>Support structures</h3><label>Trench network<select id="build-network" aria-label="Construction network"></select></label><p class="build-workforce"></p><button id="assign-builders">Assign engineers to this network</button><div class="build-catalog">${Object.entries(SUPPORT_WORKS).map(([kind,work])=>`<button data-build-kind="${kind}"><strong>${work.name}</strong><small>${work.cost} materials · ${work.description}</small></button>`).join('')}</div><p class="build-supply"></p></section><section class="build-context" data-build-page="jobs" hidden><button data-build-back>← Construction</button><h3>Works in progress</h3><div class="build-jobs"></div></section>`;
    root.append(this.element);this.element.querySelector('.build-trench')!.append(root.querySelector('#trench-command')!);
    this.button.onclick=()=>this.element.hidden?this.open():this.close();
    this.element.querySelector('[data-build-close]')!.addEventListener('click',()=>this.close());
    this.element.querySelector('#trench-command')!.addEventListener('click',()=>this.close());
    const page=(value?:string)=>{this.element.querySelector<HTMLElement>('.build-categories')!.hidden=Boolean(value);for(const el of this.element.querySelectorAll<HTMLElement>('[data-build-page]'))el.hidden=el.dataset.buildPage!==value;};
    this.element.querySelectorAll<HTMLButtonElement>('[data-build-category]').forEach(b=>b.onclick=()=>page(b.dataset.buildCategory));
    this.element.querySelectorAll<HTMLButtonElement>('[data-build-back]').forEach(b=>b.onclick=()=>page());
    this.element.querySelector('#build-network')!.addEventListener('change',e=>{this.networkId=Number((e.target as HTMLSelectElement).value);this.update(true);});
    this.element.querySelector('#assign-builders')!.addEventListener('click',()=>{this.actions.assign(this.networkId||undefined);this.update(true);});
    this.element.querySelectorAll<HTMLButtonElement>('[data-build-kind]').forEach(b=>b.onclick=()=>{this.actions.place(this.networkId,b.dataset.buildKind as Facility['kind']);this.close();});
    window.addEventListener('frontlines-menu',()=>this.close());
    root.querySelectorAll('[data-hud-panel]').forEach(b=>b.addEventListener('click',()=>this.close()));
    window.addEventListener('keydown',e=>{if(!this.element.hidden&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();}},true);
  }
  open(id?:number):void{
    window.dispatchEvent(new Event('frontlines-menu'));
    document.querySelectorAll<HTMLDetailsElement>('.garrison-panel,.support-controls').forEach(p=>p.open=false);
    this.networkId=id??selectedConstructionNetwork(this.getState(),this.selected(),this.networkId)??0;
    this.element.querySelector<HTMLElement>('.build-categories')!.hidden=false;for(const el of this.element.querySelectorAll<HTMLElement>('[data-build-page]'))el.hidden=true;
    this.element.hidden=false;this.element.scrollTop=0;this.button.setAttribute('aria-expanded','true');this.button.classList.add('active');document.documentElement.dataset.buildOpen='true';this.update(true);
  }
  close():void{this.element.hidden=true;this.button.setAttribute('aria-expanded','false');this.button.classList.remove('active');delete document.documentElement.dataset.buildOpen;}
  update(force=false):void{
    const state=this.getState(),locked=Boolean(document.documentElement.dataset.replay||document.documentElement.dataset.menu||document.documentElement.dataset.help||state.operation&&state.operation.status!=='active');
    this.button.disabled=locked;
    if(this.element.hidden||!force&&performance.now()-this.last<250)return;this.last=performance.now();
    const networks=state.living!.garrisons.filter(g=>g.faction!=='enemy'),select=this.element.querySelector<HTMLSelectElement>('#build-network')!;
    if(!networks.some(g=>g.id===this.networkId))this.networkId=networks[0]?.id??0;
    const key=networks.map(g=>g.id+g.name).join('|');
    if(select.dataset.key!==key){select.dataset.key=key;select.replaceChildren();if(!networks.length)select.add(new Option('No defended trench yet','0'));for(const g of networks)select.add(new Option(g.name,String(g.id)));}
    select.value=String(this.networkId);select.disabled=locked||!networks.length;
    const g=networks.find(g=>g.id===this.networkId),teams=fitEngineers(state),assigned=teams.filter(q=>g?.squadIds.includes(q.id)&&q.order.type==='occupy-trench');
    const workforce=this.element.querySelector('.build-workforce')!;
    workforce.textContent=!teams.length?'No fit engineer team available.':!g?'First draw a trench and let excavation finish. Then assign engineers here.':assigned.length?`${assigned.map(q=>q.name).join(', ')} ready. Choose a structure below, then place it behind this trench.`:'Step 1: assign engineers below. Step 2: choose a structure and its site. This pauses their current order; unfinished trenches remain.';
    const assign=this.element.querySelector<HTMLButtonElement>('#assign-builders')!;assign.hidden=assigned.length>0;assign.disabled=locked||!teams.length;assign.textContent=g?'Assign engineers to this network':'Assign engineers to nearest completed trench';
    for(const b of this.element.querySelectorAll<HTMLButtonElement>('[data-build-kind]')){b.disabled=locked||!assigned.length||g?.cutoff==='withdraw';b.title=b.disabled?'Assign an engineer team to this trench network first.':'Choose a site; materials are physically delivered, not spent instantly.';}
    const materials=g?localInventory(state,g).materials:0;
    this.element.querySelector('.build-supply')!.textContent=`${Math.floor(materials)} materials in trench stores · support works need a clear 6–40 m connector behind the line. Shortages wait for delivery.`;
    const jobs=this.element.querySelector('.build-jobs')!;jobs.replaceChildren();
    const add=(title:string,status:string,point?:Vec2)=>{const row=document.createElement(point?'button':'p'),name=document.createElement('strong'),detail=document.createElement('span');name.textContent=title+(point?' ↗':'');detail.textContent=status;row.append(name,detail);if(point){row.className='build-job';row.title='Focus this worksite';row.addEventListener('click',()=>{this.actions.focus(point);this.close();});}jobs.append(row);};
    for(const f of state.living!.facilities.filter(f=>f.garrisonId===g?.id&&f.progress<1)){
      const t=state.trenches.find(t=>t.id===f.connectorId);
      add(SUPPORT_WORKS[f.kind].name,!assigned.length?'Waiting for assigned engineers':!f.paid?`Waiting for material carrier · ${f.materialCost} materials`:t&&t.progress<1?`Digging connector · ${Math.round(t.progress*100)}%`:`Building · ${Math.round(f.progress*100)}%`,f);
    }
    const ids=new Set(teams.map(q=>q.id));
    for(const t of state.trenches.filter(t=>t.status!=='complete'&&ids.has(t.engineerSquadId!))){const q=teams.find(q=>q.id===t.engineerSquadId)!;add(`Trench ${t.id}`,q.order.trenchId===t.id?constructionStatus(state,q)??`${Math.round(t.progress*100)}% excavated · paused`:`${Math.round(t.progress*100)}% excavated · queued or paused`,t.points[Math.floor(t.points.length/2)]);}
    if(!jobs.childElementCount)add('No unfinished works','Draw a trench or choose a support structure above.');
    if(state.simSpeed===0)add('SIMULATION PAUSED','Plans can be placed now. Press Space or 1× for crews to work.');
  }
}
