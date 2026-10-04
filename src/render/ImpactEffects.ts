import type {BattlefieldState} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {playerCanSeePoint,playerVisibleEnemies} from '../operations/Visibility';
import {hash2D} from '../core/random';
import {ParticlePool} from './ParticlePool';
import {VISUAL_QUALITY,type VisualQuality} from './VisualQuality';
import {environmentDaylight} from './EnvironmentLighting';
import {latestGunDischarge} from './SupportAnimation';
import type {ShotEvent} from '../combat/types';

interface Impact {key:string;id:number;at:number;x:number;y:number;z:number;blast:boolean;stone:boolean;heavy?:boolean}
export class ImpactEffects {
  readonly particles=new ParticlePool();
  private impacts:Impact[]=[];
  private remembered=new Set<string>();
  private identity?:object;
  private previous=-Infinity;
  private high=false;
  private quality:VisualQuality='balanced';
  private readonly motion=new Map<string,{x:number;z:number;at:number;movingUntil:number;heading:number}>();
  constructor(){this.setQuality('balanced');}
  setQuality(q:VisualQuality):void{this.quality=q;this.high=q==='high';this.particles.limit=VISUAL_QUALITY[q].particles;this.particles.setVolume(this.high);}
  update(state:BattlefieldState,terrain:TerrainSystem,arrivals?:ShotEvent[]):void{
    const op=state.operation,now=state.elapsed,pool=this.particles;
    pool.setAmbientLight(.22+.78*Math.min(1,environmentDaylight(state.living?.campaignHours??12)*2));
    if(this.identity!==op||now<this.previous){this.impacts=[];this.remembered.clear();this.motion.clear();this.identity=op;}this.previous=now;
    const enemies=new Set(state.squads.filter(s=>s.faction==='enemy').map(s=>s.id)),seen=playerVisibleEnemies(state);
    const friendly=state.soldiers.filter(s=>!enemies.has(s.squadId)&&s.needs?.life==='active');
    const visible=(p:{x:number;z:number})=>friendly.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<80)||playerCanSeePoint(state,terrain,p);
    const remember=(impact:Impact)=>{if(this.remembered.has(impact.key))return;this.remembered.add(impact.key);if(this.impacts.length>=160){const old=this.impacts.shift()!;this.remembered.delete(old.key);}this.impacts.push(impact);};
    for(const b of op?.blastEvents??[])if(now-b.at<1&&visible(b))remember({key:`b${b.id}`,id:b.id,at:b.at,x:b.x,y:terrain.heightAt(b.x,b.z)+.15,z:b.z,blast:true,stone:false,heavy:b.radius>25});
    for(const s of arrivals??op?.shotEvents??[])if(s.obstruction&&(arrivals!==undefined||now-s.at<.25)&&visible(s.to)&&(!enemies.has(s.squadId)||seen.has(s.shooterId)||friendly.some(f=>Math.hypot(f.x-s.to.x,f.z-s.to.z)<50)))remember({key:`s${s.id}`,id:s.id,at:arrivals?now:s.at,...s.to,blast:false,stone:s.obstruction==='building'});
    this.impacts=this.impacts.filter(i=>{if(now-i.at<(i.blast?7:1.1))return true;this.remembered.delete(i.key);return false;});pool.begin();
    // Three bounded muzzle-dust particles per actual launch, shared quality cap.
    // Unseen enemy guns do not gain a marker or reveal their crew.
    for(const f of state.living?.facilities??[]){
      if(!f.artillery||state.living!.garrisons.find(g=>g.id===f.garrisonId)?.faction==='enemy'&&!playerCanSeePoint(state,terrain,f))continue;
      const shot=latestGunDischarge(state,f.id);if(!shot)continue;const age=now-shot.launchAt;if(age>2)continue;
      const a=Math.atan2(shot.target.x-f.x,shot.target.z-f.z),x=f.x+Math.sin(a)*3.3,z=f.z+Math.cos(a)*3.3;
      for(let i=0;i<3;i++)pool.add(x+Math.sin(a)*age*(i+1)*.5,terrain.heightAt(f.x,f.z)+2.1+age*.5,z+Math.cos(a)*age*(i+1)*.5,.4+age*1.1,.35+age*.6,0xa49d89,(1-age/2)*.38);
    }
    // Only simulation smoke fields get a sustained smoke column. Dust below never
    // modifies concealment, collision or the serialized battlefield.
    for(const c of op?.smokeFields??[]){
      const playerKnown=c.side==='player'&&(c.source==='PLAYER'||c.source==='LEGACY_UNKNOWN');
      if(!playerKnown&&!visible(c))continue;const life=Math.min(1,(now-c.born+1)/4,(c.until-now)/10);if(life<=0)continue;
      const floor=terrain.heightAt(c.x,c.z),age=now-c.born;
      // Gameplay smoke fills essentially the same footprint used by
      // smokeTransmission. Performance uses fewer, larger volumes; it never
      // makes the concealment disappear. A low skirt makes trench smoke read
      // as occupying the ground instead of hovering over one faint centre.
      const puffs=this.quality==='low'?18:this.high?40:28;
      for(let n=0;n<puffs;n++){const a=n*2.399,r=c.radius*.86*Math.sqrt((n+.5)/puffs)*life,drift=Math.sin(age*.12+n)*.32*life;
        const low=n%3===0,height=low?.7:1.35+n%5*.9*life,width=Math.max(11,c.radius*(this.high?.52:this.quality==='balanced'?.62:.74))*life;
        // Smoke is gameplay information. Keep its pale body independent of
        // shadow quality and ambient-light multiplication; concealment must
        // never become a handful of faint grey flecks on low settings.
        pool.add(c.x+Math.cos(a)*r+drift,floor+height,c.z+Math.sin(a)*r,width,(low?5.5:10.5+n%3)*life,low?0xbfc1b8:0xd0d1c8,(this.high?.88:.94)*life,true);}
    }
    for(const i of this.impacts){const age=Math.max(0,now-i.at);if(!visible(i))continue;
      if(i.blast){
        const scale=i.heavy?2.5:1;
        // Very brief flash, then dirty thrown earth, never a persistent fireball.
        if(age<.10)pool.add(i.x,i.y+.5,i.z,2.5*scale,2*scale,0xe5bd77,(1-age/.1)*.9,true);
        for(let n=0;n<(this.high?30:20);n++){const h=hash2D(n,i.id,29),a=n*2.399+i.id,r=(.8+age*1.35)*(h+.2),fade=Math.max(0,1-age/7);
          pool.add(i.x+Math.cos(a)*r*scale,i.y+.35+Math.min(2.8,age*1.3)*(1+h)*scale,i.z+Math.sin(a)*r*scale,(1.2+age*.85)*(1+h)*scale,(1.2+age*.7)*scale,n%3?0x928678:0x6b6258,fade*.50);
          if(age<1.2){const t=age*2.3,flight=Math.max(0,t*(2.5+h*3)-4.9*t*t);pool.add(i.x+Math.cos(a)*t*3,i.y+flight+.15,i.z+Math.sin(a)*t*3,.10+h*.15,.16+h*.2,0x51473b,1-age/1.2);}
        }
      }else{
        const fade=Math.max(0,1-age/1.1);for(let n=0;n<(this.high?5:3);n++)pool.add(i.x+Math.sin(n*2.4+i.id)*age*.30,i.y+.05+age*.35,i.z+Math.cos(n*2.4+i.id)*age*.30,.18+age*.7,.2+age*.65,i.stone?0xb7b3a4:0x8d7c63,fade*.7);
      }
    }
    if(this.high){
      // Dust trails need actual displacement. Visibility is checked before
      // emitting; unseen trucks or soldiers never advertise their location.
      const dust=(key:string,p:{x:number;z:number},vehicle:boolean)=>{
        let m=this.motion.get(key);if(!m){m={...p,at:now,movingUntil:now,heading:0};this.motion.set(key,m);}
        if(now-m.at>.15){const d=Math.hypot(p.x-m.x,p.z-m.z);if(d>.09){m.movingUntil=now+.5;m.heading=Math.atan2(p.x-m.x,p.z-m.z);}m.x=p.x;m.z=p.z;m.at=now;}
        if(m.movingUntil<=now)return;
        const floor=terrain.heightAt(p.x,p.z);if(terrain.baseHeightAt(p.x,p.z)-floor>.4)return;
        const fade=Math.min(1,(m.movingUntil-now)*2),n=vehicle?4:1;
        for(let i=0;i<n;i++){const offset=(vehicle?2.5:.5)+i*.9;pool.add(p.x-Math.sin(m.heading)*offset,floor+.2+i*.14,p.z-Math.cos(m.heading)*offset,vehicle?2.2:.6,vehicle?.8:.4,0xada088,fade*(vehicle?.20:.12));}
      };
      for(const t of state.living?.trucks??[])if(['outbound','returning'].includes(t.state)&&(t.faction!=='enemy'||playerCanSeePoint(state,terrain,t)))dust('t'+t.id,t,true);
      for(const s of state.soldiers)if(s.needs?.life==='active'&&(!enemies.has(s.squadId)||seen.has(s.id)))dust('s'+s.id,s,false);
      for(const [key,m]of this.motion)if(now-m.at>3)this.motion.delete(key);
    }else this.motion.clear();
    pool.end();
  }
}
