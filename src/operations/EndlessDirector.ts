import {distance,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {commandEnemy,type EnemyMemory,type EnemyObservation} from './EnemyCommander';
import type {EndlessDirector,EnemyPressure} from './EndlessTypes';

const TEMPO={low:{review:150,commit:.45,risk:.85},standard:{review:100,commit:.65,risk:.72},high:{review:70,commit:.8,risk:.62}};
/** Only own-force summaries, known terrain, observations and delivered contacts
 * enter. Pressure changes commitments, never weapon stats. */
export function commandEndless(o:EnemyObservation,terrain:TerrainSystem,old:EndlessDirector,pressure:EnemyPressure,previous?:EnemyMemory){
  const director=structuredClone(old),tempo=TEMPO[pressure],rear=o.operational!.rear;
  const combat=o.squads.filter(q=>!q.working&&!q.emplaced);
  const ready=combat.filter(q=>q.able>=3&&q.ammo>=12&&q.energy>=30&&q.morale>=35&&q.suppression<65);
  const able=combat.reduce((n,q)=>n+q.able,0);
  for(const site of o.objectives){
    if(site.owner==='neutral')continue;
    const known=director.knownSites.find(k=>k.id===site.id);
    if(known){known.owner=site.owner;known.at=o.at;}
  }
  director.failedTargets=director.failedTargets.filter(f=>f.until>o.at);
  const target=o.objectives.find(s=>s.id===director.targetId);
  const failed=director.phase==='commit'&&(able<director.startingAble*tempo.risk||ready.length<2);
  const secured=target?.owner==='enemy'&&!target.contested&&combat.some(q=>distance(q,target)<100);
  if(failed){
    director.failedTargets=director.failedTargets.filter(f=>f.id!==director.targetId);
    director.failedTargets.push({id:director.targetId,until:o.at+300});
    director.phase='regroup';director.since=o.at;director.reviewAt=o.at+120;director.reason='Attack losses: disengage, recover and reconsider the approach';
  }else if(o.at>=director.reviewAt||secured&&director.phase==='commit'){
    director.reviewAt=o.at+tempo.review;director.since=o.at;
    if(!ready.length){director.phase='regroup';director.reason='Conserve the force: no supplied, fit maneuver group';}
    else {
      const threatened=o.objectives.find(s=>s.contested&&director.knownSites.find(k=>k.id===s.id)?.owner==='enemy');
      const choices=o.objectives.filter(s=>s.id!=='enemy-rear'&&!director.failedTargets.some(f=>f.id===s.id));
      choices.sort((a,b)=>{
        const cost=(s:typeof a)=>Math.min(...ready.map(q=>distance(q,s)))+(director.knownSites.find(k=>k.id===s.id)?.owner==='enemy'?800:0);
        return cost(a)-cost(b)||a.id.localeCompare(b.id);
      });
      const next=threatened??choices[0]??o.objectives[0];director.targetId=next.id;
      if(ready.length===1){director.phase='probe';director.reason='Reconnoitre cautiously while the main body works or recovers; no unsupported assault';}
      else if(threatened||secured){director.phase='hold';director.reason='Consolidate and cover the controlled approach';}
      else if(old.phase==='probe'&&old.targetId===next.id||old.phase==='hold'){director.phase='commit';director.startingAble=able;director.attempts++;director.reason='Commit supplied maneuver groups; hold a reserve';}
      else {director.phase='probe';director.startingAble=able;director.reason='Reconnoitre another approach before committing the main body';}
    }
  }
  const selected=o.objectives.find(s=>s.id===director.targetId)??o.objectives[0];
  const committed=Math.max(1,Math.floor(ready.length*tempo.commit));
  const assignments=combat.map(q=>{
    const index=ready.findIndex(p=>p.id===q.id),reserve=index<0||index>=committed;
    let goal:Vec2=selected,defend=director.phase==='hold';
    if(director.phase==='regroup'){goal=rear;defend=true;}
    else if(reserve||director.phase==='probe'&&index>0){goal={x:q.x,z:q.z};defend=true;}
    return {squadId:q.id,objectiveId:selected.id,goal,defend};
  });
  const result=commandEnemy({...o,assignments},terrain,previous);
  const report=o.contacts.filter(c=>c.active&&o.at-c.lastSeen<=12).sort((a,b)=>b.lastSeen-a.lastSeen||a.soldierId-b.soldierId)[0];
  let support:{squadId:number;target:Vec2}|undefined;
  const gun=o.squads.find(q=>q.mortarReady&&(q.mortarAmmo??0)>0&&!q.supportBusy&&q.suppression<65&&q.able>=2&&report&&distance(q,report)>=50&&distance(q,report)<=900);
  if(director.phase!=='regroup'&&gun&&report&&o.at>=director.nextSupport){support={squadId:gun.id,target:{x:report.x,z:report.z}};director.nextSupport=o.at+30;}
  return {...result,director,support};
}
