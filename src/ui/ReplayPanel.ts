import type { BattlefieldState } from '../core/types';
import { SaveSystem } from '../persistence/SaveSystem';
import {motionFrameDelay} from './ReplayTiming';

/** Replay snapshots are evidence, not live AI decisions. Never overwrite the campaign save. */
export class ReplayPanel {
  private element=document.createElement('section');
  private entries:{name:string;frames:BattlefieldState[]}[]=[];
  private original?:BattlefieldState;
  private selected=0;
  private frame=0;
  private loadRevision=0;
  private playback?:ReturnType<typeof setTimeout>;
  constructor(private getState:()=>BattlefieldState,private restore:(state:BattlefieldState)=>void,private focus:(x:number,z:number)=>void){
    this.element.className='replay-review';this.element.hidden=true;
    this.element.innerHTML='<strong>Matched replay review · recorded states, not live simulation</strong><button class="replay-close">Return to campaign</button><label>Load local replay JSON files <input type="file" multiple accept="application/json,.json"></label><label>Candidate <select aria-label="Replay candidate"></select></label><input aria-label="Replay time" type="range" min="0" max="0" value="0"><button class="replay-play" disabled>Play motion clip · 1×</button><p class="replay-time">Choose the replay-*.json files from the study output. Long-run snapshots use the slider; dense motion clips can play.</p>';
    document.querySelector('#ui-root')!.append(this.element);
    const open=document.createElement('button');open.textContent='Review matched replays';document.querySelector('.developer-actions')!.append(open);
    open.addEventListener('click',()=>{if(!this.original)this.original=structuredClone(this.getState());this.getState().simSpeed=0;this.element.hidden=false;document.documentElement.dataset.replay='true';});
    this.element.querySelector('.replay-close')!.addEventListener('click',()=>{this.stopPlayback();this.loadRevision++;if(this.original)this.restore(this.original);this.original=undefined;this.element.hidden=true;delete document.documentElement.dataset.replay;});
    this.element.querySelector<HTMLInputElement>('input[type=file]')!.addEventListener('change',async e=>{
      this.stopPlayback();
      const revision=++this.loadRevision;
      try{
        const files=Array.from((e.target as HTMLInputElement).files??[]),entries=[];
        for(const file of files){
          if(file.size>60_000_000)throw new Error('Replay exceeds the 60 MB limit.');
          const text=await file.text();
          if(revision!==this.loadRevision||!this.original)return;
          const raw=JSON.parse(text) as unknown;
          if(!Array.isArray(raw)||raw.length===0||raw.length>2000)throw new Error('Expected a non-empty array of replay snapshots.');
          const save=new SaveSystem(),frames=raw.map(value=>save.parse(JSON.stringify(value)));
          entries.push({name:file.name,frames});
        }
        if(entries.length>1){
          const reference=entries[0].frames,first=reference[0];
          if(entries.some(e=>e.frames[0].seed!==first.seed||e.frames[0].soldiers.length!==first.soldiers.length||e.frames.length!==reference.length||e.frames.some((f,i)=>Math.abs(f.elapsed-reference[i].elapsed)>.001||Math.abs(f.living!.campaignHours-reference[i].living!.campaignHours)>.001)))throw new Error('Choose candidates from the same scenario folder with matching world seed and complete snapshot times.');
        }
        this.entries=entries;this.selected=0;this.frame=0;
        const select=this.element.querySelector('select')!;select.replaceChildren(...entries.map((entry,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=entry.name;return option;}));
        this.show();
      }catch(error){if(revision===this.loadRevision&&this.original)this.element.querySelector('.replay-time')!.textContent=`Replay rejected: ${String(error)}`;}
    });
    this.element.querySelector('select')!.addEventListener('change',e=>{this.stopPlayback();this.selected=Number((e.target as HTMLSelectElement).value);this.show();});
    this.element.querySelector<HTMLInputElement>('input[type=range]')!.addEventListener('input',e=>{this.stopPlayback();this.frame=Number((e.target as HTMLInputElement).value);this.show();});
    this.element.querySelector('.replay-play')!.addEventListener('click',()=>{
      if(this.playback!==undefined){this.stopPlayback();return;}
      const entry=this.entries[this.selected];if(!entry||!this.original)return;
      if(this.frame>=entry.frames.length-1){this.frame=0;this.show();}
      this.element.querySelector('.replay-play')!.textContent='Pause motion clip';this.scheduleFrame();
    });
  }
  private stopPlayback():void {
    if(this.playback!==undefined)clearTimeout(this.playback);this.playback=undefined;
    this.element.querySelector('.replay-play')!.textContent='Play motion clip · 1×';
  }
  private scheduleFrame():void {
    const entry=this.entries[this.selected];
    if(!this.original||!entry||this.frame>=entry.frames.length-1){this.stopPlayback();return;}
    const delay=motionFrameDelay(entry.frames[this.frame].elapsed,entry.frames[this.frame+1].elapsed);
    if(delay===undefined){this.stopPlayback();return;}
    this.playback=setTimeout(()=>{this.frame++;this.show();this.scheduleFrame();},delay);
  }
  private show():void {
    const entry=this.entries[this.selected];if(!entry)return;
    this.frame=Math.min(this.frame,entry.frames.length-1);
    const state=structuredClone(entry.frames[this.frame]);state.simSpeed=0;this.restore(state);
    const slider=this.element.querySelector<HTMLInputElement>('input[type=range]')!;slider.max=String(entry.frames.length-1);slider.value=String(this.frame);
    this.element.querySelector<HTMLButtonElement>('.replay-play')!.disabled=entry.frames.length<2||entry.frames.slice(1).some((f,i)=>motionFrameDelay(entry.frames[i].elapsed,f.elapsed)===undefined);
    const w=state.living!,g=w.garrisons.find(g=>g.faction!=='enemy'&&g.squadIds.length>0),q=state.squads.find(q=>q.faction!=='enemy');if(g)this.focus(g.entrance.x+40,g.entrance.z);else if(q)this.focus(q.x,q.z);
    this.element.querySelector('.replay-time')!.textContent=`Frame ${this.frame+1}/${entry.frames.length} · campaign hour ${w.campaignHours.toFixed(1)} · watch ${g?.watchPresent??0}/${g?.watchRequired??0} · deaths ${w.metrics.deaths}. Switch candidate to compare the same snapshot index. These are recorded outcomes; believability is your judgment.`;
  }
}
