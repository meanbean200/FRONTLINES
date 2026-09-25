import {describe,it,expect,vi} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {networkCapacity} from './NetworkCapacity';
import {initializeReplacements,requestReserveSquad} from '../operations/Replacements';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';

describe('network-wide reservations and truthful refusals',()=>{
  it('uses the actual usable floor width for people present, not a fixed three-metre radius',()=>{
    const sim=createStudyScenario(),s=sim.state,t=s.trenches[0];t.width=8;sim.garrisons.network.sync(s.trenches);
    for(const p of s.soldiers){p.x=t.points[0].x+40;p.z=t.points[0].z+3.3;}
    expect(networkCapacity(s,sim.garrisons.network,t.id).present).toBe(s.soldiers.length);
    s.soldiers[0].z=t.points[0].z+3.5;
    expect(networkCapacity(s,sim.garrisons.network,t.id).present).toBe(s.soldiers.length-1);
  });
  it('counts same-network selection once and has no 24-person cap',()=>{
    const sim=createStudyScenario(1944,0,48),s=sim.state,t=s.trenches[0],g=s.living!.garrisons[0];
    const before=networkCapacity(s,sim.garrisons.network,t.id,'player',s.squads.map(q=>q.id));
    expect(before.assigned).toBe(48);expect(before.capacity).toBeGreaterThan(48);expect(sim.garrisons.assign(s.squads.map(q=>q.id),t.id)).toBe(true);
    expect(g.squadIds.length).toBe(6);expect(sim.garrisons.lastAssignment.code).toBe('accepted');
  });
  it('distinguishes insufficient floor from a blocked route and makes no partial assignments',()=>{
    const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0],q=s.squads[0],t=s.trenches[0];
    sim.garrisons.release(q.id);const original=structuredClone(q.order);
    vi.spyOn(sim.garrisons.network,'capacity').mockReturnValue(16);
    expect(sim.garrisons.assign([q.id],t.id)).toBe(false);expect(sim.garrisons.lastAssignment.code).toBe('capacity');expect(q.order).toEqual(original);
    vi.restoreAllMocks();vi.spyOn(sim.navigation,'plan').mockReturnValue([]);vi.spyOn(sim.navigation,'segmentClear').mockReturnValue(false);
    for(const p of s.soldiers.filter(p=>p.squadId===q.id)){p.x-=100;p.z-=100;}
    expect(sim.garrisons.assign([q.id],t.id)).toBe(false);expect(sim.garrisons.lastAssignment.code).toBe('route');expect(q.order).toEqual(original);expect(g.squadIds).not.toContain(q.id);
  });
  it('reserves selected inbound replacements and combines merged area records for dispatch',()=>{
    const sim=new BattlefieldSimulation(createOperation('open-front',1944)),s=sim.state,w=s.living!;initializeReplacements(s);
    const g=w.garrisons.find(g=>g.faction!=='enemy')!,root=s.trenches.find(t=>t.id===g.trenchId)!;
    const other={...structuredClone(g),id:s.nextEntityId++,squadIds:[] as number[]};w.garrisons.push(other);
    const q=s.squads.find(q=>g.squadIds.includes(q.id))!;g.squadIds=g.squadIds.filter(id=>id!==q.id);other.squadIds=[q.id];s.soldiers.filter(p=>p.squadId===q.id).forEach(p=>p.garrisonId=other.id);
    const before=networkCapacity(s,sim.garrisons.network,root.id);expect(before.assigned).toBe(s.soldiers.filter(p=>p.garrisonId===g.id||p.garrisonId===other.id).length);
    const pool=s.operation!.campaign!.replacements!;pool.dispatchAt={player:0};pool.manifests.push({id:s.nextEntityId++,personId:s.nextEntityId++,squadId:q.id,side:'player',returning:false,stage:'edge',stock:{...s.soldiers[0].carried!},releasedAt:0});
    expect(networkCapacity(s,sim.garrisons.network,root.id,'player',[q.id]).inbound).toBe(1);
    // Exact reservation boundary, independent of stale per-area cached capacity.
    root.points=[root.points[0],{x:root.points[0].x+70,z:root.points[0].z}];sim.garrisons.network.sync(s.trenches);g.capacity=10000;
    const space=networkCapacity(s,sim.garrisons.network,root.id);if(space.free<8)expect(requestReserveSquad(s,g.id).accepted).toBe(false);
  });
});
