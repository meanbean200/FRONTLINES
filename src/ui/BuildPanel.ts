import type {BattlefieldState,Vec2} from '../core/types';
import type {Facility} from '../garrison/types';
import {SUPPORT_WORKS,selectedConstructionNetwork} from '../construction/ConstructionReadout';
import {localInventory} from '../garrison/Inventory';
import {fieldIcon} from './FieldSymbols';
import {connectedName,networkRepresentatives} from './TrenchReadout';
import {friendlyTrenches} from './TrenchReadout';
import type {TrenchNetwork} from '../garrison/TrenchNetwork';
import {squadHasEquipment} from '../combat/Equipment';

interface BuildActions {manage:(id?:number)=>void;place:(id:number,kind:Facility['kind'],guns?:1|4)=>void;assign:(id?:number)=>void;focus:(point:Vec2)=>void}
/** Contextual construction choices. Opening never changes orders or inventories. */
export class BuildPanel {
  readonly element=document.createElement('section');
  private readonly button=document.createElement('button');
  private networkId=0;
  private last=0;
  constructor(private getState:()=>BattlefieldState,private actions:BuildActions,private selected:()=>ReadonlySet<number>=()=>new Set(),private trenchNetwork?:TrenchNetwork){
    const root=document.querySelector<HTMLElement>('#ui-root')!;
    this.button.id='build-command';this.button.innerHTML=fieldIcon('engineer')+'Build';this.button.setAttribute('aria-controls','build-panel');this.button.setAttribute('aria-expanded','false');
    root.querySelector('.selection-context')!.append(this.button);
    this.element.id='build-panel';this.element.className='build-panel';this.element.hidden=true;this.element.setAttribute('aria-label','Engineer construction');
    this.element.innerHTML=`<header><div><small>ENGINEERING</small><h2>Build</h2></div><button data-build-close aria-label="Close construction">×</button></header><div class="build-categories"><div class="build-trench"></div><button data-build-category="support">${fieldIcon('force')}<span><strong>Support structures</strong><small>Supply, shelter and casualty care</small></span></button><button data-build-category="jobs">${fieldIcon('resume')}<span><strong>Worksites</strong><small>Inspect queued and active construction</small></span></button></div><section class="build-context" data-build-page="support" hidden><button data-build-back>← Construction</button><h3>Support structures</h3><label>Trench network<select id="build-network" aria-label="Construction network"></select></label><p class="build-workforce"></p><button id="assign-builders">Assign builders to this network</button><div class="build-catalog">${Object.entries(SUPPORT_WORKS).map(([kind,work])=>`<button data-build-kind="${kind}"><strong>${work.name}</strong><small>${work.cost} materials · ${work.description}</small></button>`).join('')}</div><p class="build-supply"></p></section>`;
    root.append(this.element);this.element.querySelector('.build-trench')!.append(root.querySelector('#trench-command')!);
    this.button.onclick=()=>this.element.hidden?this.open():this.close();
    this.element.querySelector('[data-build-close]')!.addEventListener('click',()=>this.close());
    this.element.querySelector('#trench-command')!.addEventListener('click',()=>this.close());
    const weapons=document.createElement('button');weapons.dataset.buildCategory='weapons';weapons.innerHTML=fieldIcon('defend')+'<span><strong>Weapon position</strong><small>Mounted MG, field gun or four-gun battery</small></span>';this.element.querySelector('.build-trench')!.after(weapons);
    const battery=document.createElement('button');battery.dataset.buildKind='mortar';battery.dataset.guns='4';battery.innerHTML='<strong>Four-gun artillery battery</strong><small>128 materials · 4 separate guns · 8 crew · 12 m spacing</small>';this.element.querySelector('.build-catalog')!.append(battery);
    const page=(value?:string)=>{this.element.querySelector<HTMLElement>('.build-categories')!.hidden=Boolean(value);for(const el of this.element.querySelectorAll<HTMLElement>('[data-build-page]'))el.hidden=el.dataset.buildPage!==(value==='weapons'?'support':value);this.element.querySelector('[data-build-page="support"] h3')!.textContent=value==='weapons'?'Weapon position':'Support structures';for(const b of this.element.querySelectorAll<HTMLElement>('[data-build-kind]'))b.hidden=value==='weapons'?!['emplacement','mortar'].includes(b.dataset.buildKind!):value==='support'?['emplacement','mortar'].includes(b.dataset.buildKind!):false;};
    this.element.querySelectorAll<HTMLButtonElement>('[data-build-category]').forEach(b=>b.onclick=()=>{if(b.dataset.buildCategory==='jobs'){const g=this.getState().living!.garrisons.find(g=>g.id===this.networkId);this.close();this.actions.manage(g?.trenchId??(this.networkId<0?-this.networkId:undefined));}else page(b.dataset.buildCategory);});
    this.element.querySelectorAll<HTMLButtonElement>('[data-build-back]').forEach(b=>b.onclick=()=>page());
    this.element.querySelector('#build-network')!.addEventListener('change',e=>{this.networkId=Number((e.target as HTMLSelectElement).value);this.update(true);});
    this.element.querySelector('#assign-builders')!.addEventListener('click',()=>{this.actions.assign(this.networkId||undefined);this.update(true);});
    this.element.querySelectorAll<HTMLButtonElement>('[data-build-kind]').forEach(b=>b.onclick=()=>{this.actions.place(this.networkId,b.dataset.buildKind as Facility['kind'],b.dataset.guns==='4'?4:1);this.close();});
    window.addEventListener('frontlines-menu',()=>this.close());
    root.querySelectorAll('[data-hud-panel]').forEach(b=>b.addEventListener('click',()=>this.close()));
    window.addEventListener('keydown',e=>{if(!this.element.hidden&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();}},true);
  }
  open(id?:number,support=false,weapons=false):void{
    window.dispatchEvent(new Event('frontlines-menu'));
    document.querySelectorAll<HTMLDetailsElement>('.garrison-panel,.support-controls').forEach(p=>p.open=false);
    this.networkId=id??selectedConstructionNetwork(this.getState(),this.selected(),this.networkId)??0;
    this.element.querySelector<HTMLElement>('.build-categories')!.hidden=support;for(const el of this.element.querySelectorAll<HTMLElement>('[data-build-page]'))el.hidden=!(support&&el.dataset.buildPage==='support');
    this.element.querySelector('[data-build-page="support"] h3')!.textContent=weapons?'Weapon positions':'Support structures';
    const catalog=this.element.querySelector('.build-catalog')!;
    const kinds=Object.keys(SUPPORT_WORKS);if(weapons)kinds.sort((a,b)=>Number(['emplacement','mortar'].includes(b))-Number(['emplacement','mortar'].includes(a)));
    for(const kind of kinds)catalog.append(catalog.querySelector(`[data-build-kind="${kind}"]`)!);
    for(const b of catalog.querySelectorAll<HTMLElement>('[data-build-kind]'))b.hidden=support&&(weapons?!['emplacement','mortar'].includes(b.dataset.buildKind!):['emplacement','mortar'].includes(b.dataset.buildKind!));
    this.element.hidden=false;this.element.scrollTop=0;this.button.setAttribute('aria-expanded','true');this.button.classList.add('active');document.documentElement.dataset.buildOpen='true';this.update(true);
  }
  close():void{this.element.hidden=true;this.button.setAttribute('aria-expanded','false');this.button.classList.remove('active');delete document.documentElement.dataset.buildOpen;}
  update(force=false):void{
    const state=this.getState(),locked=Boolean(document.documentElement.dataset.replay||document.documentElement.dataset.menu||document.documentElement.dataset.help||state.operation&&state.operation.status!=='active');
    this.button.disabled=locked;
    this.button.hidden=!state.squads.some(q=>this.selected().has(q.id)&&squadHasEquipment(state,q,'tools'));
    if(this.element.hidden||!force&&performance.now()-this.last<250)return;this.last=performance.now();
    const networks=this.trenchNetwork?networkRepresentatives(friendlyTrenches(state,this.trenchNetwork).filter(t=>this.trenchNetwork!.component(t.id)!==undefined),this.trenchNetwork).map(t=>{const g=state.living!.garrisons.find(g=>this.trenchNetwork!.component(g.trenchId)===this.trenchNetwork!.component(t.id));return {id:g?.id??-t.id,trenchId:t.id,name:connectedName(state,this.trenchNetwork!,t.id)};}):state.living!.garrisons.filter(g=>g.faction!=='enemy'),select=this.element.querySelector<HTMLSelectElement>('#build-network')!;
    if(!networks.some(g=>g.id===this.networkId))this.networkId=networks[0]?.id??0;
    const key=networks.map(g=>g.id+g.name).join('|');
    if(select.dataset.key!==key){select.dataset.key=key;select.replaceChildren();if(!networks.length)select.add(new Option('No excavated friendly trench yet','0'));for(const g of networks)select.add(new Option(g.name,String(g.id)));}
    select.value=String(this.networkId);select.disabled=locked||!networks.length;
    const network=networks.find(g=>g.id===this.networkId),g=state.living!.garrisons.find(g=>g.id===network?.id);
    const workforce=this.element.querySelector('.build-workforce')!;
    workforce.textContent=!network?'Draw a trench and excavate usable floor first.':'Choose a position. Available local workers are assigned individually.';
    this.element.querySelector<HTMLButtonElement>('#assign-builders')!.hidden=true;
    for(const b of this.element.querySelectorAll<HTMLButtonElement>('[data-build-kind]')){b.disabled=locked||!network||g?.cutoff==='withdraw';b.title=b.disabled?'Choose excavated friendly trench first.':'Place a work order; inspect it for workers and delivered materials.';}
    const materials=g?localInventory(state,g).materials:0;
    this.element.querySelector('.build-supply')!.textContent=`${Math.floor(materials)} materials in local stores · shortages wait for physical delivery.`;
  }
}
