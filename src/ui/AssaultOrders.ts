import type {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {previewAssault} from '../operations/AssaultPlan';
import {updateLiveContent} from './LiveContent';
import './assault-orders.css';
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Consequence review only; the fixed-tick command revalidates before release. */
export class AssaultOrders {
  readonly element=document.createElement('section');
  private key='';private next=0;
  constructor(private sim:BattlefieldSimulation,notify:(text:string)=>void){
    this.element.id='assault-orders';this.element.hidden=true;this.element.setAttribute('aria-label','Assault preparation');
    document.querySelector('#ui-root')!.append(this.element);
    this.element.addEventListener('click',e=>{
      const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;
      const pending=(sim.state.preparedOrders??[]).filter(o=>o.assault&&o.releasedAt===undefined);
      if(b.dataset.staffing)for(const o of pending)sim.prepareOrder([o.squadId],'assault',o.target,o.networkId,b.dataset.staffing==='all-in',o.assault!.sourcePositionIds);
      if(b.hasAttribute('data-assault-go')){sim.signalPrepared();notify(sim.lastSignalReason);}
      if(b.hasAttribute('data-assault-cancel'))sim.cancelPrepared(pending.map(o=>o.squadId));
      this.next=0;this.update();
    });
    this.element.addEventListener('change',e=>{
      const select=e.target as HTMLSelectElement;if(!select.hasAttribute('data-assault-source')||!select.value)return;
      const pending=(sim.state.preparedOrders??[]).filter(o=>o.assault&&o.releasedAt===undefined),first=pending[0];if(!first)return;
      const source=Number(select.value),ids=[...new Set(sim.state.soldiers.filter(s=>s.garrisonId===source).map(s=>s.squadId))];
      sim.cancelPrepared(pending.map(o=>o.squadId));sim.prepareOrder(ids,'assault',first.target,first.networkId,first.assault!.staffing==='all-in',[source]);this.next=0;this.update();
    });
  }
  update():void{
    const now=performance.now();if(now<this.next)return;this.next=now+200;
    const state=this.sim.state,orders=(state.preparedOrders??[]).filter(o=>o.assault&&o.releasedAt===undefined);
    const wasHidden=this.element.hidden;
    this.element.hidden=!orders.length||Boolean(document.documentElement.dataset.menu);
    document.documentElement.toggleAttribute('data-assault-review',!this.element.hidden);if(this.element.hidden)return;
    if(wasHidden)window.dispatchEvent(new Event('frontlines-assault-review'));
    const allIn=orders.some(o=>o.assault!.staffing==='all-in'),ids=[...new Set(orders.flatMap(o=>o.assault!.participantIds))];
    const names=(ids:number[])=>ids.map(id=>{const s=state.soldiers.find(s=>s.id===id),q=state.squads.find(q=>q.id===s?.squadId);return esc(`${q?.name??'Person'} ${id}`);}).join(', ')||'None';
    const weaponIds=[...new Set(orders.flatMap(o=>o.assault!.preview.weaponIds))],workIds=[...new Set(orders.flatMap(o=>o.assault!.preview.workIds))],sources=[...new Set(orders.flatMap(o=>o.assault!.preview.sourcePositionIds))];
    const aggregate=previewAssault(state,orders.map(o=>o.squadId),allIn?'all-in':'normal',orders.every(o=>o.assault!.sourcePositionIds)?sources:undefined);
    const exclusions=orders.flatMap(o=>o.assault!.preview.excluded),changed=orders.some(o=>o.assault!.reviewRequired);
    const html=`<header><small>FIELD ORDER / ASSAULT</small><h2>${allIn?'ALL IN — release protected personnel':'Prepare assault'}</h2></header><p>Preview only. Current duties continue until GO.</p>
      <label>Personnel source<select data-assault-source aria-label="Assault personnel source"><option value="">Selected formations</option>${(state.living?.garrisons??[]).filter(g=>g.faction!=='enemy').map(g=>`<option value="${g.id}" ${orders.every(o=>o.assault!.sourcePositionIds?.includes(g.id))?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>
      <div class="assault-mode"><button data-staffing="normal" aria-pressed="${!allIn}">NORMAL</button><button data-staffing="all-in" aria-pressed="${allIn}">ALL IN</button></div>
      ${changed?'<strong role="status">Consequences changed. Review before confirming again.</strong>':''}
      <dl><dt>Selected / excluded</dt><dd>${ids.length} / ${exclusions.length}</dd><dt>Weapons losing crews</dt><dd>${weaponIds.length}</dd><dt>Worksites releasing workers</dt><dd>${workIds.length}</dd><dt>Remaining defenders / ready weapons</dt><dd>${aggregate.remainingDefenders} / ${aggregate.remainingReadyWeapons}</dd></dl>
      <details><summary>People and consequences</summary><p>Selected: ${names(ids)}</p>${exclusions.map(e=>`<p>${names([e.id])} — ${esc(e.reason)}</p>`).join('')}<p>Wake: ${names(orders.flatMap(o=>o.assault!.preview.awakenedIds))}</p><p>Unarmed: ${names(orders.flatMap(o=>o.assault!.preview.unarmedIds))}</p><p>Low ammunition: ${names(orders.flatMap(o=>o.assault!.preview.lowAmmoIds))}</p><p>Weapon posts: ${weaponIds.join(', ')||'None'}. Worksites: ${workIds.join(', ')||'None'}.</p></details>
      <small>Guns stay here. Cargo stays physical. Critical recovery and casualty care cannot be overridden.</small><footer><button data-assault-cancel>Cancel preview</button><button data-assault-go ${!ids.length||orders.every(o=>o.signalAt!==undefined)?'disabled':''}>${allIn?'Confirm ALL IN · GO':'Confirm · GO'}</button></footer>`;
    if(html!==this.key){this.key=html;updateLiveContent(this.element,html);}
  }
}
