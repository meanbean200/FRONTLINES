import type { BattlefieldState, Vec2 } from '../core/types';
import { MODE_INFO, factionOf, type GameMode } from '../operations/types';
import {OPERATION_IDS,OPERATION_DEFINITIONS,isOperationId,forceSize} from '../operations/OperationDefinitions';
import {placeOperation} from '../operations/OperationPlacement';
const escape=(value:string):string=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

interface OperationActions {
  start: (mode: GameMode,seed:number) => void;
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
  private chosen: GameMode = 'breakthrough';
  private sectorSeed=1944;
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
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); if (this.started) this.close(); });
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
    document.documentElement.dataset.menu = 'open';
    window.dispatchEvent(new Event('frontlines-menu'));
    this.renderMenu(); if (!this.dialog.open) this.dialog.showModal();
  }
  private close(): void { if(this.graphicsLost)return;this.dialog.close(); delete document.documentElement.dataset.menu;this.graphicsNotice=''; }
  stateRestored(): void { this.started = true; this.resultShown = false; this.close(); }
  private renderMenu(): void {
    const state = this.getState(), op = state.operation, result = this.started && op && op.status !== 'active' && !this.choosing;
    const briefing=isOperationId(this.chosen)?placeOperation(this.chosen,this.sectorSeed):undefined;
    const primary=briefing?.objectives.find(o=>o.priority==='primary'&&o.side==='player');
    const definition=isOperationId(this.chosen)?OPERATION_DEFINITIONS[this.chosen]:undefined;
    this.dialog.innerHTML = `
      <div class="menu-landscape" aria-hidden="true"><span>OPERATIONS SHEET · 4 × 4 KM</span><div class="menu-contours"></div><p>${escape(briefing?.locations[0].name??'FIELD EXERCISE')}<br><b>SECTOR ${this.sectorSeed}</b></p><div class="menu-route"><i>→</i><i>Ⅱ</i><i>↗</i></div></div>
      <div class="menu-content"><div class="menu-eyebrow">FIELD COMMAND / 1944-INSPIRED</div>
      <h1>FRONT<span>LINES</span></h1><p class="menu-subtitle">Ground is won by squads.<br>It is held by people.</p>
      ${result ? `<section class="after-action"><small>AFTER ACTION</small><h2>${op.status === 'victory' ? 'Sector secured.' : 'Operation ended.'}</h2><p>${escape(op.reason)}</p><div class="result-stats"><span>${this.able('player')} / ${op.initialPlayer}<small>ABLE TROOPS</small></span><span>${Math.floor(op.elapsed / 60)}m ${Math.floor(op.elapsed % 60)}s<small>OPERATION TIME</small></span></div>${op.runtime?`<ul>${op.runtime.objectives.filter(o=>o.side==='player'&&o.priority==='optional').map(o=>`<li>${escape(o.title)} — ${op.runtime!.progress.find(p=>p.id===o.id)?.complete?'secured':'not secured'}</li>`).join('')}</ul>`:''}</section>` : ''}
      ${this.choosing ? `<div class="mode-cards operations-v2-choices" aria-label="Choose game mode">${([...OPERATION_IDS,'sandbox'] as GameMode[]).map(mode => `<button class="mode-card ${this.chosen === mode ? 'chosen' : ''}" data-mode-choice="${mode}" aria-pressed="${this.chosen === mode}"><span>${MODE_INFO[mode].tag}<b>${MODE_INFO[mode].duration}</b></span><strong>${MODE_INFO[mode].title}</strong></button>`).join('')}</div><p class="mode-description">${MODE_INFO[this.chosen].description}</p>${briefing?`<section class="operation-briefing"><small>PRIMARY</small><strong>${escape(primary!.title)}</strong><details><summary>Optional terrain & supplies</summary>${briefing.objectives.filter(o=>o.priority==='optional').map(o=>`<p>${escape(o.title)} · finite supply cache</p>`).join('')}</details><p>${forceSize(definition!.forces.player)} personnel · ${definition!.forces.player.rifles} rifle squads · engineers, MG, mortar & medical support${definition!.persistent?' · 48 reserve personnel':''}</p></section>`:`<p class="mode-hint">${MODE_INFO[this.chosen].hint}</p>`}<label class="sector-seed">Sector seed <input id="sector-seed" type="number" min="1" max="2147483647" value="${this.sectorSeed}" step="1"></label><button class="menu-primary" id="launch-operation">${this.chosen === 'sandbox' ? 'Enter sandbox' : 'Begin operation'} <span>→</span></button>${this.started ? '<p class="menu-save-note">Starting fresh replaces this unsaved session. Your saved campaign stays untouched.</p>' : ''}` : ''}
      <div class="menu-secondary">${this.started ? `<button id="resume-session">${result ? 'Inspect battlefield' : 'Resume'} <kbd>Esc</kbd></button>` : ''}${!this.choosing ? '<button id="choose-operation">New operation</button>' : ''}${this.actions.hasSave() ? '<button id="continue-save">Load saved campaign</button>' : ''}${this.started ? '<button id="save-session">Save current session</button>' : ''}</div>
      <p class="menu-status" role="status" hidden></p><div class="menu-settings"><label>Rendering <select id="menu-quality"><option value="balanced">Balanced</option><option value="low">Performance</option><option value="high">High</option></select></label><span>Simulation paused while this menu is open</span></div>
      <footer class="menu-footer">Select a squad · right-drag a route · H to hold · T to draw a defensive frontage<br>Spot enemies before engaging. Night, cover, tiredness and suppression limit sight. Town caches are finite; stop near the flag to resupply.</footer></div>`;
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-mode-choice]').forEach(button => button.addEventListener('click', () => { this.chosen = button.dataset.modeChoice as GameMode; this.renderMenu(); this.dialog.querySelector<HTMLButtonElement>(`[data-mode-choice="${this.chosen}"]`)!.focus(); }));
    this.dialog.querySelector<HTMLInputElement>('#sector-seed')?.addEventListener('change',e=>{const value=Number((e.target as HTMLInputElement).value);if(Number.isSafeInteger(value)&&value>=1&&value<=2147483647)this.sectorSeed=value;this.renderMenu();});
    this.dialog.querySelector('#launch-operation')?.addEventListener('click', () => { if(this.graphicsLost)return;try{this.actions.start(this.chosen,this.sectorSeed);this.started=true;this.resultShown=false;this.close();}catch(error){const status=this.dialog.querySelector<HTMLParagraphElement>('.menu-status')!;status.hidden=false;status.textContent=`Could not prepare this sector. ${error instanceof Error?error.message:'Try another seed.'}`;} });
    this.dialog.querySelector('#resume-session')?.addEventListener('click', () => this.close());
    this.dialog.querySelector('#choose-operation')?.addEventListener('click', () => this.open(true));
    this.dialog.querySelector('#continue-save')?.addEventListener('click', () => { if(this.graphicsLost)return;if (this.actions.load()) this.stateRestored(); else {const status=this.dialog.querySelector<HTMLParagraphElement>('.menu-status')!;status.hidden=false;status.textContent=this.actions.loadError?.()||'Could not load that save. This session and the saved file have been left untouched.';} });
    this.dialog.querySelector('#save-session')?.addEventListener('click', () => {const saved=this.actions.save();this.renderMenu();const status=this.dialog.querySelector<HTMLParagraphElement>('.menu-status')!;status.hidden=false;status.textContent=saved?'Session saved.':'Save failed · previous save preserved';});
    const quality=this.dialog.querySelector<HTMLSelectElement>('#menu-quality')!;quality.value=this.quality;
    quality.addEventListener('change',()=>{this.quality=quality.value;this.actions.quality(this.quality);});
    for(const control of this.dialog.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('#launch-operation,#resume-session,#continue-save,#menu-quality'))control.disabled=this.graphicsLost;
    if(this.graphicsNotice){const status=this.dialog.querySelector<HTMLParagraphElement>('.menu-status')!;status.hidden=false;status.textContent=this.graphicsNotice;}
    else if(this.actions.saveNotice?.()){const status=this.dialog.querySelector<HTMLParagraphElement>('.menu-status')!;status.hidden=false;status.textContent=this.actions.saveNotice();}
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
