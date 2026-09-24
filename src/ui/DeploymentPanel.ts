import type {BattlefieldState} from '../core/types';
import {SANDBOX_PERSONNEL_LIMIT,type DeploymentKind} from '../simulation/SandboxDeployment';
import {fieldIcon} from './FieldSymbols';

/** Normal player controls, separate from the developer stress fixture. */
export class DeploymentPanel {
  private readonly element=document.createElement('section');
  private readonly button=document.createElement('button');
  private last='';
  constructor(private getState:()=>BattlefieldState,private place:(kind:DeploymentKind,count:number)=>void){
    const root=document.querySelector<HTMLElement>('#ui-root')!;
    this.button.id='deployment-command';this.button.setAttribute('aria-controls','deployment-panel');this.button.setAttribute('aria-expanded','false');root.querySelector('.battle-tools')!.prepend(this.button);
    this.element.id='deployment-panel';this.element.className='deployment-panel';this.element.hidden=true;this.element.setAttribute('aria-label','Troop deployment');
    this.element.innerHTML='<header><h2>Troop deployment</h2><button aria-label="Close troop deployment">×</button></header><p class="deployment-status"></p><div class="deployment-choices"><label>Squads per placement<select aria-label="Squads per placement"><option value="1">1 squad · 8 personnel</option><option value="3">3 squads · 24 personnel</option><option value="5">5 squads · 40 personnel</option></select></label><button data-deploy="rifle">Rifle squad <small>Move, hold and defend trenches</small></button><button data-deploy="engineer">Engineer team <small>Dig trenches and build support works</small></button><p>Choose a team, then click clear ground. Repeat to add more; Esc finishes. New troops carry finite rations and ammunition. This peaceful sandbox has no enemy combat.</p></div>';
    root.append(this.element);
    this.button.onclick=()=>{if(!this.element.hidden){this.close();return;}window.dispatchEvent(new Event('frontlines-menu'));this.element.hidden=false;this.button.setAttribute('aria-expanded','true');this.update();};
    this.element.querySelector('header button')!.addEventListener('click',()=>this.close());
    this.element.querySelectorAll<HTMLButtonElement>('[data-deploy]').forEach(b=>b.onclick=()=>{const count=Number(this.element.querySelector('select')!.value);this.close();this.place(b.dataset.deploy as DeploymentKind,count);});
    window.addEventListener('frontlines-menu',()=>this.close());
    window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!this.element.hidden){this.close();e.preventDefault();e.stopImmediatePropagation();}},true);
  }
  private close(){this.element.hidden=true;this.button.setAttribute('aria-expanded','false');}
  update(){
    const state=this.getState(),op=state.operation,pool=op?.campaign?.replacements;
    this.button.disabled=Boolean(document.documentElement.dataset.replay||document.documentElement.dataset.help||op&&op.status!=='active');
    const label=op?'Reserves':'Add troops';if(this.button.dataset.label!==label){this.button.dataset.label=label;this.button.innerHTML=fieldIcon('force')+label;}
    if(this.element.hidden)return;
    const text=!op?`${state.soldiers.length} / ${SANDBOX_PERSONNEL_LIMIT} personnel on the map. Place squads directly in Sandbox.`:pool?`${pool.reserve.player} personnel left in reserve · ${pool.manifests.filter(m=>m.side==='player'&&m.stage!=='arrived').length} replacement groups in transit. Losses are filled automatically through the rear transport chain, at most 8 personnel per campaign day. Next release in ${Math.max(0,pool.nextAt.player-(state.living?.campaignHours??0)).toFixed(1)} campaign hours.`:'This is a finite-force operation: your starting roster is the whole force. There are no extra troops to summon mid-battle. For a larger starting force choose Large in Quick Battle. For direct troop spawning choose Sandbox from the main menu.';
    if(text!==this.last){this.last=text;this.element.querySelector('.deployment-status')!.textContent=text;}
    this.element.querySelector<HTMLElement>('.deployment-choices')!.hidden=Boolean(op);
  }
}
