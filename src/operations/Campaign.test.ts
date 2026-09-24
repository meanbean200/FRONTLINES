import {describe,it,expect} from 'vitest';
import {createOperation} from './createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance} from '../garrison/Inventory';
const conserved=(sim:BattlefieldSimulation)=>{for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-7);};
describe('open-ended opposing trench campaign',()=>{
  it('starts both armies inside prepared connected trenches with separate depots',()=>{const sim=new BattlefieldSimulation(createOperation('campaign')),s=sim.state;expect(s.soldiers).toHaveLength(96);expect(s.living!.trucks).toHaveLength(8);expect(s.living!.garrisons.map(g=>g.squadIds.length)).toEqual([8,8]);expect(s.soldiers.every(p=>p.garrisonId!==undefined&&sim.terrain.coverAt(p.x,p.z)==='trench')).toBe(true);expect(new Set(s.soldiers.map(p=>`${p.x}:${p.z}`)).size).toBe(96);expect(()=>new SaveSystem().parse(JSON.stringify(s))).not.toThrow();conserved(sim);});
  it('continues beyond any short-operation deadline and only wins after holding both command posts',()=>{const sim=new BattlefieldSimulation(createOperation('campaign')),op=sim.state.operation!;op.nextOrders=1e9;op.nextCombat=1e9;op.elapsed=86400;sim.operations.step(1,()=>{});expect(op.status).toBe('active');for(const o of op.objectives){o.owner='player';o.control=1;}for(const p of sim.state.soldiers.filter(p=>sim.state.squads.find(q=>q.id===p.squadId)?.faction==='enemy')){p.x=3000;p.z=3000;}for(let i=0;i<119;i++)sim.operations.step(1,()=>{});expect(op.status).toBe('active');sim.operations.step(1,()=>{});expect(op.status).toBe('victory');});
  it('saves raids, construction, sight acquisition, needs and physical deliveries without changing continuation',()=>{
    const sim=new BattlefieldSimulation(createOperation('campaign'));sim.state.operation!.campaign!.nextRaid=6;
    for(let i=0;i<200;i++)sim.step(.05);
    const save=new SaveSystem(),restored=new BattlefieldSimulation(save.parse(JSON.stringify(sim.state)));
    expect(restored.state).toEqual(sim.state);
    for(let i=0;i<100;i++){sim.step(.05);restored.step(.05);}
    expect(restored.state).toEqual(sim.state);conserved(sim);
    expect(sim.state.operation!.campaign!.phase).toBe('raiding');expect(sim.state.living!.garrisons.find(g=>g.faction==='enemy')!.squadIds.length).toBeGreaterThanOrEqual(4);
  },30000);
  it('rejects hostile supply references and malformed campaign state while old operations still load',()=>{
    const s=createOperation('campaign'),save=new SaveSystem();s.operation!.campaign!.raidSquads=[s.squads[0].id];expect(()=>save.parse(JSON.stringify(s))).toThrow();expect(()=>save.parse(JSON.stringify(createOperation('advance')))).not.toThrow();
  });
});
