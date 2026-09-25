import type { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';
import type { Readiness,Facility } from '../garrison/types';
import { garrisonSupplyReadout, withdrawalProgress } from './GarrisonReadout';
import {trenchName} from './TrenchReadout';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class GarrisonPanel {
  readonly element=document.createElement('details');
  showRoutes=false;
  private last=0;
  private person=0;
  private garrison=0;
  private listKey='';
  private emergencyId=0;
  private locked():boolean{return Boolean(document.documentElement.dataset.replay||document.documentElement.dataset.menu||document.documentElement.dataset.help||this.simulation.commandsLocked);}
  constructor(private simulation:BattlefieldSimulation,private placeFacility?:(id:number,kind:Facility['kind'])=>void){
    this.element.className='garrison-panel';
    this.element.innerHTML=`<summary><span>Defense status</span><small id="garrison-summary">Choose a defended area</small><b aria-hidden="true">×</b></summary><div class="garrison-content"><label>Area <select id="garrison-choice" aria-label="Garrison"></select></label><nav class="defense-tabs">${['defense','supplies','personnel','facilities','support'].map(t=>`<button data-defense-tab="${t}" aria-pressed="${t==='defense'}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</nav><section data-defense-page="defense"><div class="garrison-vitals"></div><label>Readiness <select id="garrison-readiness"><option value="routine">Routine · 25% watch</option><option value="alert">Alert · 50% watch</option><option value="stand-to">Stand-to · 90% watch</option></select></label><label>Front <select id="garrison-front"><option value="0">South</option><option value="1.5707963267948966">East</option><option value="3.141592653589793">North</option><option value="-1.5707963267948966">West</option></select></label></section><section data-defense-page="supplies" hidden><div class="supply-inventory"></div><label><input type="checkbox" id="logistics-routes">Show supply routes on battlefield</label><div class="garrison-shipments"></div></section><section data-defense-page="personnel" hidden><select id="soldier-choice" aria-label="Soldier"></select><div class="soldier-inspector"></div></section><section data-defense-page="facilities" hidden><p>Build support works near this network.</p><div class="support-requests"><button data-facility="rest">Rest dugout</button><button data-facility="meal">Meal bay</button><button data-facility="store">Supply store</button></div><div class="facility-status"></div></section><section data-defense-page="support" hidden><p class="muted">Shared duty coordinator</p><p class="policy-status"></p></section></div><div class="garrison-emergency" hidden></div>`;
    this.element.querySelectorAll<HTMLButtonElement>('[data-defense-tab]').forEach(b=>b.onclick=()=>{for(const tab of this.element.querySelectorAll<HTMLButtonElement>('[data-defense-tab]'))tab.setAttribute('aria-pressed',String(tab===b));for(const p of this.element.querySelectorAll<HTMLElement>('[data-defense-page]'))p.hidden=p.dataset.defensePage!==b.dataset.defenseTab;});
    document.querySelector('#ui-root')!.append(this.element);
    const ammo=document.createElement('button');ammo.dataset.facility='ammo';ammo.textContent='Ammunition dugout';this.element.querySelector('.support-requests')!.append(ammo);
    for(const [kind,label] of [['aid','Aid post'],['emplacement','Weapon emplacement']] as const){const b=document.createElement('button');b.dataset.facility=kind;b.textContent=label;this.element.querySelector('.support-requests')!.append(b);}
    for(const button of this.element.querySelectorAll<HTMLButtonElement>('[data-facility]'))button.title='Choose a location 6–40m behind this network. Assigned engineers need delivered materials.';
    this.element.querySelector('summary span')!.textContent='Defense status';
    // Heading zero is +Z (map south); preserve saved angles, label them correctly.
    this.element.querySelector<HTMLOptionElement>('#garrison-front option[value="0"]')!.textContent='South';
    this.element.querySelector<HTMLOptionElement>('#garrison-front option[value="3.141592653589793"]')!.textContent='North';
    const guide=document.createElement('p');guide.className='trench-explanation';
    guide.textContent='Squads rotate watch, rest and supply duties. Move or Hold releases them from this area.';
    this.element.querySelector('[data-defense-page="defense"]')!.append(guide);
    const diagnostics=document.createElement('details');diagnostics.innerHTML='<summary>Coordinator diagnostics</summary>';
    const policy=this.element.querySelector('.policy-status')!;policy.previousElementSibling?.remove();policy.before(diagnostics);diagnostics.append(policy);
    this.element.insertBefore(this.element.querySelector('.garrison-emergency')!,this.element.querySelector('.garrison-content'));
    const review=document.createElement('div');review.className='supply-response';review.hidden=true;
    review.innerHTML='<p class="muted"></p><button data-review-supply>Review supply response</button>';
    this.element.querySelector('.garrison-vitals')!.after(review);
    const mortality=document.createElement('label');
    mortality.innerHTML='<input type="checkbox" id="lethal-deprivation"> Campaign: allow deprivation deaths';
    mortality.title='Opt-in harsh campaign rules. Applies to assigned garrisons, on and off screen. Supplies and rest are still required when disabled.';
    this.element.querySelector('[data-defense-page="support"]')!.append(mortality);
    mortality.querySelector<HTMLInputElement>('input')!.addEventListener('change',e=>{if(!this.locked())this.simulation.state.living!.lethalNeeds=(e.target as HTMLInputElement).checked;});
    const change=(id:string,fn:(value:string)=>void)=>this.element.querySelector<HTMLSelectElement>('#'+id)!.addEventListener('change',e=>{if(this.locked()&&['garrison-readiness','garrison-front','garrison-policy'].includes(id))return;fn((e.target as HTMLSelectElement).value);});
    change('garrison-choice',v=>{this.garrison=Number(v);this.listKey='';});
    change('soldier-choice',v=>this.person=Number(v));
    change('garrison-readiness',v=>this.simulation.garrisons.setReadiness(this.garrison,v as Readiness));
    change('garrison-front',v=>this.simulation.garrisons.setFront(this.garrison,Number(v)));
    this.element.querySelector<HTMLInputElement>('#logistics-routes')!.addEventListener('change',e=>this.showRoutes=(e.target as HTMLInputElement).checked);
    this.element.addEventListener('click',e=>{
      const target=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-decision],[data-review-supply]');if(!target||this.locked())return;
      if(target.hasAttribute('data-review-supply')){
        if(!this.simulation.garrisons.reopenEmergency(this.garrison))return;
        this.last=-Infinity;this.update(performance.now());this.element.scrollTop=0;
        this.element.querySelector<HTMLButtonElement>('[data-decision]')?.focus();
      }else{
        this.simulation.garrisons.resolveEmergency(Number(target.dataset.garrison),target.dataset.decision as 'hold'|'recover'|'withdraw');
        this.last=-Infinity;this.update(performance.now());
        const pending=this.element.querySelector<HTMLElement>('.garrison-emergency')!;
        const next=!pending.hidden?pending.querySelector<HTMLButtonElement>('button'):!review.hidden?review.querySelector<HTMLButtonElement>('button'):this.element.querySelector<HTMLElement>('summary');
        next?.focus();
      }
    });
    this.element.addEventListener('click',e=>{const target=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-facility]');if(target&&!this.locked()){if(this.placeFacility){this.placeFacility(this.garrison,target.dataset.facility as Facility['kind']);this.element.open=false;}else this.simulation.garrisons.requestFacility(this.garrison,target.dataset.facility as Facility['kind']);}});
  }
  private current(){return this.simulation.state.living?.garrisons.find(g=>g.id===this.garrison&&g.faction!=='enemy');}
  showForSquad(id:number):void {
    const g=this.simulation.state.living?.garrisons.find(g=>g.faction!=='enemy'&&g.squadIds.includes(id));if(!g)return;
    this.garrison=g.id;this.listKey='';this.element.open=true;this.last=-Infinity;this.update(performance.now());
  }
  update(now:number):void {
    if(now-this.last<250)return;this.last=now;
    const state=this.simulation.state,w=state.living!;
    const mortality=this.element.querySelector<HTMLInputElement>('#lethal-deprivation')!;mortality.checked=w.lethalNeeds;mortality.disabled=this.locked();
    const friendly=w.garrisons.filter(g=>g.faction!=='enemy');
    if(!this.current())this.garrison=friendly.find(g=>g.squadIds.length)?.id??0;
    const g=this.current(),key=friendly.map(g=>g.id+':'+g.squadIds.join(',')).join('|')+':'+this.garrison;
    if(key!==this.listKey){
      this.listKey=key;
      this.element.querySelector('#garrison-choice')!.innerHTML=friendly.map(g=>`<option value="${g.id}">${trenchName(state,g.trenchId)} · ${escape(g.name)}</option>`).join('');
      (this.element.querySelector('#garrison-choice') as HTMLSelectElement).value=String(this.garrison);
      const people=g?state.soldiers.filter(s=>s.garrisonId===g.id):[];
      this.element.querySelector('#soldier-choice')!.innerHTML=people.map(s=>`<option value="${s.id}">Soldier ${s.id} · ${escape(state.squads.find(q=>q.id===s.squadId)?.name??'')}</option>`).join('');
      this.person=people[0]?.id??0;
    }
    const summary=this.element.querySelector('#garrison-summary')!;
    for(const button of this.element.querySelectorAll<HTMLButtonElement>('[data-facility],[data-decision],[data-review-supply]'))button.disabled=this.locked()||!g;
    const review=this.element.querySelector<HTMLElement>('.supply-response')!;
    review.hidden=!g||!['hold','recover'].includes(g.cutoff);
    if(!review.hidden)review.querySelector('p')!.textContent=g!.cutoff==='hold'?'Holding & rationing. Parties already out will finish their trips. Review pauses play.':'Recovery authorized. Review pauses play so you can change the response.';
    if(g){
      const people=state.soldiers.filter(s=>s.garrisonId===g.id),sleeping=people.filter(s=>s.action==='sleeping').length,supply=garrisonSupplyReadout(state,g),{stock}=supply,withdrawn=g.cutoff==='withdraw',morale=people.reduce((n,s)=>n+s.morale,0)/Math.max(1,people.length);
      summary.textContent=people.length?(g.watchPresent>=g.watchRequired?'Ready':'Watch assembling')+' · '+people.filter(s=>s.needs!.life==='active').length+' personnel':'Unstaffed area';
      if(withdrawn)summary.textContent=withdrawalProgress(g,people);
      else if((g.underFireUntil??0)>state.elapsed)summary.textContent=`COMBAT ALARM · ${g.watchPresent}/${g.watchRequired} guarding`;
      this.element.querySelector('.garrison-vitals')!.setAttribute('aria-live','polite');
      this.element.querySelector('.garrison-vitals')!.innerHTML=`<strong>${g.watchPresent>=g.watchRequired?'Ready':'Watch assembling'}</strong><dl class="defense-overview"><dt>Personnel</dt><dd>${people.filter(s=>s.needs!.life==='active').length} / ${people.length} fit</dd><dt>Ammunition</dt><dd>${stock.ammo>people.length*10?'Good':'Limited'}</dd><dt>Supplies</dt><dd>${supply.issue?'Interrupted':supply.endurance<8?'Running low':'Stable'}</dd><dt>Morale</dt><dd>${morale<40?'Shaken':morale<70?'Uneasy':'Steady'}</dd><dt>Resting</dt><dd>${sleeping} personnel</dd></dl>`;
      this.element.querySelector('.supply-inventory')!.innerHTML=`<h3>${supply.label}</h3><p>Endurance ≈ ${supply.endurance.toFixed(1)} campaign hours</p><dl><dt>Food</dt><dd>${stock.food.toFixed(1)}</dd><dt>Water</dt><dd>${stock.water.toFixed(1)}</dd><dt>Materials</dt><dd>${stock.materials.toFixed(0)}</dd><dt>Ammunition</dt><dd>${stock.ammo.toFixed(0)}</dd></dl><p>${escape(g.cutoff)}${withdrawn?' · Supplies usable on arrival; trench stores remain separate.':''}</p>`;
      if(people.length&&g.watchPresent<g.watchRequired){const shortfall=document.createElement('p');shortfall.className='watch-shortage';shortfall.textContent=`Watch shortfall: ${g.watchRequired-g.watchPresent} required guards not at post.`;this.element.querySelector('.garrison-vitals')!.append(shortfall);}
      if(supply.issue){const warning=document.createElement('p');warning.className='watch-shortage';warning.textContent=supply.issue;this.element.querySelector('.garrison-vitals')!.append(warning);}
      if(!withdrawn&&(g.underFireUntil??0)>state.elapsed){const warning=document.createElement('p');warning.className='watch-shortage';warning.textContent=`Sector alarm: reinforce the threatened approach; ${g.reserveRequired??0} reserve requested. Other approaches retain observation. Routine returns after 30 quiet seconds.`;this.element.querySelector('.garrison-vitals')!.append(warning);}
      for(const [id,value] of [['garrison-readiness',g.readiness],['garrison-front',String(g.front)]]){const select=this.element.querySelector<HTMLSelectElement>('#'+id)!;select.value=value;select.disabled=this.locked();}
      const policyStatus=this.element.querySelector('.policy-status')!;policyStatus.setAttribute('title',g.policyStatus);
      policyStatus.textContent=withdrawn?'Withdrawn by your order · trench duties suspended':people.length?g.policyStatus.replace(/:[a-f0-9]{64}/g,hash=>hash.slice(0,13)+'…')+(g.scores.length?' · Scores [watch / patrol / rest / meals / haul / build]: '+g.scores.map(n=>n.toFixed(2)).join(' / '):''):'No assigned troops · coordinator inactive';
      if(this.element.open){
        this.element.querySelector('.facility-status')!.innerHTML=w.facilities.filter(f=>f.garrisonId===g.id).map(f=>`<p>${f.kind.toUpperCase()} · ${Math.round(f.progress*100)}% · ${f.paid?'materials delivered':'awaiting materials'}</p>`).join('');
        this.element.querySelector('.garrison-shipments')!.innerHTML=w.trucks.filter(t=>t.faction!=='enemy').map(t=>`<p>Truck ${t.id} · ${escape(t.reason)}<br>F ${t.cargo.food} / W ${t.cargo.water} / M ${t.cargo.materials} / A ${t.cargo.ammo} · fuel ${t.fuel.toFixed(1)}</p>`).join('');
        const s=state.soldiers.find(s=>s.id===this.person),n=s?.needs;
        this.element.querySelector('.soldier-inspector')!.innerHTML=s&&n?`<strong>${escape(s.action)}</strong><p>Energy ${n.energy.toFixed(0)} · Morale ${s.morale.toFixed(0)}<br>Hunger ${n.hunger.toFixed(0)} · Thirst ${n.thirst.toFixed(0)}<br>Health ${s.health.toFixed(0)} · ${n.life}<br>Sleep today ${n.sleepHours.toFixed(1)} h</p><p>${escape(s.duty?.reason??'Explicit squad orders')}<br>${s.duty?`Destination ${s.duty.destination.x.toFixed(0)}, ${s.duty.destination.z.toFixed(0)}`:''}</p>`:'';
        if(s?.combat){const p=document.createElement('p'),c=s.combat;p.textContent=[`Suppression ${s.suppression.toFixed(0)} · ${c.reaction??'steady'}`,c.weapon?`${c.weapon.id} · ${c.weapon.loaded} loaded / ${Math.floor(s.carried?.ammo??0)} total rounds`:undefined,c.wound?`${c.wound.severity} wound · ${c.wound.care}${c.wound.bleedUntil&&!c.wound.stabilized?` · critical, ${Math.max(0,Math.ceil(c.wound.bleedUntil-state.elapsed))}s remaining`:''}`:undefined,c.pauseReason].filter(Boolean).join(' · ');this.element.querySelector('.soldier-inspector')!.append(p);}
      }
    }else {
      summary.textContent='Select a squad → Defend trench [T]';
      for(const selector of ['.garrison-vitals','.policy-status','.garrison-shipments','.soldier-inspector'])this.element.querySelector(selector)!.textContent='';
      for(const id of ['garrison-readiness','garrison-front'])this.element.querySelector<HTMLSelectElement>('#'+id)!.disabled=true;
    }
    const alarm=friendly.find(g=>g.cutoff!=='withdraw'&&(g.underFireUntil??0)>state.elapsed);
    this.element.toggleAttribute('data-alarm',Boolean(alarm));
    if(alarm&&(!g||(g.underFireUntil??0)<=state.elapsed))summary.textContent=`COMBAT ALARM · ${alarm.name}`;
    const pending=friendly.find(g=>g.cutoff==='decision'),emergency=this.element.querySelector<HTMLElement>('.garrison-emergency')!;
    emergency.hidden=!pending;
    if(pending?.id!==this.emergencyId){this.emergencyId=pending?.id??0;if(pending)this.element.scrollTop=0;}
    if(pending){
      const reviewing=Boolean(document.documentElement.dataset.replay);
      summary.textContent=`${reviewing?'RECORDED':'SUPPLY'} EMERGENCY · ${pending.name}${reviewing?'':' · paused for your decision'}`;
      this.element.open=true;
      const key=`${pending.id}:${reviewing}:${this.locked()}`;
      if(emergency.dataset.state!==key){
        emergency.dataset.state=key;
        emergency.innerHTML=reviewing?'<strong>Recorded supply emergency</strong><p>Snapshot only. Decisions are disabled during replay review.</p>':`<strong>Supply emergency · simulation paused</strong><p>${escape(pending.name)} needs your decision.</p>${(['hold','recover','withdraw'] as const).map(c=>`<button data-garrison="${pending.id}" data-decision="${c}" ${this.locked()?'disabled':''}>${c==='hold'?'Hold & ration':c==='recover'?'Recover nearby crates':'Withdraw to supply point'}</button>`).join('')}`;
      }
    }
  }
}
