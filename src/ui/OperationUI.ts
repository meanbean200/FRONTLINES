import type { BattlefieldState, Vec2 } from '../core/types';
import { MODE_INFO, factionOf, type GameMode } from '../operations/types';
import {defaultBattleSetup,resolveBattleSetup,validBattleSetup,applyPreset,type BattleSetup,type ResolvedBattleSetup} from '../operations/BattleSetup';
import {OPERATION_IDS,OPERATION_DEFINITIONS} from '../operations/OperationDefinitions';
import {MISSION_COPY} from '../operations/MissionContent';
import {readSetupPresets,saveSetupPreset,type SavedSetup} from '../persistence/SetupPresets';
import {renderBattleSetup,renderBattleBriefing,readBattleForm,escapeText as escape} from './BattleSetupView';

interface OperationActions {
  start:(setup:ResolvedBattleSetup)=>void; preview:(setup:ResolvedBattleSetup)=>void; cancelPreview:()=>void;
  legacyStart:(mode:GameMode,seed:number)=>void;
  load:()=>boolean; save:()=>boolean; hasSave:()=>boolean; loadError?:()=>string; saveNotice?:()=>string;
  focus:(point:Vec2)=>void; quality:(level:string)=>void; mute:(muted:boolean)=>void;
}
type MenuScreen='main'|'quick'|'operations'|'briefing'|'pause'|'settings';
const operationCopy:Record<string,string>={breakthrough:'Break a prepared line. Keep a route open beyond it.','line-defense':'Hold your sector until relief arrives.',meeting:'Scout, maneuver and seize the initiative.','open-front':'Build and sustain a front. Save and return anytime.'};

/** Menu state is presentation only. A briefing is a reversible world preview. */
export class OperationUI {
  private readonly dialog=document.createElement('dialog');
  private readonly hud=document.createElement('section');
  private readonly menuButton=document.createElement('button');
  private started=false;
  private screen:MenuScreen='main';
  private settingsReturn:MenuScreen='main';
  private settingTab='graphics';
  private setup:BattleSetup=defaultBattleSetup();
  private pending?:ResolvedBattleSetup;
  private advancedOpen=false;
  private resultShown=false;
  private lastRender=0;
  private hudIdentity?:object;
  private quality='balanced';
  private muted=false;
  private graphicsLost=false;
  private graphicsNotice='';

  constructor(private getState:()=>BattlefieldState,private actions:OperationActions){
    this.dialog.className='operation-menu';this.dialog.setAttribute('aria-label','FRONTLINES menu');
    this.hud.className='operation-hud';this.hud.setAttribute('aria-label','Operation objectives');
    this.menuButton.className='operation-menu-button';this.menuButton.textContent='Menu';this.menuButton.title='Pause and menu [Esc]';
    document.querySelector('#app')!.append(this.dialog);document.querySelector('#ui-root')!.append(this.hud,this.menuButton);
    this.menuButton.onclick=()=>this.open(this.started?'pause':'main');
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.back();});
    window.addEventListener('keydown',e=>{
      if(e.code!=='Escape'||e.repeat||document.documentElement.dataset.replay||document.documentElement.dataset.help||document.documentElement.dataset.fieldMap)return;
      const canvas=document.querySelector<HTMLCanvasElement>('#battlefield');
      if(!this.dialog.open&&(document.documentElement.dataset.buildOpen||document.querySelector('#ui-root')?.getAttribute('data-hud-panel')||document.querySelector('.garrison-panel[open],.support-controls[open]')))return;
      if(!this.dialog.open&&(canvas?.dataset.gesture||canvas?.dataset.mode&&canvas.dataset.mode!=='select'))return;
      if(!this.dialog.open){this.open(this.started?'pause':'main');e.preventDefault();}
    },true);
    this.open('main');
  }
  get isOpen():boolean{return this.dialog.open;}
  setQuality(level:string):void{this.quality=level;const el=this.dialog.querySelector<HTMLSelectElement>('#menu-quality');if(el)el.value=level;}
  setGraphicsLost(lost:boolean):void{
    this.graphicsLost=lost;this.cancelPreview();
    this.graphicsNotice=lost?'Graphics connection lost. Play is paused; your current session can still be saved.':'Graphics restored. Resume when you are ready.';
    this.open(this.started?'pause':'main');
  }
  private cancelPreview():void{if(this.pending){this.actions.cancelPreview();this.pending=undefined;}}
  private open(screen:MenuScreen):void{
    if(document.documentElement.dataset.replay)return;
    this.screen=screen;document.documentElement.dataset.menu='open';window.dispatchEvent(new Event('frontlines-menu'));
    this.renderMenu();if(!this.dialog.open)this.dialog.showModal();
  }
  private close():void{
    if(this.graphicsLost)return;this.cancelPreview();this.dialog.close();delete document.documentElement.dataset.menu;this.graphicsNotice='';
    document.querySelector<HTMLCanvasElement>('#battlefield')?.focus();
  }
  private back():void{
    if(this.screen==='briefing'){this.cancelPreview();this.open('quick');}
    else if(this.screen==='settings')this.open(this.settingsReturn);
    else if(this.screen==='quick'||this.screen==='operations')this.open('main');
    else if(this.started)this.close();
  }
  stateRestored():void{this.pending=undefined;this.started=true;this.resultShown=false;this.close();}
  private localPresets():SavedSetup[]{try{return readSetupPresets(localStorage);}catch{return [];}}
  private status(message:string):void{const p=this.dialog.querySelector<HTMLElement>('.menu-status')!;p.hidden=false;p.textContent=message;}
  private captureSetup():boolean{
    const form=this.dialog.querySelector<HTMLFormElement>('#quick-battle-form');if(!form?.reportValidity())return false;
    const setup=readBattleForm(this.dialog,this.setup);if(!validBattleSetup(setup)){this.status('Check the battle settings and seed.');return false;}
    this.setup=setup;return true;
  }
  private prepare(setup:ResolvedBattleSetup):void{
    if(this.graphicsLost)return;
    try{this.actions.preview(setup);this.pending=setup;this.open('briefing');}
    catch(error){this.actions.cancelPreview();this.status('Could not prepare this sector. '+String(error));}
  }
  private launch():void{
    if(!this.pending||this.graphicsLost)return;
    try{const setup=this.pending;this.actions.start(setup);this.setup=structuredClone(setup);this.pending=undefined;this.started=true;this.resultShown=false;this.close();}
    catch(error){this.status('Could not begin this battle. '+String(error));}
  }
  private renderMenu():void{
    const op=this.getState().operation,presets=this.localPresets(),result=this.started&&op&&op.status!=='active'&&this.screen==='pause';
    this.dialog.dataset.screen=this.screen;
    let content='';
    if(this.screen==='main')content=`<div class="main-title"><span class="eyebrow">NORTHWEST EUROPE / 1944</span><h1>FRONTLINES</h1><p>Every position has a purpose.<br>Every soldier has a life.</p></div><nav class="main-actions" aria-label="Main menu"><button id="main-continue" ${!this.started&&!this.actions.hasSave()?'disabled':''}>Continue <span>→</span></button><button id="choose-operation">Quick Battle</button><button id="operations-menu">Operations</button><button id="sandbox-session">Sandbox</button><button data-settings>Settings</button></nav><p class="menu-caption">4 × 4 km · A living battlefield under your command</p>`;
    if(this.screen==='quick')content=renderBattleSetup(this.setup,this.advancedOpen,presets);
    if(this.screen==='operations')content=`<span class="eyebrow">CHOOSE YOUR MISSION</span><h2>Operations</h2><div class="operation-rows">${OPERATION_IDS.map(id=>`<button data-operation="${id}"><strong>${escape(id==='open-front'?OPERATION_DEFINITIONS[id].title:MISSION_COPY[id].title)}</strong><span>${id==='open-front'?operationCopy[id]:MISSION_COPY[id].intent}</span><i>→</i></button>`).join('')}</div>`;
    if(this.screen==='briefing')content=renderBattleBriefing(this.pending!);
    if(this.screen==='pause')content=`<span class="eyebrow">${result?'AFTER ACTION':'BATTLE PAUSED'}</span><h2>${result?(op.status==='victory'?'Sector secured':'Operation ended'):'Take a moment.'}</h2><p class="pause-intent">${result?escape(op.reason):op?escape(op.runtime?.missionPlan?MISSION_COPY[op.runtime.missionPlan.kind].title:MODE_INFO[op.mode].title):'Living battlefield'}</p>${result?`<div class="result-stats"><span>${this.able('player')} / ${op.initialPlayer}<small>Troops able</small></span><span>${Math.floor(op.elapsed/60)} min<small>Elapsed</small></span></div>`:''}<nav class="pause-actions"><button id="resume-session" class="menu-primary">${result?'Inspect battlefield':'Resume'} <span>→</span></button><div class="pause-save"><button id="save-session">Save</button><button id="continue-save" ${!this.actions.hasSave()?'disabled':''}>Load</button></div><button data-settings>Settings</button>${op?.setup?'<button id="rematch-operation">Restart battle <small>Same sector and settings · current mission rules</small></button><button id="change-settings">Change battle settings</button>':''}<button id="return-main">Return to main menu</button></nav>`;
    if(this.screen==='settings')content=`<span class="eyebrow">PREFERENCES</span><h2>Settings</h2><nav class="settings-tabs">${['graphics','audio','controls','interface'].map(t=>`<button data-setting-tab="${t}" aria-pressed="${t===this.settingTab}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</nav><div class="settings-page">${this.settingTab==='graphics'?`<label>Rendering quality<select id="menu-quality"><option value="low">Performance</option><option value="balanced">Balanced</option><option value="high">High</option></select></label><p>Adjusts terrain detail, shadows and rendering resolution. Simulation rules stay the same.</p>`:this.settingTab==='audio'?`<label class="setting-switch"><input type="checkbox" id="menu-mute" ${this.muted?'checked':''}>Mute combat sounds</label><p>Weapon and impact audio only.</p>`:this.settingTab==='controls'?`<dl class="controls-list"><dt>Move camera</dt><dd>WASD / arrows</dd><dt>Rotate / zoom</dt><dd>Middle drag / wheel</dd><dt>Select formations</dt><dd>Click / left-drag</dd><dt>Draw a route</dt><dd>Right-drag / V</dd><dt>Defend / trench</dt><dd>T / B</dd><dt>Hold / focus</dt><dd>H / F</dd><dt>Operational map</dt><dd>M (G also works)</dd><dt>Pause / menu</dt><dd>Space / Esc</dd></dl>`:`<label class="setting-switch"><input type="checkbox" id="reduce-motion" ${document.documentElement.dataset.reducedMotion?'checked':''}>Reduce interface motion</label><p>Your system's reduced-motion preference is also respected.</p><button id="show-manual">Field manual</button><button id="show-diagnostics">Developer tools</button>`}</div>`;
    this.dialog.innerHTML=`<div class="menu-shell">${this.screen!=='main'?'<button class="menu-back" id="menu-back">← Back</button>':''}<div class="menu-content">${content}<p class="menu-status" role="status" hidden></p>${this.screen==='quick'&&this.started?'<p class="menu-save-note">Previewing is safe. Beginning replaces your unsaved session, not your saved campaign.</p>':''}</div></div>${this.screen==='briefing'?'<div class="preview-caption"><span>LIVE SECTOR PREVIEW</span><small>Actual terrain · simulation paused</small></div>':''}`;
    const bind=(selector:string,fn:()=>void)=>this.dialog.querySelector(selector)?.addEventListener('click',fn);
    bind('#menu-back',()=>this.back());bind('#main-continue',()=>{if(this.started)this.close();else this.load();});
    bind('#choose-operation',()=>{this.setup=defaultBattleSetup();this.advancedOpen=false;this.open('quick');});
    bind('#operations-menu',()=>this.open('operations'));bind('#return-main',()=>this.open('main'));
    bind('#resume-session',()=>this.close());bind('#begin-operation',()=>this.launch());bind('#back-to-setup',()=>this.back());
    bind('[data-settings]',()=>{this.settingsReturn=this.screen;this.open('settings');});
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-setting-tab]').forEach(b=>b.onclick=()=>{this.settingTab=b.dataset.settingTab!;this.renderMenu();});
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-operation]').forEach(b=>b.onclick=()=>{this.setup=defaultBattleSetup();this.setup.operation=b.dataset.operation as BattleSetup['operation'];this.open('quick');});
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-mode-choice]').forEach(b=>b.onclick=()=>{if(this.captureSetup()){this.setup.operation=b.dataset.modeChoice as BattleSetup['operation'];this.renderMenu();this.dialog.querySelector<HTMLButtonElement>(`[data-mode-choice="${this.setup.operation}"]`)?.focus();}});
    this.dialog.querySelector('.advanced-setup')?.addEventListener('toggle',e=>{this.advancedOpen=(e.target as HTMLDetailsElement).open;});
    this.dialog.querySelector('#quick-battle-form')?.addEventListener('change',e=>{const id=(e.target as HTMLElement).id;if(['setup-preset','local-preset','preset-name'].includes(id))return;if(this.captureSetup()){this.renderMenu();this.dialog.querySelector<HTMLElement>('#'+id)?.focus();}});
    this.dialog.querySelector('#quick-battle-form')?.addEventListener('submit',e=>{e.preventDefault();if(this.captureSetup())this.prepare(resolveBattleSetup(this.setup,crypto.getRandomValues(new Uint32Array(1))[0]%2147483647+1));});
    this.dialog.querySelector('#setup-preset')?.addEventListener('change',e=>{const id=(e.target as HTMLSelectElement).value;if(id!=='custom'&&this.captureSetup()){this.setup=applyPreset(this.setup,id);this.renderMenu();}});
    this.dialog.querySelector('#local-preset')?.addEventListener('change',e=>{const v=(e.target as HTMLSelectElement).value,row=v===''?undefined:presets[Number(v)];if(row){this.setup=structuredClone(row.setup);this.renderMenu();this.status('Loaded settings: '+row.name);}});
    bind('#save-setup',()=>{if(!this.captureSetup())return;const name=this.dialog.querySelector<HTMLInputElement>('#preset-name')!.value;try{saveSetupPreset(localStorage,name,this.setup);this.renderMenu();this.status('Saved local setup: '+name.trim());}catch(error){this.status(String(error));}});
    this.dialog.querySelector('#preset-name')?.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Enter'){e.preventDefault();this.dialog.querySelector<HTMLButtonElement>('#save-setup')!.click();}});
    bind('#continue-save',()=>this.load());bind('#save-session',()=>{const ok=this.actions.save();this.renderMenu();this.status(ok?'Session saved.':'Save failed. Previous save preserved.');});
    bind('#rematch-operation',()=>this.prepare(structuredClone(op!.setup!)));
    bind('#change-settings',()=>{this.setup=structuredClone(op!.setup!);this.open('quick');});
    bind('#sandbox-session',()=>{if(this.graphicsLost)return;try{this.actions.legacyStart('sandbox',1944);this.started=true;this.resultShown=false;this.close();}catch(error){this.status(String(error));}});
    const quality=this.dialog.querySelector<HTMLSelectElement>('#menu-quality');if(quality){quality.value=this.quality;quality.onchange=()=>{this.quality=quality.value;this.actions.quality(this.quality);};}
    const mute=this.dialog.querySelector<HTMLInputElement>('#menu-mute');if(mute)mute.onchange=()=>{this.muted=mute.checked;this.actions.mute(this.muted);};
    const motion=this.dialog.querySelector<HTMLInputElement>('#reduce-motion');if(motion)motion.onchange=()=>{if(motion.checked)document.documentElement.dataset.reducedMotion='true';else delete document.documentElement.dataset.reducedMotion;};
    bind('#show-manual',()=>{if(!this.started){this.status('The full manual is available in battle. The Controls tab lists the essentials.');return;}this.close();document.querySelector<HTMLButtonElement>('#help-toggle')!.click();});
    bind('#show-diagnostics',()=>{if(!this.started){this.status('Developer tools are available after beginning a battle.');return;}this.close();document.querySelector<HTMLButtonElement>('#debug-toggle')!.click();});
    if(this.graphicsLost)for(const b of this.dialog.querySelectorAll<HTMLButtonElement>('#main-continue,#launch-operation,#begin-operation,#resume-session,#continue-save,#sandbox-session,#rematch-operation'))b.disabled=true;
    if(this.graphicsNotice)this.status(this.graphicsNotice);
    else if(this.screen==='main'&&this.actions.saveNotice?.())this.status(this.actions.saveNotice());
  }
  private load():void{if(this.graphicsLost)return;this.cancelPreview();if(this.actions.load())this.stateRestored();else this.status(this.actions.loadError?.()||'Could not load that save. Your session and saved file are untouched.');}
  private able(side:'player'|'enemy'):number{const state=this.getState(),ids=new Set(state.squads.filter(q=>factionOf(q)===side).map(q=>q.id));return state.soldiers.filter(s=>ids.has(s.squadId)&&s.needs?.life==='active').length;}
  update(now:number):void{
    if(now-this.lastRender<200)return;this.lastRender=now;
    const op=this.getState().operation;this.menuButton.hidden=Boolean(document.documentElement.dataset.replay);this.hud.hidden=!op||Boolean(document.documentElement.dataset.replay);
    document.documentElement.dataset.gameMode=op?.mode??'sandbox';if(!op)return;
    if(this.started&&!this.pending&&op.status!=='active'&&!this.resultShown&&!document.documentElement.dataset.replay){this.resultShown=true;this.open('pause');}
    if(this.hudIdentity!==op){
      this.hudIdentity=op;
      const r=op.runtime,primary=r?.objectives.find(o=>o.side==='player'&&o.priority==='primary');
      this.hud.innerHTML=`<div class="operation-topline"><span>${escape(op.runtime?.missionPlan?MISSION_COPY[op.runtime.missionPlan.kind].title:MODE_INFO[op.mode].title)}</span><b></b></div><button class="primary-intent" title="Focus objective"><strong>${escape(primary?.title??(op.mode==='defense'?'Hold until relief':op.mode==='campaign'?'Secure both command posts':'Take Saint-Martin and a second position'))}</strong></button><details class="optional-intents"><summary>Mission details</summary><p>${primary?escape(r?.missionPlan?MISSION_COPY[r.missionPlan.kind].situation:OPERATION_DEFINITIONS[r!.definitionId].situation):'Capture positions with able personnel. Enemy presence contests control.'}</p>${r?r.objectives.filter(o=>o.priority==='optional').map(o=>`<p>${escape(o.title)} · optional supply access</p>`).join(''):''}<p>Open the map to plan your approach.</p><p class="intent-status"></p></details>`;
      this.hud.querySelector('.primary-intent')!.addEventListener('click',()=>{const spec=primary?.spec,zone=spec&&'zone' in spec?r?.zones.find(z=>z.id===spec.zone):r?.zones.find(z=>z.id==='contested');const target=r?.missionPlan?.house??zone?.center??op.objectives[1]??op.objectives[0];if(target)this.actions.focus(target);});
    }
    const remaining=Math.max(0,Math.ceil(op.duration-op.elapsed));
    this.hud.querySelector('.operation-topline b')!.textContent=op.duration?`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'NO TIME LIMIT';
    this.hud.querySelector('.intent-status')!.textContent=op.status!=='active'?op.reason:`${this.able('player')} personnel able · ${op.runtime?.phase??'operation active'}`;
    if(op.runtime?.mission){const m=op.runtime.mission,plan=op.runtime.missionPlan!;
      this.hud.querySelector('.operation-topline b')!.textContent=m.phase==='preparation'&&plan.preparationSeconds>op.elapsed?`${Math.ceil(plan.preparationSeconds-op.elapsed)} s PREP`:m.phase.toUpperCase();
      this.hud.querySelector('.intent-status')!.textContent=m.reason;
      let situation=this.hud.querySelector<HTMLElement>('.mission-situation');if(!situation){situation=document.createElement('p');situation.className='mission-situation';this.hud.querySelector('.primary-intent')!.after(situation);}
      const c=m.checks;situation.textContent=c?`${c.house?'✓':'○'} House  ·  ${plan.kind==='line-defense'?`${op.status==='victory'?'✓':'○'} Repel attack`:`${c.line?'✓':'○'} Trench`}  ·  ${c.supply?'✓':'○'} Delivery  ·  ${c.road?'✓':'○'} Road`:'Inspect the marked road house and plan your positions.';
      if(c&&plan.version===3)situation.textContent=plan.kind==='meeting'?`${c.house?'✓':'○'} House A  ·  ${c.secondary?'✓':'○'} House B  ·  ${c.road?'✓':'○'} Road`:plan.kind==='line-defense'?`${c.defense?'✓':'○'} Defenders  ·  ${op.status==='victory'?'✓':'○'} Repel attack  ·  ${c.road?'✓':'○'} Road`:`${c.line?'✓':'○'} Trench  ·  ${c.house?'✓':'○'} Farmhouse  ·  ${c.road?'✓':'○'} Road`;
    }
  }
}
