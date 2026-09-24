import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {requestSupport,stepSupport,smokeTransmission,selectedSupportTeam,supportReadiness,supportMissionText} from './SupportWeapons';
import {balance} from '../garrison/Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
function setup(){const state=createOperation('advance'),sim=new BattlefieldSimulation(state),q=state.squads[0];state.operation!.supportRules=true;state.operation!.casualtyRules=true;q.x=0;q.z=0;for(const s of state.soldiers){s.x=2000;s.z=2000;}const crew=state.soldiers.filter(s=>s.squadId===q.id);crew.forEach((s,i)=>{s.x=0;s.z=i;});crew[0].equipment!.mortar=true;crew[0].carried!.mortarHE=4;state.living!.ledger.initial.mortarHE+=4;vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain.objects,'trace').mockReturnValue({clear:true,transmission:1});return{state,sim,q,crew};}
describe('physical support missions',()=>{
  it('rejects an already moving mortar before creating a mission or spending inventory',()=>{
    const {state,q,crew}=setup();q.order={type:'move',issuedAt:0,target:{x:20,z:0}};
    const before=JSON.stringify(state);expect(requestSupport(state,'mortarHE',q.id,{x:100,z:0}).reason).toContain('Hold [H]');
    expect(state.operation!.supportRequests!.at(-1)).toMatchObject({accepted:false,source:'PLAYER'});
    const withoutAudit=structuredClone(state);delete withoutAudit.operation!.supportRequests;
    expect(JSON.stringify(withoutAudit)).toBe(before);expect(crew[0].carried!.mortarHE).toBe(4);
  });
  it('reports separated or pinned crews before acceptance and leaves standing orders intact',()=>{
    const {state,q,crew}=setup();crew.forEach((p,i)=>{if(i)p.x=100;});
    expect(supportReadiness(state,'mortarHE',q.id).reason).toContain('2 ready crew');
    crew.forEach(p=>{p.x=0;p.suppression=90;});
    expect(requestSupport(state,'mortarHE',q.id,{x:100,z:0}).accepted).toBe(false);expect(q.order.type).toBe('hold');
    expect(state.operation!.supportMissions).toBeUndefined();
  });
  it('uses a mortar in a mixed selection instead of the first rifle squad',()=>{
    const {state,q}=setup(),rifle=state.squads[1];
    expect(selectedSupportTeam(state,new Set([rifle.id,q.id]),'mortarHE')).toBe(q.id);
    expect(selectedSupportTeam(state,new Set([rifle.id]),'mortarHE')).toBeUndefined();
  });
  it('validates roofs at the player command boundary when terrain is supplied',()=>{
    const {state,sim,q}=setup();vi.spyOn(sim.terrain,'buildingAt').mockReturnValue(0);
    expect(requestSupport(state,'mortarHE',q.id,{x:100,z:0},false,sim.terrain).reason).toContain('roofs');
    expect(state.operation!.supportMissions).toBeUndefined();
  });
  it('presents preparation and impact countdowns from actual mission clocks',()=>{
    const {state,q}=setup();requestSupport(state,'mortarHE',q.id,{x:130,z:0});const m=state.operation!.supportMissions![0];
    expect(supportMissionText(m,3)).toBe('Preparing · 12 s to fire');m.stage='flight';expect(supportMissionText(m,16)).toBe('Round in flight · 3 s to impact');
  });
  it('does not launch mortar shells through an intact roof or consume their ammunition',()=>{
    const {state,sim,q,crew}=setup();vi.spyOn(sim.terrain,'buildingAt').mockReturnValue(0);
    expect(requestSupport(state,'mortarHE',q.id,{x:100,z:0}).accepted).toBe(true);state.elapsed=15;stepSupport(state,sim.terrain);
    expect(state.operation!.supportMissions![0].stage).toBe('cancelled');expect(state.operation!.supportMissions![0].reason).toContain('roofs');expect(crew[0].carried!.mortarHE).toBe(4);
  });
  it('rechecks a moving grenade thrower and preserves their ammunition',()=>{
    const {state,sim,q,crew}=setup();expect(requestSupport(state,'smokeGrenades',q.id,{x:20,z:0}).accepted).toBe(true);const before=crew.reduce((n,s)=>n+s.carried!.smokeGrenades,0);for(const s of crew)s.x=-40;state.elapsed=2;stepSupport(state,sim.terrain);expect(state.operation!.supportMissions![0].stage).toBe('cancelled');expect(crew.reduce((n,s)=>n+s.carried!.smokeGrenades,0)).toBe(before);
  });
  it('resolves blast protection before changing the building preset',()=>{
    const {state,sim,q}=setup();requestSupport(state,'mortarHE',q.id,{x:100,z:0},true);const m=state.operation!.supportMissions![0];sim.terrain.buildings=[{...sim.terrain.buildings[0],...m.impact}];state.buildingChanges=[{id:0,condition:'damaged',damage:100}];const patient=state.soldiers.find(s=>s.squadId!==q.id)!;Object.assign(patient,m.impact);vi.mocked(sim.terrain.objects.trace).mockImplementation(()=>({clear:state.buildingChanges![0].condition==='ruined',transmission:0}));state.elapsed=30;stepSupport(state,sim.terrain);expect(patient.combat?.wound).toBeUndefined();expect(state.buildingChanges[0].condition).toBe('ruined');
  });
  it('consumes only on launch; preparation and shell flight save exactly',()=>{
    const {state,sim,q,crew}=setup();expect(requestSupport(state,'mortarHE',q.id,{x:100,z:0}).accepted).toBe(true);expect(crew[0].carried!.mortarHE).toBe(4);state.elapsed=15;stepSupport(state,sim.terrain);expect(crew[0].carried!.mortarHE).toBe(3);expect(state.operation!.supportMissions![0].stage).toBe('flight');expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);state.elapsed=30;stepSupport(state,sim.terrain);expect(state.operation!.supportMissions![0].stage).toBe('complete');for(const n of Object.values(balance(state)))expect(Math.abs(n)).toBeLessThan(1e-8);
  });
  it('warns of friendly danger and cancellation does not consume a shell',()=>{
    const {state,sim,q,crew}=setup();const friendly=state.soldiers.find(s=>s.squadId===state.squads[1].id)!;friendly.x=100;friendly.z=0;
    expect(requestSupport(state,'mortarHE',q.id,{x:100,z:0}).warning).toBe(true);expect(state.operation!.supportMissions).toBeUndefined();
    expect(requestSupport(state,'mortarHE',q.id,{x:100,z:0},true).accepted).toBe(true);q.order.type='move';stepSupport(state,sim.terrain);expect(state.operation!.supportMissions![0].stage).toBe('cancelled');expect(crew[0].carried!.mortarHE).toBe(4);
  });
  it('explosions can injure allies; intervening protection prevents wounds',()=>{
    const {state,sim,q}=setup();const target=state.soldiers.find(s=>s.squadId===state.squads[1].id)!;
    requestSupport(state,'mortarHE',q.id,{x:100,z:0},true);const mission=state.operation!.supportMissions![0];target.x=mission.impact.x;target.z=mission.impact.z;state.elapsed=15;stepSupport(state,sim.terrain);state.elapsed=30;stepSupport(state,sim.terrain);expect(target.combat!.wound).toBeDefined();
    const protectedCase=setup();requestSupport(protectedCase.state,'mortarHE',protectedCase.q.id,{x:100,z:0},true);const p=protectedCase.state.soldiers.find(s=>s.squadId!==protectedCase.q.id)!;Object.assign(p,protectedCase.state.operation!.supportMissions![0].impact);vi.mocked(protectedCase.sim.terrain.objects.trace).mockReturnValue({clear:false,transmission:0,blockedBy:'building'});protectedCase.state.elapsed=30;stepSupport(protectedCase.state,protectedCase.sim.terrain);expect(p.combat?.wound).toBeUndefined();
  });
  it('smoke obscures both directions, expires, and never changes bullet geometry',()=>{
    const {state}=setup();state.operation!.smokeFields=[{id:1,x:50,z:0,radius:15,born:0,until:60}];state.elapsed=5;expect(smokeTransmission(state,{x:0,z:0},{x:100,z:0})).toBeLessThan(.01);expect(smokeTransmission(state,{x:100,z:0},{x:0,z:0})).toBeLessThan(.01);state.elapsed=61;expect(smokeTransmission(state,{x:0,z:0},{x:100,z:0})).toBe(1);
  });
});
