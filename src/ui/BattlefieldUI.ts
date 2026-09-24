import type { BattlefieldState, DebugFlags } from '../core/types';
import type { InteractionMode } from '../input/CommandInput';
import { factionOf } from '../operations/types';
import { blocksGameplayKey } from '../input/GameplayKeys';
import { relocationProgress, withdrawalProgress } from './GarrisonReadout';
import {fieldIcon} from './FieldSymbols';
import {selectionReadout,roleName} from './FieldReadout';

export interface PerfSnapshot {fps:number;frameMs:number;simulationMs:number;drawCalls:number;chunks:number;p95Ms?:number}
interface UIActions {
  setSpeed:(speed:number)=>void;hold:()=>void;occupy:()=>void;trenchMode:()=>void;moveMode:()=>void;craterMode:()=>void;
  save:()=>void;load:()=>void;stress:()=>void;select:(ids:number[],add?:boolean)=>void;focus:(id?:number)=>void;
  setDebug:(key:keyof DebugFlags,value:boolean)=>void;
  resume:()=>void;quality:(level:string)=>void;
  tactical?:(mode:'observe'|'suppress'|'assault'|'fall-back')=>void;pushThrough?:()=>void;
  support?:(kind:'mortarHE'|'mortarSmoke'|'smokeGrenades')=>void;
  buildingFloor?:(floor:0|1)=>void;
  mute?:(muted:boolean)=>void;
}
const escape=(s:string):string=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export class BattlefieldUI {
  private readonly root=document.querySelector<HTMLElement>('#ui-root')!;
  private lastRender=0;
  private rosterSize=-1;
  private toastTimer=0;
  private supportKey='';
  private selectionKey='';
  constructor(private state:BattlefieldState,private readonly selected:Set<number>,private readonly flags:DebugFlags,private readonly actions:UIActions){
    this.root.innerHTML=this.template();this.bind();
    const dock=this.root.querySelector('.command-dock > div')!;
    for(const [mode,label] of [['observe','Observe'],['suppress','Suppress'],['assault','Assault'],['fall-back','Withdraw']] as const){const b=document.createElement('button');b.innerHTML=fieldIcon(mode)+label;b.dataset.tactical=mode;b.title=mode==='suppress'?'Suppress a reported area; consumes real ammunition':mode==='fall-back'?'Draw a withdrawal route':mode==='observe'?'Face and observe a position':'Draw an assault route';b.addEventListener('click',()=>{if(!document.documentElement.dataset.replay&&!document.documentElement.dataset.help)this.actions.tactical?.(mode);});dock.append(b);}
    const push=document.createElement('button');push.textContent='Push through';push.dataset.tactical='push';push.title='Accept exposure on this order. Does not override pinning or incapacitation.';push.addEventListener('click',()=>{if(!document.documentElement.dataset.replay&&!document.documentElement.dataset.help)this.actions.pushThrough?.();});dock.append(push);
    const context=document.createElement('div');context.className='selection-actions';this.root.querySelector('.selection-card')!.append(context);
    context.append(this.root.querySelector('#resume-command')!);context.append(push);
    this.root.querySelector('#move-command')!.innerHTML=fieldIcon('move')+'Move <kbd>M</kbd>';
    this.root.querySelector('#hold-command')!.innerHTML=fieldIcon('hold')+'Hold <kbd>H</kbd>';
    this.root.querySelector('#hold-command')!.setAttribute('title','Hold position and cancel movement [H]');
    this.root.querySelector('#trench-command')!.innerHTML=fieldIcon('engineer')+'Plot trench <kbd>B</kbd>';
    this.root.querySelector('#resume-command')!.innerHTML=fieldIcon('resume')+'Resume works';
    this.root.querySelector('#focus-command')!.innerHTML=fieldIcon('focus');
    push.innerHTML=fieldIcon('push')+'Push through';
    const support=document.createElement('details');support.className='support-controls';support.innerHTML='<summary>Support & rescue</summary><div></div>';this.root.append(support);
    for(const [kind,label] of [['mortarHE','Mortar HE'],['mortarSmoke','Mortar smoke'],['smokeGrenades','Throw smoke']] as const){const b=document.createElement('button');b.dataset.support=kind;b.textContent=label;b.addEventListener('click',()=>{if(!document.documentElement.dataset.replay&&!document.documentElement.dataset.help)this.actions.support?.(kind);});support.querySelector('div')!.append(b);}
    const missions=document.createElement('div');missions.className='support-status';support.append(missions);
    const sound=document.createElement('label');sound.innerHTML='<input type="checkbox" id="mute-combat"> Mute combat sounds';support.append(sound);sound.querySelector('input')!.addEventListener('change',e=>this.actions.mute?.((e.target as HTMLInputElement).checked));
    const defend=this.root.querySelector<HTMLButtonElement>('#occupy-command')!;
    defend.innerHTML=fieldIcon('defend')+'Defend <kbd>T</kbd>';
    defend.title='Draw a frontage near completed trenches, then choose facing in the area inspector. Click a trench label for quick assignment.';
  }
  replaceState(state:BattlefieldState):void{this.state=state;this.rosterSize=-1;this.selectionKey='';this.supportKey='';}
  setQuality(level:string):void{this.root.querySelector<HTMLSelectElement>('#quality')!.value=level;}
  render(now:number,perf:PerfSnapshot,mode:InteractionMode):void{
    if(now-this.lastRender<100)return;this.lastRender=now;
    const hours=this.state.living?.campaignHours??0;
    const reviewing=Boolean(document.documentElement.dataset.replay);
    const ended=Boolean(this.state.operation&&this.state.operation.status!=='active'),locked=reviewing||ended;
    const time=`D${Math.floor(hours/24)+1} ${Math.floor(hours%24).toString().padStart(2,'0')}:${Math.floor(hours*60%60).toString().padStart(2,'0')}`;
    this.root.querySelector('#battle-time')!.textContent=time;
    const friendlies=new Set(this.state.squads.filter(s=>factionOf(s)==='player').map(s=>s.id));
    this.root.querySelector('#unit-count')!.textContent=`${this.state.soldiers.filter(s=>friendlies.has(s.squadId)&&s.needs?.life!=='dead').length} personnel · ${friendlies.size} squads`;
    this.root.querySelector('.brand small')!.textContent=this.state.operation?'TACTICAL OPERATIONS':'LIVING BATTLEFIELD';
    this.root.querySelector('#perf-readout')!.textContent=`${perf.fps.toFixed(0)} FPS · CPU ${perf.frameMs.toFixed(1)} ms · p95 ${(perf.p95Ms??0).toFixed(1)} ms · sim ${perf.simulationMs.toFixed(2)} ms · ${perf.drawCalls} draws`;
    const label=this.root.querySelector<HTMLElement>('#mode-label')!;
    label.textContent=mode==='trench'?'DRAW TRENCH · center-out crews · branches split · Esc cancels':mode==='crater'?'TEST IMPACT · click the ground · Esc cancels':mode==='move'?'DRAW PATH · drag your exact route · Shift appends · Esc cancels':'Right-drag a path · left-drag selects · Shift adds / appends';
    label.dataset.mode=mode;
    if(mode==='facility')label.textContent='PLACE SUPPORT WORKS · click 6–40m behind the trench · Esc / right-click cancels';
    if(mode==='defend')label.textContent='DEFEND AREA · draw frontage near completed trenches · then choose facing';
    if(['observe','suppress','assault','fall-back'].includes(mode))label.textContent=`${mode.toUpperCase()} · ${mode==='assault'||mode==='fall-back'?'draw your route or click a position':'click a world position'} · Esc cancels`;
    if(['mortarHE','mortarSmoke','smokeGrenades'].includes(mode))label.textContent=`${mode} · click target area · explosives can injure allies`;
    if(reviewing)label.textContent='REPLAY REVIEW · recorded snapshots · campaign paused';
    else if(ended)label.textContent='OPERATION COMPLETE · inspect the sector or choose a new operation in MENU';
    this.renderRoster();this.renderSelection();
    const pendingDecision=this.state.living?.garrisons.some(g=>g.cutoff==='decision');
    for(const button of this.root.querySelectorAll<HTMLButtonElement>('[data-speed]')){button.classList.toggle('active',Number(button.dataset.speed)===this.state.simSpeed);button.disabled=locked||Boolean(pendingDecision);}
    for(const id of ['hold-command','move-command','occupy-command'])this.root.querySelector<HTMLButtonElement>('#'+id)!.disabled=locked||this.selected.size===0;
    for(const b of this.root.querySelectorAll<HTMLButtonElement>('[data-tactical]')){b.disabled=locked||!this.selected.size;b.classList.toggle('active',b.dataset.tactical===mode||b.dataset.tactical==='push'&&this.state.squads.some(q=>this.selected.has(q.id)&&q.order.pushThrough));}
    this.root.querySelector('#occupy-command')!.classList.toggle('active',mode==='defend');
    for(const b of this.root.querySelectorAll<HTMLButtonElement>('.command-dock button,[data-tactical],[data-support]'))b.setAttribute('aria-pressed',String(b.classList.contains('active')));
    const support=this.root.querySelector<HTMLDetailsElement>('.support-controls')!;support.hidden=!this.state.operation?.supportRules;
    for(const b of support.querySelectorAll<HTMLButtonElement>('[data-support]'))b.disabled=locked||!this.selected.size;
    const replacements=this.state.operation?.campaign?.replacements;
    const supportKey=JSON.stringify([locked,this.state.operation?.supportMissions?.map(m=>[m.id,m.reason]),this.state.operation?.rescueDecisions,replacements?.reserve.player,replacements?.manifests.length,replacements?.manifests.filter(m=>m.side==='player'&&m.stage!=='arrived').length,Math.floor(hours*10)]);
    if(support.open&&supportKey!==this.supportKey){this.supportKey=supportKey;const status=support.querySelector('.support-status')!;status.replaceChildren();
      for(const mission of this.state.operation?.supportMissions?.filter(m=>this.state.squads.some(q=>q.id===m.squadId&&factionOf(q)==='player')).slice(-3)??[]){const p=document.createElement('p');p.textContent=`${mission.kind}: ${mission.reason}`;status.append(p);}
      for(const decision of this.state.operation?.rescueDecisions?.filter(d=>d.side==='player'&&d.choice==='pending')??[]){const row=document.createElement('div'),p=document.createElement('p');p.textContent=`Soldier ${decision.patientId}: ${decision.reason}`;row.append(p);for(const [choice,label] of [['approved',decision.reason.startsWith('Casualty route blocked')?'Retry rescue':'Accept rescue risk'],['hold','Wait for safety']] as const){const b=document.createElement('button');b.textContent=label;b.disabled=locked;b.onclick=()=>{if(locked)return;decision.choice=choice;decision.reviewAt=this.state.elapsed+30;};row.append(b);}status.append(row);}
      if(replacements){const p=document.createElement('p');p.textContent=`Reserve ${replacements.reserve.player}/48 · ${replacements.manifests.filter(m=>m.side==='player'&&m.stage!=='arrived').length} in transit · next release in ${Math.max(0,replacements.nextAt.player-hours).toFixed(1)} campaign hours`;status.append(p);}
    }
    support.querySelector('summary')!.textContent=this.state.operation?.rescueDecisions?.some(d=>d.side==='player'&&d.choice==='pending')?'Rescue decision needed':'Support & rescue';
    for(const id of ['trench-command','crater-command','stress-command'])this.root.querySelector<HTMLButtonElement>('#'+id)!.disabled=locked;
    this.root.querySelector('#trench-command')!.classList.toggle('active',mode==='trench');
    this.root.querySelector('#move-command')!.classList.toggle('active',mode==='move');
    this.root.querySelector<HTMLButtonElement>('#resume-command')!.disabled=locked||!this.state.squads.some(s=>this.selected.has(s.id)&&s.kind==='engineer');
    this.root.querySelector<HTMLElement>('#resume-command')!.hidden=!this.state.squads.some(q=>this.selected.has(q.id)&&q.kind==='engineer');
    this.root.querySelector<HTMLElement>('.selection-actions')!.hidden=!this.selected.size;
    {const button=this.root.querySelector<HTMLElement>('[data-tactical="push"]')!;button.hidden=!this.state.squads.some(q=>this.selected.has(q.id)&&q.order.type==='move');}
  }
  notify(message:string,tone:'normal'|'warn'='normal'):void{
    const toast=this.root.querySelector<HTMLElement>('#toast')!;toast.textContent=message;toast.dataset.tone=tone;toast.classList.add('show');
    window.clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>toast.classList.remove('show'),3500);
  }
  private renderRoster():void{
    if(this.rosterSize!==this.state.squads.length){
      this.rosterSize=this.state.squads.length;
      const rows=(kind:string)=>this.state.squads.filter(s=>(kind==='rifle'?s.kind!=='engineer':s.kind===kind)&&factionOf(s)==='player').map(s=>`<button class="roster-row ${kind}" data-squad="${s.id}" title="${roleName[s.kind]} · select ${escape(s.name)}; double-click to focus"><i>${fieldIcon(s.kind)}</i><span>${escape(s.name)}</span><small>${s.soldierIds.length}</small></button>`).join('');
      this.root.querySelector('#rifle-roster')!.innerHTML=rows('rifle');this.root.querySelector('#engineer-roster')!.innerHTML=rows('engineer');
      this.root.querySelectorAll<HTMLButtonElement>('[data-squad]').forEach(b=>{b.addEventListener('click',e=>this.actions.select([Number(b.dataset.squad)],e.shiftKey));b.addEventListener('dblclick',()=>this.actions.focus(Number(b.dataset.squad)));});
    }
    const counts=new Map<number,number>();for(const s of this.state.soldiers)if(s.needs?.life!=='dead'&&s.needs?.life!=='incapacitated')counts.set(s.squadId,(counts.get(s.squadId)??0)+1);
    for(const b of this.root.querySelectorAll<HTMLButtonElement>('[data-squad]')){const id=Number(b.dataset.squad);b.classList.toggle('selected',this.selected.has(id));const able=counts.get(id)??0;b.querySelector('small')!.textContent=String(able);b.classList.toggle('depleted',able===0);}
  }
  private renderSelection():void{
    const squads=this.state.squads.filter(s=>this.selected.has(s.id));
    const panel=this.root.querySelector('#selection-detail')!,debug=this.root.querySelector('#debug-selection')!;
    const readout=selectionReadout(this.state,this.selected),docket=this.root.querySelector<HTMLButtonElement>('#selection-docket')!;
    docket.hidden=!readout;
    if(readout){
      const text=JSON.stringify([readout.name,readout.kind,readout.role,readout.able,readout.total,readout.order,readout.warning]);
      if(docket.dataset.readout!==text){docket.dataset.readout=text;docket.innerHTML=`${fieldIcon(readout.kind)}<div><small>${escape(readout.role)}</small><strong>${escape(readout.name)}</strong><span><b>${readout.able} / ${readout.total}</b> able personnel</span><span class="docket-order">${escape(readout.order)} · Report ↗</span>${readout.warning?`<span class="formation-warning">${escape(readout.warning)}</span>`:''}</div>`;}
    }
    if(!squads.length){this.selectionKey='';panel.innerHTML='<small>FIELD COMMAND</small><strong>Select your force</strong><p>Click a squad flag or an engineer team.</p>';debug.textContent='No squad selected';return;}
    const squad=squads[0],soldiers=this.state.soldiers.filter(s=>this.selected.has(s.squadId));
    const trench=this.state.trenches.find(t=>t.id===squad.order.trenchId);
    const living=soldiers.filter(s=>s.needs?.life!=='dead'),covers=living.filter(s=>s.cover==='trench').length;
    const garrison=this.state.living?.garrisons.find(g=>g.squadIds.includes(squad.id));
    const queued=squad.constructionQueue?.length??0;
    const command=garrison?.cutoff==='withdraw'?withdrawalProgress(garrison,living):relocationProgress(living)??squad.orderNote??(trench&&squad.order.type==='construct-trench'?`Excavating · ${Math.floor(trench.progress*100)}%${queued?` · ${queued} queued`:''}`:squad.order.type==='occupy-trench'?`${covers}/${living.length} sheltered · network ${this.state.soldiers.filter(s=>garrison&&s.garrisonId===garrison.id&&s.needs?.life!=='dead').length}/${garrison?.capacity??0}`:squad.movementState==='planning'?'Planning approach':squad.order.drawnPath?'Following drawn corridor':squad.order.type==='move'?'Moving to destination':'Holding position');
    const able=soldiers.filter(s=>s.needs?.life==='active');
    const key=JSON.stringify([readout,squads.map(q=>[q.id,q.order.building]),command,covers,Boolean(document.documentElement.dataset.replay),this.state.operation?.status]);
    debug.textContent=`ID ${squad.id} · ${squad.order.type}\n${squad.movementState} · route ${squad.routeIndex}/${squad.route.length}\nTrench ${squad.order.trenchId??'—'} · cover ${soldiers[0]?.cover}\n${squad.x.toFixed(0)}, ${squad.z.toFixed(0)}`;
    if(key===this.selectionKey)return;this.selectionKey=key;
    const r=readout!;
    panel.innerHTML=`<small>${escape(r.role).toUpperCase()} / FIELD REPORT</small><strong>${escape(r.name)}</strong><p>${escape(command)}</p><dl class="unit-ledger"><div><dt>Strength</dt><dd>${r.able} / ${r.total} able</dd></div><div><dt>Ammunition</dt><dd>${r.ammo} rounds</dd></div><div><dt>Morale</dt><dd>${r.morale} / 100</dd></div><div><dt>Fatigue</dt><dd>${r.fatigue} / 100</dd></div><div><dt>Suppression</dt><dd>${r.suppression}%<div class="unit-meter"><i style="width:${Math.min(100,r.suppression)}%"></i></div></dd></div><div><dt>Sheltered</dt><dd>${r.covered} / ${r.living}</dd></div><div class="wide"><dt>Activity</dt><dd>${escape(r.activity)}</dd></div><div class="wide"><dt>Position · sector metres</dt><dd>${r.position}</dd></div></dl>${trench&&squad.order.type==='construct-trench'?`<div class="progress"><i style="width:${trench.progress*100}%"></i></div>`:''}`;
    if(this.state.operation){
      const dead=soldiers.filter(s=>s.needs?.life==='dead').length,wounded=soldiers.filter(s=>s.needs?.life==='incapacitated').length,pinned=able.filter(s=>s.suppression>=70).length;
      const status=document.createElement('p');status.className=pinned?'combat-warning':'combat-status';
      status.textContent=`${pinned?`${pinned} PINNED · `:''}${wounded} down · ${dead} dead`;panel.append(status);
      const reasons=[...new Set(able.map(s=>s.combat?.pauseReason).filter(Boolean))];
      if(reasons.length){const explanation=document.createElement('p');explanation.textContent=reasons.slice(0,2).join(' · ');panel.append(explanation);}
    }
    if(squad.order.building){for(const [floor,label] of [[0,'Ground floor'],[1,'Upper floor']] as const){const b=document.createElement('button');b.textContent=label;b.onclick=()=>this.actions.buildingFloor?.(floor);panel.append(b);}}
    debug.textContent=`ID ${squad.id} · ${squad.order.type}\n${squad.movementState} · route ${squad.routeIndex}/${squad.route.length}\nTrench ${squad.order.trenchId??'—'} · cover ${soldiers[0]?.cover}\n${squad.x.toFixed(0)}, ${squad.z.toFixed(0)}`;
  }
  private bind():void{
    const commands=new Set(['hold-command','occupy-command','trench-command','move-command','resume-command','crater-command','stress-command']);
    const bind=(id:string,fn:()=>void)=>this.root.querySelector('#'+id)!.addEventListener('click',()=>{if((document.documentElement.dataset.replay||document.documentElement.dataset.help)&&commands.has(id))return;fn();});
    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b=>b.addEventListener('click',()=>{if(!document.documentElement.dataset.replay&&!document.documentElement.dataset.help)this.actions.setSpeed(Number(b.dataset.speed));}));
    bind('hold-command',this.actions.hold);bind('occupy-command',this.actions.occupy);bind('trench-command',this.actions.trenchMode);bind('move-command',this.actions.moveMode);
    bind('resume-command',this.actions.resume);
    this.root.querySelector<HTMLSelectElement>('#quality')!.addEventListener('change',e=>this.actions.quality((e.target as HTMLSelectElement).value));
    bind('crater-command',this.actions.craterMode);bind('save-command',this.actions.save);bind('load-command',this.actions.load);bind('stress-command',this.actions.stress);
    bind('focus-command',()=>this.actions.focus());
    bind('debug-toggle',()=>this.root.querySelector('#debug-panel')!.classList.toggle('open'));
    const help=(open:boolean)=>{this.root.querySelector('#controls-drawer')!.classList.toggle('open',open);if(open){document.documentElement.dataset.help='open';window.dispatchEvent(new Event('frontlines-menu'));this.root.querySelector<HTMLButtonElement>('#help-close')!.focus();}else delete document.documentElement.dataset.help;};
    bind('help-toggle',()=>help(!document.documentElement.dataset.help));
    bind('help-close',()=>help(false));
    bind('rifle-select',()=>this.actions.select(this.state.squads.filter(s=>s.kind==='rifle'&&factionOf(s)==='player').map(s=>s.id)));
    this.root.querySelectorAll<HTMLInputElement>('[data-debug]').forEach(input=>{input.checked=this.flags[input.dataset.debug as keyof DebugFlags];input.addEventListener('change',()=>this.actions.setDebug(input.dataset.debug as keyof DebugFlags,input.checked));});
    window.addEventListener('keydown',e=>{
      if(document.documentElement.dataset.menu||document.documentElement.dataset.fieldMap)return;
      if(document.documentElement.dataset.help){if(e.code==='Escape'){help(false);e.preventDefault();}return;}
      if(this.state.operation&&this.state.operation.status!=='active'&&e.code!=='KeyF')return;
      if(blocksGameplayKey(e)||e.repeat)return;
      if(document.documentElement.dataset.replay&&e.code!=='KeyF')return;
      if(e.code==='Space'){e.preventDefault();this.actions.setSpeed(this.state.simSpeed===0?1:0);}
      if(e.code==='KeyB')this.actions.trenchMode();if(e.code==='KeyC')this.actions.craterMode();if(e.code==='KeyF')this.actions.focus();
      if(e.code==='KeyH')this.actions.hold();if(e.code==='KeyT')this.actions.occupy();if(e.code==='KeyR')this.actions.resume();if(e.code==='KeyM')this.actions.moveMode();
    });
  }
  private template():string{return `
    <header class="brand"><div class="brand-emblem">F<span>Ⅰ</span></div><div><strong>FRONTLINES</strong><small>BATTLEFIELD SANDBOX</small></div></header>
    <div class="sector-heading"><small>WESTERN COUNTRYSIDE</small><span>Saint-Martin sector</span></div>
    <nav class="session-controls"><span id="battle-time">00:00</span><div class="sim-controls" aria-label="Simulation speed"><button data-speed="0" title="Pause [Space]">Ⅱ</button><button data-speed="1" class="active">1×</button><button data-speed="2">2×</button><button data-speed="5">5×</button></div><button id="save-command">Save</button><button id="load-command">Load</button><button id="help-toggle" title="Controls">?</button></nav>
    <nav class="hud-tools" aria-label="Battlefield panels"><button id="roster-toggle" data-hud-panel="force" aria-label="Your force" aria-expanded="false" aria-controls="force-roster">${fieldIcon('force')}Force</button><button data-hud-panel="selection" aria-label="Selected squad details" aria-expanded="false" aria-controls="selection-card">${fieldIcon('info')}Report</button><button data-hud-panel="map" aria-label="Tactical map" aria-expanded="false" aria-controls="map-panel">${fieldIcon('map')}Map</button></nav>
    <button id="selection-docket" class="selection-docket" data-hud-panel="selection" aria-label="Open selected formation report" aria-expanded="false" aria-controls="selection-card" hidden></button>
    <aside id="force-roster" class="force-roster"><div class="roster-heading"><small>YOUR FORCE</small><span id="unit-count"></span></div><button id="rifle-select" class="section-heading">INFANTRY <span>SELECT ALL ↗</span></button><div id="rifle-roster"></div><div class="section-heading engineers-title">ENGINEER TEAMS</div><div id="engineer-roster"></div><p class="roster-help">Double-click a squad to focus.<br>Shift-click to add to selection.</p></aside>
    <div class="mode-label" id="mode-label"></div>
    <section id="selection-card" class="selection-card"><div id="selection-detail"></div><button id="focus-command" title="Focus selected [F]">⌖</button></section>
    <nav class="command-dock" aria-label="Squad commands"><small>SQUAD ORDERS</small><div><button id="move-command"><span>↝</span>Draw path <kbd>M</kbd></button><button id="hold-command"><span>◈</span>Hold <kbd>H</kbd></button><button id="occupy-command"><span>⌁</span>Garrison <kbd>T</kbd></button><button id="trench-command" class="engineer-command"><span>⚒</span>Trench <kbd>B</kbd></button><button id="resume-command" title="Resume nearest unfinished works">Resume <kbd>R</kbd></button></div></nav>
    <aside id="map-panel" class="map-panel"><div><span>SECTOR MAP</span><button id="map-overview" aria-label="Toggle theater or local sector" title="Toggle theater / local sector">±</button><button id="map-expand" aria-label="Open operational map" title="Operational map [G]">${fieldIcon('map')}</button></div><canvas id="minimap" aria-label="Click tactical map to move camera"></canvas><footer><span id="map-scale">1.8 KM · SECTOR</span><span>N ↑</span></footer></aside>
    <button id="debug-toggle" class="debug-toggle">DEVELOPER / PERFORMANCE</button><aside id="debug-panel"><strong>Diagnostics</strong><label>Rendering <select id="quality"><option value="balanced">Balanced</option><option value="low">Performance</option><option value="high">High</option></select></label><pre id="debug-selection"></pre><div id="perf-readout"></div><label><input type="checkbox" data-debug="paths">Navigation paths</label><label><input type="checkbox" data-debug="destinations">Destinations</label><label><input type="checkbox" data-debug="chunks">Terrain wireframe</label><label><input type="checkbox" data-debug="trenchGraph">Trench routes</label><label><input type="checkbox" data-debug="trenchSlots">Usable trench frontage</label><div class="developer-actions"><button id="crater-command">Test crater [C]</button><button id="stress-command">Spawn 300</button></div></aside>
    <section id="controls-drawer"><button id="help-close">×</button><small>FIELD MANUAL</small><h2>Command the sector.</h2>
    <p>Click soldiers, flags or the roster. Left-drag selects several squads; Shift adds to selection. Right-drag a route for troops to follow in columns. M draws with the left button. Shift-drag appends. A short right-click issues a destination order. Esc cancels a drawing; H stops troops.</p>
    <dl><dt>WASD / arrows</dt><dd>Pan the battlefield</dd><dt>Shift</dt><dd>Move faster</dd><dt>Mouse wheel</dt><dd>Zoom</dd><dt>Middle drag / Q E</dt><dd>Rotate camera</dd><dt>F / double-click squad</dt><dd>Focus selected squad</dd><dt>G</dt><dd>Operational map · pauses play</dd><dt>Space</dt><dd>Pause simulation</dd></dl>
    <h3>Engineer works</h3><p>B draws a trench. Crews start near its middle or an existing junction, then dig outward. Draw connected branches to split the team; separate jobs stay queued. H or movement pauses all fronts; R resumes your unfinished works. Garrison engineers also build nearby rest, meal and supply dugouts using delivered materials.</p>
    <h3>Defend Area [T]</h3><p>A garrison means the people assigned to defend and live in a trench network. Select squads, then draw a frontage with T near completed trenches. Click a trench label for quick assignment. They enter by the nearest reachable point, then rotate guarding, rest, meals and carrying supplies. Nearby shots raise a combat alarm and wake fit troops. Move or Hold [H] leaves this routine.</p>
    <p>Expand Trench Command to set readiness and facing, inspect a soldier, and view shipments. Food and water are finite. Trucks use the southern road; foot carriers finish deliveries. Supply emergencies pause for your decision. A campaign day lasts 30 minutes at 1×. Unassigned troops have no automatic supply organization.</p>
    <h3>Operations and rifle combat</h3><p>Use MENU to choose a saveable open-ended trench campaign, 10-minute offensive, 15-minute defense, or peaceful sandbox. Eight-person rifle squads are understrength scenario forces, not exact wartime establishment tables. Three able troops capture a circle in 35 seconds from neutral. Enemies inside contest it. Hold Saint-Martin plus another objective to earn control points. Pause or open the menu whenever you need thinking time.</p><p>The terrain map is known, but enemies must be spotted. Night, woods, facing, exhaustion and suppression limit sight. Faded LAST SEEN markers remember a position for up to 18 seconds; they do not follow hidden enemies. Each rifleman still needs their own clear view, time to aim and ammunition. Solid hits are lethal; misses visibly scatter. Trenches reduce exposure, not damage from a direct hit. Pinned people cannot advance until they recover; Push through cannot override physical pinning. Stop within 12 metres of an owned flag to draw finite supplies. Rifles, automatic weapons and crew guns consume ammunition and need time to reload and set up. Use Support & rescue for smoke, mortar missions and risky rescues. Click a building with a Move order to enter through its doors; choose floors in the squad inspector. Wounds require medical supplies and serious casualties need an aid post and evacuation.</p>
    <h3>Experimental brains</h3><p>The deterministic coordinator is active. No trained policy has been adopted; no learning happens during play. Recorded replay review is in Developer / Performance.</p>
    <p class="muted">Version-3 saves preserve the operation, needs, inventories, travel, duties, facilities and shipments. Legacy saves are preserved during migration. Starting a fresh operation never overwrites your saved campaign.</p></section>
    <div class="toast" id="toast"></div>
  `;}
}
