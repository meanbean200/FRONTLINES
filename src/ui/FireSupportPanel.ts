import type {BattlefieldState} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {crewOperator} from '../combat/WeaponPositions';
import {cancelSupportMission,supportReadiness,supportMissionText} from '../combat/SupportWeapons';
import {facilityName} from '../construction/PositionDefinitions';
import {updateLiveContent} from './LiveContent';
import {supportPositionStatus} from './WeaponReadout';

type Kind='mortarHE'|'mortarSmoke';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Selection is UI state; each selected gun retains its own crew and stock. */
export class FireSupportPanel {
  private chosen=new Set<number>();
  private kind:Kind='mortarHE';
  private locked=false;
  private state?:BattlefieldState;
  private ready=new Set<number>();
  constructor(private root:HTMLElement,private terrain:TerrainSystem,private actions:{target:(ids:number[],kind:Kind)=>void;staff:(ids:number[])=>void;inspect:(id:number)=>void;build:()=>void}){
    root.addEventListener('change',e=>{
      const input=e.target as HTMLInputElement;
      if(input.id==='fire-ammunition')this.kind=input.value as Kind;
      if(input.dataset.fireGun){const id=Number(input.dataset.fireGun);if(input.checked)this.chosen.add(id);else this.chosen.delete(id);}
      if(this.state)this.render(this.state,this.locked);
    });
    root.addEventListener('click',e=>{
      const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b||this.locked||!this.state)return;
      if(b.hasAttribute('data-fire-ready'))this.chosen=new Set(this.ready);
      if(b.hasAttribute('data-fire-clear'))this.chosen.clear();
      if(b.dataset.fireBattery)this.chosen=new Set(this.friendly(this.state).filter(f=>f.artillery?.batteryId===Number(b.dataset.fireBattery)).map(f=>f.id));
      if(b.dataset.supportPosition)this.actions.inspect(Number(b.dataset.supportPosition));
      if(b.hasAttribute('data-fire-build'))this.actions.build();
      if(b.hasAttribute('data-fire-target'))this.actions.target([...this.chosen],this.kind);
      if(b.hasAttribute('data-fire-staff'))this.actions.staff([...this.chosen]);
      if(b.dataset.cancelMission)cancelSupportMission(this.state,Number(b.dataset.cancelMission));
      this.render(this.state,this.locked);
    });
  }
  reset(){this.chosen.clear();this.state=undefined;}
  private friendly(state:BattlefieldState){return state.living!.facilities.filter(f=>f.kind==='mortar'&&state.living!.garrisons.some(g=>g.id===f.garrisonId&&g.faction!=='enemy'));}
  render(state:BattlefieldState,locked:boolean){
    this.state=state;this.locked=locked;
    const guns=this.friendly(state);for(const id of this.chosen)if(!guns.some(f=>f.id===id))this.chosen.delete(id);
    this.ready.clear();
    const rows=guns.map(f=>{
      const operator=crewOperator(state,f),r=operator?supportReadiness(state,this.kind,operator.squadId,this.terrain,true,f.id):undefined;
      const reason=f.progress<1?'Under construction':supportPositionStatus(state,f,r?.reason??'Assign a gunner and assistant');
      if(!reason)this.ready.add(f.id);
      return `<div class="fire-weapon" data-fire-row="${f.id}"><label><input type="checkbox" data-fire-gun="${f.id}" ${this.chosen.has(f.id)?'checked':''} ${locked?'disabled':''}><span><strong>${esc(facilityName(state,f))}</strong><small>${esc(reason||'Ready')} · crew ${f.weaponCrewIds?.length??0}/2</small><small>HE ${Math.floor(f.stock.mortarHE)} · smoke ${Math.floor(f.stock.mortarSmoke)} · facing ${(Math.round((f.facing??0)*180/Math.PI)+360)%360}°</small></span></label><button data-support-position="${f.id}" title="Inspect crew, ammunition and facing">Details</button></div>`;
    }).join('');
    const batteries=[...new Set(guns.filter(f=>(f.artillery?.size??0)>1).map(f=>f.artillery!.batteryId))];
    const missions=(state.operation?.supportMissions??[]).filter(m=>state.squads.some(q=>q.id===m.squadId&&q.faction!=='enemy')).slice(-5).map(m=>{const f=guns.find(f=>f.id===m.positionId);return `<p data-fire-mission="${m.id}">${esc(f?facilityName(state,f):'Support')} · ${esc(supportMissionText(m,state.elapsed))}${m.stage==='preparing'?` <button data-cancel-mission="${m.id}" ${locked?'disabled':''}>Cancel</button>`:''}</p>`;}).join('');
    const ready=[...this.chosen].filter(id=>this.ready.has(id)).length;
    updateLiveContent(this.root,`<div class="fire-selection"><button data-fire-ready ${locked?'disabled':''}>All ready</button><button data-fire-clear>Clear</button>${batteries.map(id=>{const members=guns.filter(f=>f.artillery?.batteryId===id);return `<button data-fire-battery="${id}" ${locked?'disabled':''}>Battery ${id} · ${members.filter(f=>this.ready.has(f.id)).length}/${members.length} ready</button>`;}).join('')}</div><div class="fire-weapon-list">${rows||'<p>No indirect weapons built. Build a field gun or battery, then assign its crew.</p>'}</div><button data-fire-staff ${locked||!this.chosen.size?'disabled':''}>Staff selected weapons</button><div class="fire-order"><label>Ammunition<select id="fire-ammunition"><option value="mortarHE" ${this.kind==='mortarHE'?'selected':''}>High explosive</option><option value="mortarSmoke" ${this.kind==='mortarSmoke'?'selected':''}>Smoke</option></select></label><button data-fire-target ${locked||!ready?'disabled':''}>Choose target · ${ready} ready</button></div><p class="fire-help">${this.chosen.size-ready?`${this.chosen.size-ready} selected unavailable · reasons above. `:''}Choose guns, then one target. Each ready weapon uses its own ammunition.</p><button data-fire-build ${locked?'disabled':''}>Build weapon positions →</button><details class="fire-missions"><summary>Recent missions</summary>${missions||'<p>No missions ordered.</p>'}</details>`);
  }
}
