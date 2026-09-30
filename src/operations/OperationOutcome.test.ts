import {describe,it,expect} from 'vitest';
import {createOperation} from './createOperation';
import {stepOperationalRuntime} from './OperationalRuntime';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {SaveSystem} from '../persistence/SaveSystem';
import {missionRules,outcomeText} from './MissionReadout';
import {personnelReadout} from './OperationOutcome';
import {placeMissionOperation} from './MissionContent';

describe('explainable operation outcomes',()=>{
  it('announces both open-front objectives before play and freezes the exact losing event',()=>{
    const s=createOperation('open-front',1944),r=s.operation!.runtime!,terrain=new TerrainSystem(s);
    const before=JSON.stringify(s),rules=missionRules(r);
    expect(rules.find(row=>row.side==='enemy')!.condition).toContain('120 continuous seconds');
    expect(rules.find(row=>row.side==='enemy')!.condition).toContain('Opposing forces must keep');
    expect(rules.find(row=>row.side==='enemy')!.condition).toContain('your rear boundary');
    expect(rules.find(row=>row.side==='enemy')!.location).toBe('Rear access boundary');
    expect(JSON.stringify(s)).toBe(before);
    const destination=r.routes.find(route=>route.side==='enemy')!.destination;
    const attackerIds=new Set(s.squads.filter(q=>q.faction==='enemy').slice(0,2).map(q=>q.id));
    for(const p of s.soldiers){Object.assign(p,attackerIds.has(p.squadId)?destination:r.front.origin);}
    for(let i=1;i<=119;i++){s.elapsed=s.operation!.elapsed=i;stepOperationalRuntime(s,terrain);}
    expect(s.operation!.status).toBe('active');
    expect(missionRules(r).find(row=>row.side==='enemy')!.warning).toBe(true);
    const loaded=new SaveSystem().parse(JSON.stringify(s));
    for(const state of [s,loaded]){state.elapsed=state.operation!.elapsed=120;stepOperationalRuntime(state,new TerrainSystem(state));}
    expect(loaded.operation!.outcome).toEqual(s.operation!.outcome);
    const record=structuredClone(s.operation!.outcome!);
    expect(record).toMatchObject({status:'defeat',side:'enemy',at:120,event:'objectives-secured'});
    expect(record.objectives[0]).toMatchObject({id:'enemy-intent',heldFor:120,requiredSeconds:120});
    expect(record.objectives[0].locations[0].name).toBe('Rear access boundary');
    expect(outcomeText(s).detail).not.toContain('operational objective.');
    expect(outcomeText(s).time).toContain('2:00');
    r.progress[1].heldFor=0;r.zones.find(z=>z.id==='fallback')!.name='Later name';
    stepOperationalRuntime(s,terrain);expect(s.operation!.outcome).toEqual(record);
    expect(new SaveSystem().parse(JSON.stringify(loaded)).operation!.outcome).toEqual(record);
  });
  it('rejects corrupted decisive evidence but retains old unrecorded results without inventing an event',()=>{
    const s=createOperation('open-front');s.operation!.status='defeat';s.operation!.reason='Legacy result';
    expect(new SaveSystem().parse(JSON.stringify(s)).operation!.outcome).toBeUndefined();
    expect(outcomeText(s).time).toContain('no decisive-event');
    s.operation!.outcome={version:1,status:'defeat',side:'enemy',at:999,simulationTime:999,event:'force-exhausted',objectives:[],explanation:'Bad'};
    expect(()=>new SaveSystem().parse(JSON.stringify(s))).toThrow();
  });
  it('uses actual mission-version conditions and explicit defeat timers in every briefing',()=>{
    for(const version of [1,2,3] as const)for(const kind of ['breakthrough','meeting','line-defense'] as const){
      const r=placeMissionOperation(kind,1944,undefined,version),rows=missionRules(r);
      expect(rows[0].condition).toContain(`${version===3?30:12} continuous seconds`);
      expect(rows[1].condition).toContain('30 seconds');
      if(kind==='breakthrough')expect(rows[1].condition).toContain('after you have first occupied');
      if(version===3)expect(rows[0].condition).not.toContain('arrived truck delivery');
      else expect(rows[0].condition).toContain('arrived truck delivery');
    }
  });
  it('reports current strength separately from initial strength and recorded arrivals',()=>{
    const s=createOperation('open-front'),q=s.squads.find(q=>q.faction!=='enemy')!,p=structuredClone(s.soldiers[0]);
    p.id=s.nextEntityId++;p.squadId=q.id;s.soldiers.push(p);q.soldierIds.push(p.id);
    const stats=personnelReadout(s);expect(stats.able).toBe(stats.initial+1);expect(stats.present).toBe(stats.able);
    expect(stats.replacements).toBe(0); // Not guessed from an impossible denominator.
    s.operation!.campaign!.replacements!.manifests.push({id:s.nextEntityId++,personId:p.id,squadId:q.id,side:'player',returning:false,stage:'arrived',releasedAt:8,arrivedAt:8,stock:{...p.carried!}});
    expect(personnelReadout(s).replacements).toBe(1);
  });
});
