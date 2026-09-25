import type {BattlefieldState,Vec2} from '../core/types';
import {SANDBOX_PERSONNEL_LIMIT,type DeploymentKind} from '../simulation/SandboxDeployment';
import {fieldIcon} from './FieldSymbols';
import {requestReserveSquad,reserveDispatchAt} from '../operations/Replacements';
import {trenchName} from './TrenchReadout';

/** Normal player controls, separate from the developer stress fixture. */
export class DeploymentPanel {
  private readonly element=document.createElement('section');
  private readonly button=document.createElement('button');
  private last='';
  private manifestKey='';
  get showRoutes(){return !this.element.hidden;}
  constructor(private getState:()=>BattlefieldState,private place:(kind:DeploymentKind,count:number)=>void,private focus:(point:Vec2)=>void=()=>{},private notify:(text:string)=>void=()=>{}){
    const root=document.querySelector<HTMLElement>('#ui-root')!;
    this.button.id='deployment-command';this.button.setAttribute('aria-controls','deployment-panel');this.button.setAttribute('aria-expanded','false');root.querySelector('.battle-tools')!.prepend(this.button);
    this.element.id='deployment-panel';this.element.className='deployment-panel';this.element.hidden=true;this.element.setAttribute('aria-label','Troop deployment');
    this.element.innerHTML='<header><h2>Troop deployment</h2><button aria-label="Close troop deployment">×</button></header><p class="deployment-status"></p><div class="deployment-choices"><label>Squads per placement<select aria-label="Squads per placement"><option value="1">1 squad · 8 personnel</option><option value="3">3 squads · 24 personnel</option><option value="5">5 squads · 40 personnel</option></select></label><button data-deploy="rifle">Rifle squad <small>Move, hold and defend trenches</small></button><button data-deploy="engineer">Engineer team <small>Dig trenches and build support works</small></button><p>Choose a team, then click clear ground. Repeat to add more; Esc finishes. New troops carry finite rations and ammunition. This peaceful sandbox has no enemy combat.</p></div>';
    root.append(this.element);
    const reinforcements=document.createElement('div');reinforcements.className='reinforcement-orders';
    reinforcements.innerHTML='<h3>Request transport</h3><label>Arrival trench<select aria-label="Reinforcement arrival trench"></select></label><button data-request-reserves>Request rifle squad · 8 personnel</button><p class="dispatch-reason"></p><p>Finite reserve pool. Up to 8 new personnel per campaign day, shared with casualty replacements. The next available truck collects them, transfers at the rear depot, then delivers them to this trench’s roadhead.</p><h3>Passenger movements</h3><div class="passenger-manifests"></div>';
    this.element.append(reinforcements);
    reinforcements.querySelector('[data-request-reserves]')!.addEventListener('click',()=>{if(this.button.disabled)return;const result=requestReserveSquad(this.getState(),Number(reinforcements.querySelector('select')!.value));this.notify(result.reason);this.manifestKey='';this.update();});
    this.button.onclick=()=>{if(!this.element.hidden){this.close();return;}window.dispatchEvent(new Event('frontlines-menu'));this.element.hidden=false;this.button.setAttribute('aria-expanded','true');this.update();};
    this.element.querySelector('header button')!.addEventListener('click',()=>this.close());
    this.element.querySelectorAll<HTMLButtonElement>('[data-deploy]').forEach(b=>b.onclick=()=>{const count=Number(this.element.querySelector('select')!.value);this.close();this.place(b.dataset.deploy as DeploymentKind,count);});
    window.addEventListener('frontlines-menu',()=>this.close());
    root.querySelectorAll('[data-hud-panel],#build-command,#support-command,#defense-toggle').forEach(b=>b.addEventListener('click',()=>this.close()));
    window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!this.element.hidden){this.close();e.preventDefault();e.stopImmediatePropagation();}},true);
  }
  private close(){this.element.hidden=true;this.button.setAttribute('aria-expanded','false');}
  update(){
    const state=this.getState(),op=state.operation,pool=op?.campaign?.replacements;
    this.button.disabled=Boolean(document.documentElement.dataset.replay||document.documentElement.dataset.help||op&&op.status!=='active');
    const label=op?'Reinforcements':'Add troops';if(this.button.dataset.label!==label){this.button.dataset.label=label;this.button.innerHTML=fieldIcon('force')+label;}
    if(this.element.hidden)return;
    this.element.querySelector('h2')!.textContent=op?'Reinforcements':'Troop deployment';
    const text=!op?`${state.soldiers.length} / ${SANDBOX_PERSONNEL_LIMIT} personnel on the map. Place squads directly in Sandbox.`:pool?`${pool.reserve.player} personnel in reserve · ${pool.manifests.filter(m=>m.side==='player'&&m.stage!=='arrived').length} passengers awaiting arrival.`:'Finite-force operation: no mid-battle reinforcements. Choose Open Front for a persistent campaign with truck-delivered reserves, or Sandbox to place troops freely.';
    if(text!==this.last){this.last=text;this.element.querySelector('.deployment-status')!.textContent=text;}
    this.element.querySelector<HTMLElement>('.deployment-choices')!.hidden=Boolean(op);
    const section=this.element.querySelector<HTMLElement>('.reinforcement-orders')!;section.hidden=!pool;if(!pool)return;
    const w=state.living!,select=section.querySelector<HTMLSelectElement>('select')!,networks=w.garrisons.filter(g=>g.faction!=='enemy'&&g.cutoff!=='withdraw'&&g.squadIds.length);
    const networkKey=networks.map(g=>g.id+g.name).join('|');
    if(select.dataset.key!==networkKey){const chosen=select.value;select.dataset.key=networkKey;select.replaceChildren();for(const g of networks)select.add(new Option(`${trenchName(state,g.trenchId)} · ${g.name}`,String(g.id)));if(!networks.length)select.add(new Option('Assign a formation to a completed trench','0'));if([...select.options].some(o=>o.value===chosen))select.value=chosen;}
    const delay=Math.max(0,reserveDispatchAt(pool,'player')-w.campaignHours),request=section.querySelector<HTMLButtonElement>('[data-request-reserves]')!;
    request.disabled=this.button.disabled||pool.reserve.player<8||!networks.length||delay>0;
    section.querySelector('.dispatch-reason')!.textContent=delay?`Next dispatch in ${delay.toFixed(1)} campaign hours.`:pool.reserve.player<8?'Fewer than 8 reserve personnel remain. Remaining reserves replace losses automatically.':!networks.length?'Defend a completed trench first to establish a safe arrival area.':'Dispatch available · request uses 8 reserve personnel.';
    const key=JSON.stringify([pool.manifests.filter(m=>m.side==='player').map(m=>[m.id,m.stage,m.truckId,m.garrisonId]),w.trucks.filter(t=>t.faction!=='enemy').map(t=>[t.id,t.state,t.reason]),Math.floor(state.elapsed/5)]);
    if(key===this.manifestKey)return;this.manifestKey=key;
    const list=section.querySelector('.passenger-manifests')!;list.replaceChildren();
    const groups=new Map<string,typeof pool.manifests>();
    for(const m of pool.manifests.filter(m=>m.side==='player'&&(m.stage!=='arrived'||w.campaignHours-(m.arrivedAt??0)<24))){const key=`${m.squadId}:${m.stage}:${m.truckId??0}`;groups.set(key,[...(groups.get(key)??[]),m]);}
    for(const manifests of groups.values()){
      const m=manifests[0],truck=w.trucks.find(t=>t.id===m.truckId),g=w.garrisons.find(g=>g.squadIds.includes(m.squadId)),q=state.squads.find(q=>q.id===m.squadId);
      const row=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('p'),locate=document.createElement('button');row.className='passenger-row';
      name.textContent=`${q?.name??'Formation'} · ${manifests.length} ${m.returning?'returning personnel':'personnel'}`;
      const inbound=w.trucks.find(t=>t.role==='convoy'&&t.faction!=='enemy');
      detail.textContent=m.stage==='edge'?inbound?.state==='loading'?'Boarding available convoy when simulation runs':`Awaiting returning convoy · ${inbound?.reason??'no transport'}`:m.stage==='rear'?g?'Rear depot · waiting for a shuttle truck':'Rear depot · assign this formation to a trench before delivery':m.stage==='arrived'?'Unloaded · joining the trench on foot':`Truck ${truck?.id} · ${m.stage==='convoy'?'to rear depot':'to '+(g?trenchName(state,g.trenchId):'arrival area')} · ${truck?.reason??'transport unavailable'}`;
      locate.textContent=truck?'Locate truck':m.stage==='arrived'?'Locate arrival area':'Locate waiting point';
      locate.onclick=()=>{const liveTruck=this.getState().living!.trucks.find(t=>t.id===m.truckId);this.focus(liveTruck??(m.stage==='arrived'?g?.forward: m.stage==='edge'?w.entry:w.rear)??w.rear);};row.append(name,detail,locate);list.append(row);
    }
    if(!groups.size)list.textContent='No passengers waiting. Request a squad above; casualties are also replaced automatically when the daily release is due.';
  }
}
