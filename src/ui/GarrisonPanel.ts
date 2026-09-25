import type {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {connectedName} from './TrenchReadout';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Emergency decisions only. All ordinary management redirects to Position. */
export class GarrisonPanel {
  readonly element=document.createElement('details');
  readonly showRoutes=false;
  private last=0;
  private locked(){return Boolean(document.documentElement.dataset.replay||document.documentElement.dataset.menu||document.documentElement.dataset.help||this.simulation.commandsLocked);}
  constructor(private simulation:BattlefieldSimulation,private openPosition:(trenchId:number)=>void){
    this.element.className='garrison-panel';this.element.hidden=true;
    this.element.innerHTML='<summary><span>Supply decision</span><small id="garrison-summary"></small><b aria-hidden="true">×</b></summary><div class="garrison-emergency"></div>';
    document.querySelector('#ui-root')!.append(this.element);
    this.element.addEventListener('click',e=>{
      const b=(e.target as Element).closest<HTMLButtonElement>('[data-decision]');if(!b||this.locked())return;
      this.simulation.garrisons.resolveEmergency(Number(b.dataset.garrison),b.dataset.decision as 'hold'|'recover'|'withdraw');this.last=-Infinity;this.update(performance.now());
    });
  }
  showForSquad(id:number):void{
    const g=this.simulation.state.living?.garrisons.find(g=>g.faction!=='enemy'&&g.squadIds.includes(id));if(g)this.openPosition(g.trenchId);
  }
  update(now:number):void{
    if(now-this.last<250)return;this.last=now;
    const state=this.simulation.state,pending=state.living!.garrisons.find(g=>g.faction!=='enemy'&&g.cutoff==='decision');
    this.element.hidden=!pending;if(!pending){this.element.open=false;return;}
    this.element.open=true;
    const reviewing=Boolean(document.documentElement.dataset.replay),name=connectedName(state,this.simulation.garrisons.network,pending.trenchId),key=name+':'+pending.id+':'+reviewing+':'+this.locked();
    this.element.querySelector('#garrison-summary')!.textContent=name+' · paused for your decision';
    const content=this.element.querySelector<HTMLElement>('.garrison-emergency')!;content.hidden=false;
    if(content.dataset.state===key)return;content.dataset.state=key;
    content.innerHTML=reviewing?'<strong>Recorded supply emergency</strong><p>Decisions are disabled during replay review.</p>':'<strong>Supply emergency · simulation paused</strong><p>'+esc(name)+' needs food or water. Choose how to respond.</p>'+(['hold','recover','withdraw'] as const).map(c=>'<button data-garrison="'+pending.id+'" data-decision="'+c+'" '+(this.locked()?'disabled':'')+'>'+(c==='hold'?'Hold & ration':c==='recover'?'Recover nearby crates':'Withdraw to supply point')+'</button>').join('');
    this.element.scrollTop=0;
  }
}
