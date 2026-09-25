import type {BattlefieldState} from '../core/types';
import {currentWeapon} from '../combat/WeaponPositions';
/** Procedural placeholder sounds, driven by the same recorded shot/impact events.
 * Unseen shots are non-positional: hearing a gun does not locate its shooter. */
export class CombatAudio {
  private context?:AudioContext;private buffer?:AudioBuffer;private heard=new Set<string>();private identity?:object;
  muted=false;
  constructor(private getState:()=>BattlefieldState){window.addEventListener('pointerdown',()=>{if(!this.context){this.context=new AudioContext();this.buffer=this.context.createBuffer(1,12000,this.context.sampleRate);const data=this.buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.sin(i*417.31)+Math.sin(i*i*1.723))*.5;}void this.context.resume();},{once:true});}
  update():void {
    const state=this.getState(),op=state.operation;if(this.identity!==op){this.identity=op;this.heard.clear();}
    if(!op||!this.context||this.context.state!=='running'||this.muted||document.documentElement.dataset.menu||document.documentElement.dataset.replay)return;
    const enemy=new Set(state.squads.filter(q=>q.faction==='enemy').map(q=>q.id)),listeners=state.soldiers.filter(s=>!enemy.has(s.squadId)&&s.needs?.life==='active');
    for(const shot of op.shotEvents??[]){const key='s'+shot.id;if(this.heard.has(key)||state.elapsed-shot.at>.2)continue;this.heard.add(key);
      const distance=Math.min(Infinity,...listeners.map(s=>Math.hypot(s.x-shot.from.x,s.z-shot.from.z)));if(distance>300)continue;
      const shooter=state.soldiers.find(s=>s.id===shot.shooterId),weapon=shooter?currentWeapon(state,shooter)?.id:undefined,heavy=weapon==='mg42'||weapon==='crew-mg',automatic=heavy||weapon==='bar'||weapon==='smg';
      this.sound(heavy?600:automatic?1000:1700,automatic?.075:.14,.025/(1+distance/90));
      if(shot.obstruction&&listeners.some(s=>Math.hypot(s.x-shot.to.x,s.z-shot.to.z)<20))this.sound(2500,.07,.012,.04);
    }
    for(const blast of op.blastEvents??[]){const key='b'+blast.id;if(this.heard.has(key)||state.elapsed-blast.at>.2)continue;this.heard.add(key);if(listeners.some(s=>Math.hypot(s.x-blast.x,s.z-blast.z)<450))this.sound(160,.45,.075);}
    if(this.heard.size>2048)this.heard=new Set([...this.heard].slice(-512));
  }
  private sound(frequency:number,duration:number,volume:number,delay=0):void{const c=this.context!,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),at=c.currentTime+delay;source.buffer=this.buffer!;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);source.connect(filter).connect(gain).connect(c.destination);source.start(at);source.stop(at+duration);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
}
