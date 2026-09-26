import {OPERATION_IDS,OPERATION_DEFINITIONS} from '../operations/OperationDefinitions';
import {ARMY_LABELS,SIZE_LABELS,SETUP_PRESETS,battlePopulation,configuredDefinition,forceSummary,type BattleSetup,type ResolvedBattleSetup} from '../operations/BattleSetup';

import {MISSION_COPY,MISSION_SUCCESS,missionFailure,placeMissionOperation} from '../operations/MissionContent';
import type {SavedSetup} from '../persistence/SetupPresets';
import {defaultEndlessOptions} from '../operations/EndlessTypes';

export const escapeText=(value:string):string=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const descriptions={breakthrough:['Break a prepared line and hold a route beyond it.','Deliberate offensive'],
  'line-defense':['Hold your sector until relief reaches the line.','Prepared defense'],
  meeting:['Scout unsettled ground and outmaneuver the opposing force.','Mobile encounter'],
  'open-front':['Build, sustain and advance across a persistent front.','Open-ended campaign']};
const options=(values:readonly (readonly [string,string])[],selected:string)=>values.map(([v,label])=>`<option value="${v}"${selected===v?' selected':''}>${escapeText(label)}</option>`).join('');
const select=(id:string,label:string,values:readonly (readonly [string,string])[],value:string,extra='')=>`<label for="${id}">${label}<select id="${id}" ${extra}>${options(values,value)}</select></label>`;
const toggle=(id:string,label:string,value:boolean)=>`<label class="setup-check"><input id="${id}" type="checkbox"${value?' checked':''}>${label}</label>`;

export function renderBattleSetup(s:BattleSetup,advancedOpen:boolean,presets:SavedSetup[]):string {
  const a=s.advanced,endless=s.battleMode==='endless',e=s.endless??defaultEndlessOptions();
  return `<form id="quick-battle-form"><div class="setup-title"><span class="eyebrow">INTO THE FIELD</span><h2>Quick Battle</h2></div>
    <fieldset class="operation-picker"><legend>Battle mode</legend><div class="quick-operations battle-mode-picker"><button type="button" data-battle-mode="operation" aria-pressed="${!endless}"><strong>Operation</strong></button><button type="button" data-battle-mode="endless" aria-pressed="${endless}"><strong>Endless</strong></button></div><p class="operation-choice-description">${endless?'Persistent battle. Capture, build and resupply without an operation ending.':'Fight a defined objective with a clear victory condition.'}</p></fieldset>
    ${endless?`<div class="quick-fields">${select('endless-reinforcements','Reinforcements',[['finite','Finite · limited rear allowance'],['replenishing','Replenishing · gradual recovery'],['continuous','Continuous · replace losses to cap']],e.reinforcements)}${select('endless-pressure','Enemy pressure',[['low','Low'],['standard','Standard'],['high','High']],e.pressure)}</div><p class="muted">Rifle replacements travel from the rear. Lost heavy equipment stays lost. Current sector size and forces are unchanged.</p>`:`<fieldset class="operation-picker"><legend>Operation</legend><div class="quick-operations">${OPERATION_IDS.map(id=>`<button type="button" data-mode-choice="${id}" aria-pressed="${s.operation===id}" title="${descriptions[id][0]}"><strong>${id==='open-front'?OPERATION_DEFINITIONS[id].title:MISSION_COPY[id].title}</strong></button>`).join('')}</div><p class="operation-choice-description">${s.operation==='open-front'?descriptions[s.operation][0]:MISSION_COPY[s.operation].situation}</p></fieldset>`}
    <div class="quick-fields">
      ${select('battle-size','Battle size',Object.entries(SIZE_LABELS),s.size)}
      ${select('battle-side','Your side',[...Object.entries(ARMY_LABELS),['random','Random side']],s.side)}
      ${select('battle-map','Map',[['random','Random sector'],['seed','Use a seed']],s.map)}
    </div>
    <p class="setup-estimate">${battlePopulation(s)} · 4 × 4 km${s.size==='large'?' · 1× speed recommended':''}</p>
    ${endless?select('endless-calendar','Day / night cycle',[['30','30 minutes at 1×'],['20','20 minutes at 1×'],['10','10 minutes at 1×']],String(s.calendarDayMinutes??30)):''}
    <label class="setup-seed" for="sector-seed" ${s.map==='random'?'hidden':''}>Sector seed <input id="sector-seed" type="number" min="1" max="2147483647" step="1" required value="${s.seed}" ${s.map==='random'?'disabled':''}><small>Same seed + settings recreates the same battle.</small></label>
    <details class="advanced-setup" ${advancedOpen?'open':''}><summary>Advanced <span>Optional</span></summary>
      <div class="setup-presets">${select('setup-preset','Starting preset',[['custom','Choose preset…'],...SETUP_PRESETS.map(p=>[p.id,p.name] as [string,string])],'custom')}
        ${presets.length?select('local-preset','Local setups',[['','Choose saved setup…'],...presets.map((p,i)=>[String(i),p.name] as [string,string])],''):''}</div>
      <div class="advanced-groups">
        <fieldset><legend>BATTLEFIELD</legend>${select('setup-time','Time of day',[['dawn','Dawn · 06:00'],['day','Day · 08:00'],['dusk','Dusk · 18:00'],['night','Night · 22:00']],a.time)}${select('setup-direction','Advance direction',[['auto','Seed-selected'],['east','East'],['south','South'],['west','West'],['north','North']],a.direction)}${select('setup-approach','Staging distance',[['standard','Standard approach'],['close','Closer approach']],a.approach)}</fieldset>
        <fieldset><legend>FORCES & SUPPORT</legend>${select('setup-composition','Force balance',[['standard','Operation roles'],['balanced','Equal rifle strength']],a.composition)}${select('setup-engineers','Construction equipment',[['1','8 tool sets'],['2','16 tool sets']],String(a.engineers))}${toggle('setup-mortars','Mortar equipment per side',a.mortars)}${toggle('setup-smoke','Smoke ammunition',a.smoke)}</fieldset>
        <fieldset><legend>LOGISTICS</legend>${select('setup-supply','Supplies for both sides',[['standard','Standard supply'],['low','Low supply · half stock & deliveries']],a.supply)}${s.operation==='open-front'?select('setup-reserves','Replacement pool per side',[['0','No replacements'],['24','24 reserve personnel'],['48','48 reserve personnel']],String(a.reserves)):'<p>Finite forces. Scheduled personnel replacements are available in Open Front.</p>'}<p>Supplies move by convoy and carrier. No invisible refills.</p></fieldset>
      </div>
      <div class="save-setup"><label for="preset-name">Save these settings locally<input id="preset-name" maxlength="48" placeholder="e.g. Night defense"></label><button type="button" id="save-setup">Save setup</button></div><p class="setup-storage-note">Settings only — your battlefield save is untouched.</p>
    </details>
    <button class="menu-primary" id="launch-operation" type="submit">Prepare battle <span>→</span></button>
    <p class="setup-next">Review your sector before you begin.</p>
  </form>`;
}

export function renderBattleBriefing(s:ResolvedBattleSetup):string {
  if(s.battleMode==='endless')return `<section class="battle-briefing" aria-label="Endless briefing"><span class="eyebrow">PERSISTENT SECTOR · ${s.seed}</span><h2>Endless</h2><p>Secure settlements, sustain your positions and fight over them again. No town capture or hold timer ends this battle.</p><dl><div><dt>YOUR FORCE</dt><dd>${forceSummary(s)}<small>${battlePopulation(s)} · replacement cap is starting strength</small></dd></div><div><dt>REINFORCEMENTS</dt><dd>${escapeText(s.endless!.reinforcements)} · ${s.advanced.reserves} initially in reserve<small>${s.endless!.reinforcements==='finite'?'Four finite rear supply manifests per side. No external regeneration.':'Bounded rear availability; no frontline refills. Replacements fill losses, not new armies.'}</small></dd></div><div><dt>ENEMY PRESSURE</dt><dd>${escapeText(s.endless!.pressure)}<small>Changes planning tempo and commitment, not accuracy or damage.</small></dd></div></dl><p>Save &amp; Exit keeps the war available to Continue. End Battle requires confirmation and declares no arbitrary winner.</p><p class="muted">Experimental · expanded supply-hub, interdiction and long-duration release gates remain open.</p><button class="menu-primary" id="begin-operation">Begin endless battle <span>→</span></button><button class="briefing-back" id="back-to-setup">← Change settings</button></section>`;
  const d=configuredDefinition(s.operation,s),r=placeMissionOperation(s.operation,s.seed,s),primary=r.objectives.find(o=>o.side==='player'&&o.priority==='primary')!;
  if(r.missionPlan)Object.assign(d,MISSION_COPY[r.missionPlan.kind],{duration:'OBJECT-BASED MISSION'});
  const hours={dawn:'06:00',day:'08:00',dusk:'18:00',night:'22:00'}[s.advanced.time];
  return `<section class="battle-briefing" aria-label="Operation briefing"><div class="setup-title"><span class="eyebrow">${ARMY_LABELS[s.side]} · ${hours}</span><h2>${escapeText(d.title)}</h2><p class="muted">Sector ${s.seed}</p></div>
    <dl><div><dt>SITUATION</dt><dd>${escapeText(d.situation)}</dd></div><div class="briefing-primary"><dt>PRIMARY</dt><dd>${escapeText(primary.title)}</dd></div><div><dt>${r.missionPlan?'LANDMARK':'OPTIONAL'}</dt><dd>${r.missionPlan?escapeText(r.missionPlan.place+' · click the marked road house to manage its floors'):r.objectives.filter(o=>o.priority==='optional').map(o=>escapeText(o.title)).join(' · ')}<small>${r.missionPlan?'A forward trench receives real supplies by truck. No capture-score victory.':'Local supply stores. Choose what supports your plan.'}</small></dd></div><div><dt>YOUR FORCE</dt><dd>${forceSummary(s)}<small>${battlePopulation(s)}${d.persistent?` · ${s.advanced.reserves} reserve personnel per side`:''}</small></dd></div></dl>
    ${r.missionPlan?`<p class="briefing-success">${escapeText(MISSION_SUCCESS[r.missionPlan.kind])}</p><p class="muted">${escapeText(missionFailure(r.missionPlan.kind))}</p>`:''}
    <p class="briefing-settings">${s.advanced.supply==='low'?'Limited supplies':'Standard supplies'} · ${s.advanced.smoke?'Smoke available':'No smoke'} · ${d.persistent?'Save and resume anytime':d.duration.toLowerCase()}</p>
    <button class="menu-primary" id="begin-operation">Begin operation <span>→</span></button><button class="briefing-back" id="back-to-setup">← Change settings</button></section>`;
}

/** Read controls once per event; no runtime state is reconstructed from the DOM. */
export function readBattleForm(root:HTMLElement,previous:BattleSetup):BattleSetup {
  const s=structuredClone(previous),a=s.advanced;
  const value=(id:string)=>root.querySelector<HTMLInputElement|HTMLSelectElement>(`#${id}`)?.value;
  if(s.battleMode==='endless')s.endless={reinforcements:value('endless-reinforcements') as NonNullable<BattleSetup['endless']>['reinforcements'],pressure:value('endless-pressure') as NonNullable<BattleSetup['endless']>['pressure']};
  if(value('endless-calendar')!==undefined)s.calendarDayMinutes=Number(value('endless-calendar')) as 10|20|30;
  s.size=value('battle-size') as BattleSetup['size'];s.side=value('battle-side') as BattleSetup['side'];s.map=value('battle-map') as BattleSetup['map'];
  const seed=value('sector-seed');if(s.map==='seed')s.seed=Number(seed);
  a.time=value('setup-time') as typeof a.time;a.direction=value('setup-direction') as typeof a.direction;
  a.approach=value('setup-approach') as typeof a.approach;a.composition=value('setup-composition') as typeof a.composition;
  a.engineers=Number(value('setup-engineers')) as 1|2;a.supply=value('setup-supply') as typeof a.supply;
  a.mortars=root.querySelector<HTMLInputElement>('#setup-mortars')!.checked;a.smoke=root.querySelector<HTMLInputElement>('#setup-smoke')!.checked;
  if(value('setup-reserves')!==undefined)a.reserves=Number(value('setup-reserves')) as 0|24|48;
  return s;
}
