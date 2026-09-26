import {it,expect,vi} from 'vitest';
import {createOperation} from './createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {seesObject} from './ObjectSight';
import {canSpot} from './Visibility';
function fixture(){
  const state=createOperation('advance'),sim=new BattlefieldSimulation(state),p=state.soldiers[0];
  Object.assign(p,{x:0,z:0,heading:0,action:'watching',suppression:80});p.needs!.energy=10;state.living!.campaignHours=0;
  sim.terrain.buildings=[];vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(sim.terrain.objects,'trees').mockReturnValue([]);vi.spyOn(sim.terrain,'supportProtection').mockReturnValue([]);
  return {state,sim,p};
}
it('recognizes nearby exposed guns, trucks and works without creating soldier intelligence',()=>{
  const {state,sim,p}=fixture(),before=structuredClone(state.operation!.intelligence);
  for(const kind of ['field-gun','truck','position'] as const)expect(seesObject(state,sim.terrain,p,{x:0,z:-10},kind)).toBe(true);
  expect(state.operation!.intelligence).toEqual(before);p.action='sleeping';expect(seesObject(state,sim.terrain,p,{x:0,z:10},'field-gun')).toBe(false);
});
it('uses the exposed silhouette when a low bank conceals the center, but not through a solid wall or smoke',()=>{
  const {state,sim,p}=fixture(),target={x:0,z:10};state.living!.campaignHours=12;p.suppression=0;p.needs!.energy=100;
  vi.mocked(sim.terrain.heightAt).mockImplementation((_x,z)=>z>4&&z<7?1.7:0);
  expect(seesObject(state,sim.terrain,p,target,'truck')).toBe(true);
  // Offset from the open central doorway: this ray meets intact masonry.
  sim.terrain.buildings=[{x:3,z:5,width:20,depth:2,height:6,angle:0}];sim.terrain.revision++;
  expect(seesObject(state,sim.terrain,p,target,'truck')).toBe(false);
  sim.terrain.buildings=[];sim.terrain.revision++;state.operation!.smokeFields=[{id:999,x:0,z:5,radius:14,born:0,until:100}];state.elapsed=5;
  expect(seesObject(state,sim.terrain,p,target,'field-gun')).toBe(false);
});
it('does not equate distant people with large objects or bypass actual terrain',()=>{
  const {state,sim,p}=fixture();state.living!.campaignHours=12;p.suppression=0;p.needs!.energy=100;
  const target={...state.soldiers[1],x:0,z:500,action:'holding',posture:'prone' as const};
  expect(canSpot(state,sim.terrain,p,target)).toBe(false);expect(seesObject(state,sim.terrain,p,target,'truck')).toBe(true);
  target.z=10;target.posture='prone';expect(canSpot(state,sim.terrain,p,target)).toBe(true);
  vi.mocked(sim.terrain.heightAt).mockImplementation((_x,z)=>z>3&&z<7?8:0);sim.terrain.revision++;
  expect(seesObject(state,sim.terrain,p,target,'truck')).toBe(false);expect(canSpot(state,sim.terrain,p,target)).toBe(false);
});
