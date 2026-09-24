import type { BattlefieldState, Vec2 } from '../core/types';
import { MODE_INFO, factionOf, type GameMode } from '../operations/types';
import {defaultBattleSetup,resolveBattleSetup,validBattleSetup,applyPreset,type BattleSetup,type ResolvedBattleSetup} from '../operations/BattleSetup';
import {readSetupPresets,saveSetupPreset,type SavedSetup} from '../persistence/SetupPresets';
import {renderBattleSetup,renderBattleBriefing,readBattleForm,escapeText as escape} from './BattleSetupView';

interface OperationActions {
  start: (setup:ResolvedBattleSetup) => void;
  legacyStart:(mode:GameMode,seed:number)=>void;
  load: () => boolean;
  save: () => boolean;
  hasSave: () => boolean;
  loadError?:()=>string;
  saveNotice?:()=>string;
  focus: (point: Vec2) => void;
  quality: (level: string) => void;
}

export class OperationUI {
  private readonly dialog = document.createElement('dialog');
  private readonly hud = document.createElement('section');
  private readonly menuButton = document.createElement('button');
  private started = false;
  private setup:BattleSetup=defaultBattleSetup();
  private pending?:ResolvedBattleSetup;
  private advancedOpen=false;
  private lastRender = 0;
  private resultShown = false;
  private choosing = true;
  private hudIdentity?: object;
  private quality='balanced';
  private graphicsLost=false;
  private graphicsNotice='';

  constructor(private readonly getState: () => BattlefieldState, private readonly actions: OperationActions) {
    this.dialog.className = 'operation-menu'; this.dialog.setAttribute('aria-label', 'FRONTLINES command menu');
    this.hud.className = 'operation-hud'; this.hud.setAttribute('aria-label', 'Operation objectives');
    this.menuButton.className = 'operation-menu-button'; this.menuButton.textContent = 'MENU'; this.menuButton.title = 'Pause and menu [Esc]';
    document.body.append(this.dialog); document.querySelector('#ui-root')!.append(this.hud, this.menuButton);
    this.menuButton.addEventListener('click', () => this.open(false));
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); if(this.pending){this.pending=undefined;this.renderMenu();}else if (this.started) this.close(); });
    window.addEventListener('keydown', e => {
      if (e.code !== 'Escape' || e.repeat || document.documentElement.dataset.replay || document.documentElement.dataset.help || document.documentElement.dataset.fieldMap) return;
      // Drawing gets its own first Escape. A second Escape opens the menu.
      const canvas=document.querySelector<HTMLCanvasElement>('#battlefield');
      if (!this.dialog.open && (canvas?.dataset.gesture || canvas?.dataset.mode && canvas.dataset.mode !== 'select')) return;
      if (!this.dialog.open) { this.open(false); e.preventDefault(); }
    },true);
    this.open(true);
  }
  get isOpen(): boolean { return this.dialog.open; }
  setQuality(level:string):void {
    this.quality=level;
    const select=this.dialog.querySelector<HTMLSelectElement>('#menu-quality');if(select)select.value=level;
  }
  setGraphicsLost(lost:boolean):void {
    this.graphicsLost=lost;
    this.graphicsNotice=lost?'Graphics connection lost. The battlefield is paused; you can save while the browser recovers.':'Graphics restored. The battlefield is still paused; resume when you are ready.';
    this.open(false);
  }
  private open(choose: boolean): void {
    if (document.documentElement.dataset.replay) return;
    this.choosing = choose || !this.started;
    this.pending=undefined;
    document.documentElement.dataset.menu = 'open';
    window.dispatchEvent(new Event('frontlines-menu'));
    this.renderMenu(); if (!this.dialog.open) this.dialog.showModal();
  }
  private close(): void { if(this.graphicsLost)return;this.dialog.close(); delete document.documentElement.dataset.menu;this.graphicsNotice=''; }
  stateRestored(): void { this.started = true; this.resultShown = false; this.close(); }
  private localPresets():SavedSetup[] {try{return readSetupPresets(localStorage);}catch{return [];}}
  private status(message:string):void {const p=this.dialog.querySelector<HTMLParagraphElement>('.menu-status')!;p.hidden=false;p.textContent=message;}
  private launch(setup:ResolvedBattleSetup):void {
    if(this.graphicsLost)return;
    try{this.actions.start(setup);this.setup=structuredClone(setup);this.started=true;this.resultShown=false;this.pending=undefined;this.close();}
    catch(error){this.status(`Could not prepare this sector. ${error instanceof Error?error.message:'Try another seed.'}`);}
  }
  private captureSetup():boolean {
    const form=this.dialog.querySelector<HTMLFormElement>('#quick-battle-form');
    if(!form?.reportValidity())return false;
    const setup=readBattleForm(this.dialog,this.setup);
    if(!validBattleSetup(setup)){this.status('Check the battle settings and seed.');return false;}
    this.setup=setup;return true;
  }
  private renderMenu(): void {
    const state=this.getState(),op=state.operation,result=this.started&&op&&op.status!=='active'&&!this.choosing;
    const presets=this.localPresets();
    this.dialog.classList.add('quick-battle-menu');
    this.dialog.innerHTML=`
      <aside class="menu-landscape" aria-hidden="true"><span>FIELD COMMAND / 1944</span><div class="menu-contours"></div>
      <div class="quick-brand">FRONT<br>LINES<small>THE OPERATIONS TABLE</small></div>
      <p>Complex battlefield.<br>Clear orders.<b>4 × 4 KM · NORTHWEST EUROPE</b></p></aside>
      <div class="menu-content">
      ${this.choosing?(this.pending?renderBattleBriefing(this.pending):renderBattleSetup(this.setup,this.advancedOpen,presets)):
        `<div class="setup-title"><div><small>${result?'AFTER ACTION':'FIELD COMMAND'}</small><h2>${result?(op.status==='victory'?'Sector secured.':'Operation ended.'):'Operation paused'}</h2></div></div>
        ${result?`<p class="after-action-reason">${escape(op.reason)}</p><div class="result-stats"><span>${this.able('player')} / ${op.initialPlayer}<small>ABLE TROOPS</small></span><span>${Math.floor(op.elapsed/60)}m ${Math.floor(op.elapsed%60)}s<small>OPERATION TIME</small></span></div>`:`<p class="pause-intent">${op?escape(MODE_INFO[op.mode].title):'Living battlefield'} · your current session is paused.</p>`}
        <div class="pause-actions"><button class="menu-primary" id="resume-session">${result?'Inspect battlefield':'Resume operation'} <kbd>Esc</kbd></button>
        ${op?.setup?'<button id="rematch-operation">Rematch <small>Same seed and settings</small></button><button id="change-settings">Change settings</button>':''}
        <button id="choose-operation">New battle</button></div>`}
      ${this.choosing&&this.started?'<p class="menu-save-note">Beginning a new battle replaces this unsaved session. Your saved campaign stays untouched.</p>':''}
      <p class="menu-status" role="status" hidden></p>
      <div class="menu-secondary">${this.choosing&&this.started?'<button id="resume-session">Return to current battle</button>':''}${this.actions.hasSave()?'<button id="continue-save">Load saved campaign</button>':''}${this.started?'<button id="save-session">Save current session</button>':''}${this.choosing&&!this.pending?'<button id="sandbox-session">Peaceful sandbox</button>':''}</div>
      <div class="menu-settings"><label>Rendering <select id="menu-quality"><option value="balanced">Balanced</option><option value="low">Performance</option><option value="high">High</option></select></label><span>Simulation paused while this menu is open</span></div></div>`;
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-mode-choice]').forEach(button=>button.addEventListener('click',()=>{
      if(!this.captureSetup())return;this.setup.operation=button.dataset.modeChoice as BattleSetup['operation'];this.renderMenu();
      this.dialog.querySelector<HTMLButtonElement>(`[data-mode-choice="${this.setup.operation}"]`)!.focus();
    }));
    this.dialog.querySelector('.advanced-setup')?.addEventListener('toggle',e=>{this.advancedOpen=(e.target as HTMLDetailsElement).open;});
    this.dialog.querySelector('#quick-battle-form')?.addEventListener('change',e=>{
      const el=e.target as HTMLInputElement,focus=el.id;
      if(focus==='setup-preset'||focus==='local-preset'||focus==='preset-name')return;
      if(!this.captureSetup())return;this.renderMenu();this.dialog.querySelector<HTMLElement>(`#${focus}`)?.focus();
    });
    this.dialog.querySelector('#quick-battle-form')?.addEventListener('submit',e=>{
      e.preventDefault();if(!this.captureSetup()||this.graphicsLost)return;
      const random=crypto.getRandomValues(new Uint32Array(1))[0]%2147483647+1;
      this.pending=resolveBattleSetup(this.setup,random);this.renderMenu();this.dialog.querySelector<HTMLButtonElement>('#begin-operation')!.focus();
    });
    this.dialog.querySelector('#begin-operation')?.addEventListener('click',()=>{if(this.pending)this.launch(this.pending);});
    this.dialog.querySelector('#back-to-setup')?.addEventListener('click',()=>{this.pending=undefined;this.renderMenu();});
    this.dialog.querySelector('#setup-preset')?.addEventListener('change',e=>{
      const id=(e.target as HTMLSelectElement).value;if(id==='custom'||!this.captureSetup())return;
      this.setup=applyPreset(this.setup,id);this.renderMenu();
    });
    this.dialog.querySelector('#local-preset')?.addEventListener('change',e=>{
      const value=(e.target as HTMLSelectElement).value;if(value==='')return;
      const row=presets[Number(value)];if(row){this.setup=structuredClone(row.setup);this.renderMenu();this.status(`Loaded settings: ${row.name}`);}
    });
    this.dialog.querySelector('#save-setup')?.addEventListener('click',()=>{
      if(!this.captureSetup())return;const name=this.dialog.querySelector<HTMLInputElement>('#preset-name')!.value;
      try{saveSetupPreset(localStorage,name,this.setup);this.renderMenu();this.status(`Saved local setup: ${name.trim()}`);}
      catch(error){this.status(error instanceof Error?error.message:'Local storage unavailable. Settings were not saved.');}
    });
    this.dialog.querySelector('#preset-name')?.addEventListener('keydown',e=>{
      if((e as KeyboardEvent).key==='Enter'){e.preventDefault();this.dialog.querySelector<HTMLButtonElement>('#save-setup')!.click();}
    });
    this.dialog.querySelector('#resume-session')?.addEventListener('click',()=>this.close());
    this.dialog.querySelector('#choose-operation')?.addEventListener('click',()=>{this.setup=defaultBattleSetup();this.advancedOpen=false;this.open(true);});
    this.dialog.querySelector('#change-settings')?.addEventListener('click',()=>{this.setup=structuredClone(op!.setup!);this.open(true);});
    this.dialog.querySelector('#rematch-operation')?.addEventListener('click',()=>{
      this.setup=structuredClone(op!.setup!);this.choosing=true;this.pending=structuredClone(op!.setup!);this.renderMenu();
    });
    this.dialog.querySelector('#sandbox-session')?.addEventListener('click',()=>{if(this.graphicsLost)return;try{this.actions.legacyStart('sandbox',1944);this.started=true;this.resultShown=false;this.close();}catch(error){this.status(String(error));}});
    this.dialog.querySelector('#continue-save')?.addEventListener('click',()=>{
      if(this.graphicsLost)return;if(this.actions.load())this.stateRestored();
      else this.status(this.actions.loadError?.()||'Could not load that save. This session and the saved file are untouched.');
    });
    this.dialog.querySelector('#save-session')?.addEventListener('click',()=>{const saved=this.actions.save();this.renderMenu();this.status(saved?'Session saved.':'Save failed · previous save preserved');});
    const quality=this.dialog.querySelector<HTMLSelectElement>('#menu-quality')!;quality.value=this.quality;
    quality.addEventListener('change',()=>{this.quality=quality.value;this.actions.quality(this.quality);});
    for(const control of this.dialog.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('#launch-operation,#begin-operation,#resume-session,#continue-save,#sandbox-session,#menu-quality'))control.disabled=this.graphicsLost;
    if(this.graphicsNotice)this.status(this.graphicsNotice);
    else if(this.actions.saveNotice?.())this.status(this.actions.saveNotice());
  }
  private able(faction: 'player' | 'enemy'): number {
    const state = this.getState(), ids = new Set(state.squads.filter(s => factionOf(s) === faction).map(s => s.id));
    return state.soldiers.filter(s => ids.has(s.squadId) && s.needs?.life === 'active').length;
  }
  update(now: number): void {
    if (now - this.lastRender < 200) return; this.lastRender = now;
    const op = this.getState().operation;
    this.menuButton.hidden = Boolean(document.documentElement.dataset.replay);
    this.hud.hidden = !op || Boolean(document.documentElement.dataset.replay);
    document.documentElement.dataset.gameMode = op?.mode ?? 'sandbox';
    if (!op) return;
    if (op.status !== 'active' && !this.resultShown && !document.documentElement.dataset.replay) { this.resultShown = true; this.open(false); }
    if(op.runtime){this.updateOperationalHUD();return;}
    const remaining = Math.max(0, Math.ceil(op.duration - op.elapsed));
    if(this.hudIdentity!==op){
      this.hudIdentity=op;
      this.hud.classList.remove('operational-intent');
      this.hud.innerHTML=`<div class="operation-topline"><span>${MODE_INFO[op.mode].title}</span><b></b></div><div class="objective-list">${op.objectives.map((o,i)=>`<button data-objective="${i}" class="objective-chip" title="Focus ${escape(o.name)}; 3 able troops capture; stop near the flag to resupply"><i>${String.fromCharCode(65+i)}</i><span>${escape(o.name)}<small></small></span></button>`).join('')}</div><p><span class="operation-instruction"></span><span class="operation-able"></span></p>`;
      this.hud.querySelectorAll<HTMLButtonElement>('[data-objective]').forEach(button=>button.addEventListener('click',()=>this.actions.focus(op.objectives[Number(button.dataset.objective)])));
    }
    this.hud.querySelector('.operation-topline b')!.textContent=op.mode==='campaign'?`DAY ${1+Math.floor(this.getState().living!.campaignHours/24)} · NO TIME LIMIT`:`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
    for(const button of this.hud.querySelectorAll<HTMLButtonElement>('[data-objective]')){
      const o=op.objectives[Number(button.dataset.objective)];button.className=`objective-chip ${o.owner} ${o.contested?'contested':''}`;
      button.querySelector('small')!.textContent=`${o.contested?'CONTESTED':o.owner==='player'?'HELD':o.owner==='enemy'?'ENEMY':o.control<0?'ENEMY CAPTURING':o.control>0?'CAPTURING':'NEUTRAL'} · ${Math.round(Math.abs(o.control)*100)}%`;
    }
    this.hud.querySelector('.operation-instruction')!.textContent=op.status!=='active'?op.reason:op.mode==='campaign'?`Hold A + C · ${Math.floor(op.campaign!.playerHold)} / 120s · save anytime`:op.mode==='advance'?`Hold B + one other · ${Math.floor(op.score)} / ${op.targetScore} control`:op.elapsed<90?`Prepare positions · assault in ${Math.ceil(90-op.elapsed)}s`:'Keep B until relief arrives';
    const state=this.getState(),playerIds=new Set(state.squads.filter(s=>factionOf(s)==='player').map(s=>s.id));
    const dead=state.soldiers.filter(s=>playerIds.has(s.squadId)&&s.needs?.life==='dead').length;
    this.hud.querySelector('.operation-able')!.textContent=`${this.able('player')} able · ${dead} dead · ${(op.contacts?.player??[]).filter(c=>c.visible&&c.active).length} spotted`;
  }
  private updateOperationalHUD():void {
    const op=this.getState().operation!,r=op.runtime!,primary=r.objectives.find(o=>o.side==='player'&&o.priority==='primary')!,p=r.progress.find(p=>p.id===primary.id)!;
    if(this.hudIdentity!==op){this.hudIdentity=op;this.hud.classList.add('operational-intent');
      this.hud.innerHTML=`<div class="operation-topline"><span>${escape(MODE_INFO[op.mode].title)}</span><b></b></div><button class="primary-intent" title="Focus the operational area; open G for the complete planning sheet"><small>PRIMARY</small><strong>${escape(primary.title)}</strong></button><p class="intent-status"></p><details class="optional-intents"><summary>Field orders & optional terrain</summary><p class="intent-guidance"></p>${r.objectives.filter(o=>o.priority==='optional').map(o=>`<div>${escape(o.title)}<small>Finite supply cache</small></div>`).join('')}<p>G · Operational map. Plot your own approach; marked roads are alternatives.</p></details>`;
      this.hud.querySelector('.primary-intent')!.addEventListener('click',()=>{const spec=primary.spec,zone='zone' in spec?r.zones.find(z=>z.id===spec.zone):r.zones.find(z=>z.id==='contested');this.actions.focus(zone!.center);});
    }
    const remaining=Math.max(0,Math.ceil(op.duration-op.elapsed));
    this.hud.querySelector('.operation-topline b')!.textContent=op.duration?`RELIEF ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:r.phase.toUpperCase();
    this.hud.querySelector('.intent-status')!.textContent=op.status!=='active'?op.reason:r.phase==='withdrawal'?'Force exhausted · rest, resupply and rotate squads':p.satisfied&&primary.spec.type==='breakthrough'?`Consolidating · ${Math.floor(p.heldFor)}s · keep the route open`:primary.spec.type==='hold-line'?'Trade ground if needed · protect rear access':r.phase==='exploitation'?'Line penetrated · establish a connected foothold':`${this.able('player')} able · choose your approach`;
    this.hud.querySelector('.intent-guidance')!.textContent=primary.spec.type==='breakthrough'?'Establish at least eight fit rifle/MG personnel from two squads beyond the belt, near an open road. Keep access for consolidation.':primary.spec.type==='hold-line'?'Deny sustained entry by a viable enemy force. Villages and forward works may be given up; losing one does not end the operation.':'Secure two marked terrain areas and reduce the opposing combat force below half strength. Reconnaissance matters.';
  }
}
