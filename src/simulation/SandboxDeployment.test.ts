import {describe,it,expect,vi} from 'vitest';
import {createPlayableSandbox} from './createBattlefield';
import {BattlefieldSimulation} from './BattlefieldSimulation';
import {deploySandbox,deploymentPreview} from './SandboxDeployment';
import {createOperation} from '../operations/createOperation';
import {balance} from '../garrison/Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
function fixture(){const sim=new BattlefieldSimulation(createPlayableSandbox());vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(sim.terrain,'obstacleAt').mockReturnValue(false);vi.spyOn(sim.terrain,'deformationAt').mockReturnValue(0);return sim;}
describe('normal sandbox troop deployment',()=>{
  it('adds multiple controllable teams with unique people, needs and conserved kit',()=>{
    const sim=fixture(),state=sim.state,before=state.soldiers.length;
    const result=deploySandbox(state,sim.terrain,'rifle',3,{x:0,z:0});expect(result.ids).toHaveLength(3);expect(state.soldiers.length).toBe(before+24);
    const people=state.soldiers.filter(s=>result.ids.includes(s.squadId));expect(people.every(s=>s.needs?.life==='active'&&s.carried?.ammo===60)).toBe(true);
    expect(new Set(state.soldiers.map(s=>s.id)).size).toBe(state.soldiers.length);expect(Math.max(...Object.values(balance(state)).map(Math.abs))).toBeLessThan(1e-8);
    expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
    sim.issueMove(result.ids,{x:0,z:30});expect(state.squads.filter(q=>result.ids.includes(q.id)).every(q=>q.order.type==='move')).toBe(true);
  });
  it('rejects overlaps and invalid terrain atomically',()=>{
    const sim=fixture();deploySandbox(sim.state,sim.terrain,'engineer',1,{x:0,z:0});const before=JSON.stringify(sim.state);
    expect(deploySandbox(sim.state,sim.terrain,'rifle',3,{x:0,z:0}).ids).toHaveLength(0);expect(JSON.stringify(sim.state)).toBe(before);
    vi.mocked(sim.terrain.groundTypeAt).mockReturnValue('river');expect(deploymentPreview(sim.state,sim.terrain,'rifle',1,{x:100,z:0}).valid).toBe(false);
    expect(deploymentPreview(sim.state,sim.terrain,'rifle',1,{x:NaN,z:0}).valid).toBe(false);
    expect(deploymentPreview(sim.state,sim.terrain,'rifle',1,{x:1999,z:0}).valid).toBe(false);
  });
  it('never adds people or equipment to finite operations or campaigns',()=>{
    for(const mode of ['advance','campaign'] as const){const state=createOperation(mode),sim=new BattlefieldSimulation(state),before=JSON.stringify(state);
      expect(deploySandbox(state,sim.terrain,'rifle',5,{x:0,z:0}).ids).toHaveLength(0);expect(JSON.stringify(state)).toBe(before);}
  });
  it('respects the displayed personnel ceiling without partially placing a batch',()=>{
    const sim=fixture();for(let i=0;i<6;i++)expect(deploySandbox(sim.state,sim.terrain,'rifle',5,{x:0,z:i*30}).ids).toHaveLength(5);
    const before=JSON.stringify(sim.state);expect(deploySandbox(sim.state,sim.terrain,'rifle',5,{x:0,z:500}).reason).toContain('300');expect(JSON.stringify(sim.state)).toBe(before);
  });
});
