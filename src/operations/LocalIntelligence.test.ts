import {describe,it,expect,vi} from 'vitest';
import {createOperation} from './createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {squadContacts,updateContacts} from './Visibility';
import {observeEnemy} from './EnemyCommander';
import {SaveSystem} from '../persistence/SaveSystem';
import {signalEngagement} from '../combat/Engagement';
describe('local intelligence and engagement boundaries',()=>{
  it('keeps distant squads ignorant until reports arrive and does not track unseen movement',()=>{
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.faction==='enemy')!,enemy=state.soldiers.filter(s=>s.squadId===q.id),target=state.soldiers[0];
    for(const s of state.soldiers){s.x=1800;s.z=1800;}
    enemy.forEach((s,i)=>{s.x=0;s.z=i*.3;s.heading=Math.PI/2;});target.x=70;target.z=0;
    vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'coverAt').mockReturnValue('open');vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');sim.terrain.buildings=[];vi.spyOn(sim.terrain.objects,'trees').mockReturnValue([]);
    state.living!.campaignHours=12;updateContacts(state,sim.terrain);
    expect(squadContacts(state,q.id).some(c=>c.soldierId===target.id)).toBe(true);expect(observeEnemy(state).contacts).toHaveLength(0);
    const other=state.squads.find(other=>other.faction==='enemy'&&other!==q)!;expect(squadContacts(state,other.id).some(c=>c.soldierId===target.id)).toBe(false);
    target.x=-2000;state.elapsed=4;updateContacts(state,sim.terrain);
    const report=observeEnemy(state).contacts.find(c=>c.soldierId===target.id)!;expect(report.x).toBe(70);expect(report.status).toBe('last-reported');
    const restored=new SaveSystem().parse(JSON.stringify(state));expect(restored.operation!.intelligence).toEqual(state.operation!.intelligence);
    const before=observeEnemy(state);target.x=-1900;target.health=0;expect(observeEnemy(state)).toEqual(before);
  });
  it('only reduces fast-forward once per engagement and preserves manual pause',()=>{
    const state=createOperation('advance');state.simSpeed=5;signalEngagement(state);expect(state.simSpeed).toBe(1);
    state.simSpeed=5;state.elapsed=10;signalEngagement(state);expect(state.simSpeed).toBe(5);
    state.elapsed=45;signalEngagement(state);expect(state.simSpeed).toBe(1);expect(state.operation!.engagement!.number).toBe(2);
    state.simSpeed=0;state.elapsed=90;signalEngagement(state);expect(state.simSpeed).toBe(0);
  });
});
