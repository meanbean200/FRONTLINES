import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance} from '../garrison/Inventory';
import {chooseEngineer,fitEngineers,facilitySiteReason,MIN_TRENCH_LENGTH,SUPPORT_WORKS,constructionStatus,selectedConstructionNetwork} from './ConstructionReadout';
import {trenchDraft} from '../ui/TrenchDraft';

describe('construction controls match actual work rules',()=>{
  it('reports approach, digging and pause from actual work state',()=>{
    const sim=createStudyScenario(),q=fitEngineers(sim.state)[0];q.order={type:'construct-trench',trenchId:sim.state.trenches[0].id,issuedAt:0};q.movementState='moving';
    const people=sim.state.soldiers.filter(s=>s.squadId===q.id);people.forEach(s=>s.action='walking');
    expect(constructionStatus(sim.state,q)).toContain('Approaching');people[0].action='digging';expect(constructionStatus(sim.state,q)).toContain('1 digging');
    sim.state.simSpeed=0;expect(constructionStatus(sim.state,q)).toContain('Paused');
  });
  it('opens the selected formation network, not an unrelated first network',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],q=fitEngineers(sim.state)[0];
    const other={...g,id:99999,squadIds:[q.id],entrance:{x:q.x,z:q.z}};g.squadIds=g.squadIds.filter(id=>id!==q.id);sim.state.living!.garrisons.push(other);
    expect(selectedConstructionNetwork(sim.state,new Set([q.id]),g.id)).toBe(other.id);
    expect(selectedConstructionNetwork(sim.state,new Set(),g.id)).toBe(g.id);
  });
  it('never auto-selects an enemy or incapacitated construction crew',()=>{
    const state=createOperation('campaign'),enemy=state.squads.find(q=>q.kind==='engineer'&&q.faction==='enemy')!;
    expect(chooseEngineer(state,new Set([enemy.id]))?.faction).not.toBe('enemy');
    for(const s of state.soldiers)if(state.squads.some(q=>q.id===s.squadId&&q.kind==='engineer'&&q.faction!=='enemy'))s.needs!.life='incapacitated';
    expect(fitEngineers(state)).toHaveLength(0);expect(chooseEngineer(state,new Set())).toBeUndefined();
  });
  it('accepts 10–20 m works instead of silently swallowing them in the input layer',()=>{
    const sim=createStudyScenario(),a={x:-1750,z:-1160};
    for(const length of [MIN_TRENCH_LENGTH,15,20]){
      const points=[a,{x:a.x+length,z:a.z}];
      expect(trenchDraft(points,sim.terrain).tooShort).toBe(false);
      expect(sim.createTrench(points)).toBeDefined();
    }
    expect(trenchDraft([a,{x:a.x+9,z:a.z}],sim.terrain).tooShort).toBe(true);
  });
  it('gives distinct clearance, distance and facing reasons without mutating the world',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],from=sim.garrisons.network.samples(sim.garrisons.network.component(g.trenchId)!,10)[3];
    const reason=(to:{x:number;z:number})=>facilitySiteReason(sim.state,g,from,to,sim.terrain,sim.navigation,sim.garrisons.network),before=JSON.stringify(sim.state);
    expect(reason({x:from.x,z:from.z-2})).toContain('Too close');
    expect(reason({x:from.x,z:from.z-45})).toContain('Too far');
    expect(reason({x:from.x,z:from.z+12})).toContain('rear side');
    expect(reason({x:from.x,z:from.z-12})).toBeUndefined();
    expect(reason({x:1998,z:0})).toContain('battlefield');
    expect(reason({x:-2001,z:0})).toContain('battlefield');
    expect(JSON.stringify(sim.state)).toBe(before);
  });
  it('accepts a work order without whole-squad reassignment and preserves existing excavation',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],q=fitEngineers(sim.state)[0],from=sim.garrisons.network.samples(sim.garrisons.network.component(g.trenchId)!,10)[3],position={x:from.x,z:from.z-12};
    const trench=sim.createTrench([{x:from.x,z:from.z+45},{x:from.x+15,z:from.z+45}],q.id)!;
    expect(sim.state.trenches.some(t=>t.id===trench)).toBe(true);
    const id=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'meal',origin:from,position});
    expect(q.order.type).toBe('construct-trench');
    expect(id).toBeDefined();expect(sim.state.trenches.some(t=>t.id===trench)).toBe(true);
    expect(sim.state.living!.facilities.find(f=>f.id===id)?.materialCost).toBe(SUPPORT_WORKS.meal.cost);
  });
  it('delivers materials, excavates and finishes support work across save/load',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];g.nextSupport=1e9;
    const from=sim.garrisons.network.samples(sim.garrisons.network.component(g.trenchId)!,10)[3],position={x:from.x,z:from.z-12};
    const id=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'meal',origin:from,position})!;
    expect(id).toBeDefined();expect(sim.state.living!.facilities.find(f=>f.id===id)?.paid).toBe(false);
    for(let i=0;i<2000;i++)sim.stepFixed();
    const resumed=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    for(let i=0;i<10000;i++){sim.stepFixed();resumed.stepFixed();}
    expect(sim.state.living!.facilities.find(f=>f.id===id)?.progress).toBe(1);
    expect(resumed.state).toEqual(sim.state);
    expect(Math.max(...Object.values(balance(sim.state)).map(Math.abs))).toBeLessThan(1e-6);
  },20000);
});
