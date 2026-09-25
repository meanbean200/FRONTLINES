import type {BattlefieldState} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {playerCanSeePoint,playerVisibleEnemies} from '../operations/Visibility';
import {hash2D} from '../core/random';
import {ParticlePool} from './ParticlePool';
import {VISUAL_QUALITY,type VisualQuality} from './VisualQuality';
import {environmentDaylight} from './EnvironmentLighting';

interface Impact {key:string;id:number;at:number;x:number;y:number;z:number;blast:boolean;stone:boolean;heavy?:boolean}
export class ImpactEffects {
  readonly particles=new ParticlePool();
  private impacts:Impact[]=[];
  private remembered=new Set<string>();
  private identity?:object;
  private previous=-Infinity;
  constructor(){this.setQuality('balanced');}
  setQuality(q:VisualQuality):void{this.particles.limit=VISUAL_QUALITY[q].particles;}
  update(state:BattlefieldState,terrain:TerrainSystem):void{
    const op=state.operation,now=state.elapsed,pool=this.particles;
    pool.setAmbientLight(.22+.78*Math.min(1,environmentDaylight(state.living?.campaignHours??12)*2));
    if(this.identity!==op||now<this.previous){this.impacts=[];this.remembered.clear();this.identity=op;}this.previous=now;
    const enemies=new Set(state.squads.filter(s=>s.faction==='enemy').map(s=>s.id)),seen=playerVisibleEnemies(state);
    const friendly=state.soldiers.filter(s=>!enemies.has(s.squadId)&&s.needs?.life==='active');
    const visible=(p:{x:number;z:number})=>friendly.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<80)||playerCanSeePoint(state,terrain,p);
    const remember=(impact:Impact)=>{if(this.remembered.has(impact.key))return;this.remembered.add(impact.key);if(this.impacts.length>=160){const old=this.impacts.shift()!;this.remembered.delete(old.key);}this.impacts.push(impact);};
    for(const b of op?.blastEvents??[])if(now-b.at<1&&visible(b))remember({key:`b${b.id}`,id:b.id,at:b.at,x:b.x,y:terrain.heightAt(b.x,b.z)+.15,z:b.z,blast:true,stone:false,heavy:b.radius>25});
    for(const s of op?.shotEvents??[])if(s.obstruction&&now-s.at<.25&&visible(s.to)&&(!enemies.has(s.squadId)||seen.has(s.shooterId)||friendly.some(f=>Math.hypot(f.x-s.to.x,f.z-s.to.z)<50)))remember({key:`s${s.id}`,id:s.id,at:s.at,...s.to,blast:false,stone:s.obstruction==='building'});
    this.impacts=this.impacts.filter(i=>{if(now-i.at<(i.blast?7:1.1))return true;this.remembered.delete(i.key);return false;});pool.begin();
    // Only simulation smoke fields get a sustained smoke column. Dust below never
    // modifies concealment, collision or the serialized battlefield.
    for(const c of op?.smokeFields??[]){
      if(!visible(c))continue;const life=Math.min(1,(now-c.born+1)/4,(c.until-now)/10);if(life<=0)continue;
      const floor=terrain.heightAt(c.x,c.z),age=now-c.born;
      for(let n=0;n<14;n++){const a=n*2.399,r=c.radius*.50*Math.sqrt((n+.5)/14)*life,drift=Math.sin(age*.12+n)*.2*life;
        pool.add(c.x+Math.cos(a)*r+drift,floor+1.7+n%4*1.1*life,c.z+Math.sin(a)*r,c.radius*.90*life,(4.5+n%3)*life,0xb7b7a9,.7*life);}
    }
    for(const i of this.impacts){const age=Math.max(0,now-i.at);if(!visible(i))continue;
      if(i.blast){
        const scale=i.heavy?2.5:1;
        // Very brief flash, then dirty thrown earth, never a persistent fireball.
        if(age<.10)pool.add(i.x,i.y+.5,i.z,2.5*scale,2*scale,0xe5bd77,(1-age/.1)*.9,true);
        for(let n=0;n<20;n++){const h=hash2D(n,i.id,29),a=n*2.399+i.id,r=(.8+age*1.35)*(h+.2),fade=Math.max(0,1-age/7);
          pool.add(i.x+Math.cos(a)*r*scale,i.y+.35+Math.min(2.8,age*1.3)*(1+h)*scale,i.z+Math.sin(a)*r*scale,(1.2+age*.85)*(1+h)*scale,(1.2+age*.7)*scale,n%3?0x928678:0x6b6258,fade*.50);
          if(age<1.2){const t=age*2.3,flight=Math.max(0,t*(2.5+h*3)-4.9*t*t);pool.add(i.x+Math.cos(a)*t*3,i.y+flight+.15,i.z+Math.sin(a)*t*3,.10+h*.15,.16+h*.2,0x51473b,1-age/1.2);}
        }
      }else{
        const fade=Math.max(0,1-age/1.1);for(let n=0;n<3;n++)pool.add(i.x+Math.sin(n*2.4+i.id)*age*.30,i.y+.05+age*.35,i.z+Math.cos(n*2.4+i.id)*age*.30,.18+age*.7,.2+age*.65,i.stone?0xb7b3a4:0x8d7c63,fade*.7);
      }
    }pool.end();
  }
}
