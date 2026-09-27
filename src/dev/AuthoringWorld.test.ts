import {describe,it,expect} from 'vitest';
import {AuthoringWorld} from './AuthoringWorld';
import {blankScenario,type ScenarioEntity} from '../scenarios/ScenarioPreset';
import {scenarioDiagnostics,instantiateScenario} from '../scenarios/instantiateScenario';
import {WorldSession} from '../sessions/WorldSession';
import {ScenarioDocument} from './ScenarioDocument';
import {preflight} from './ScenarioPreflight';
import {intentKind} from '../scenarios/ScenarioIntent';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';

describe('lightweight authoring',()=>{
 it('reports incompatible connected fronts before Play without instantiating a world',()=>{const p=blankScenario();p.entities=[{id:'a',name:'A',type:'trench',side:'player',points:[{x:-1400,z:-1500},{x:-1370,z:-1500}],completed:true,width:4.2,depth:1.75,front:90,readiness:'alert'},{id:'b',name:'B',type:'trench',side:'player',points:[{x:-1370,z:-1500},{x:-1340,z:-1500}],completed:true,width:4.2,depth:1.75,front:-90,readiness:'stand-to'}];const before=scenarioDiagnostics.instantiations;expect(preflight(p).filter(i=>i.entityId==='b').map(i=>i.message)).toEqual(expect.arrayContaining(['B: Connected trenches need the same front direction.','B: Connected trenches need the same readiness.']));expect(scenarioDiagnostics.instantiations).toBe(before);});
 it('edits geometry without production worlds, sessions, or people; retains terrain and unaffected IDs',()=>{
  const world=new AuthoringWorld(),p=blankScenario(),before=structuredClone(WorldSession.ownership),count=scenarioDiagnostics.instantiations,terrain=world.terrain;
  p.entities=[{id:'a',name:'A',type:'trench',side:'player',points:[{x:-1400,z:-1500},{x:-1370,z:-1500}],width:4.2,depth:1.75,completed:true}];
  world.sync(p);const id=world.ids.get('a'),revision=terrain.revision;
  for(let n=0;n<100;n++){p.name='Edit '+n;world.sync(p);}
  expect(world.terrain).toBe(terrain);expect(terrain.revision).toBe(revision);expect(world.state.soldiers).toHaveLength(0);
  (p.entities[0] as Extract<ScenarioEntity,{type:'trench'}>).points[1].x+=10;world.sync(p);expect(world.ids.get('a')).toBe(id);expect(terrain.revision).toBeGreaterThan(revision);
  p.entities=[];world.sync(p);expect(world.state.trenches).toEqual([]);expect(world.network.nodes).toEqual([]);
  expect(WorldSession.ownership).toEqual(before);expect(scenarioDiagnostics.instantiations).toBe(count);
 });
 it('validates several geometry problems together without full instantiation or relocating anything',()=>{
  const p=blankScenario();p.entities=[{id:'t',name:'Unfinished',type:'trench',side:'player',points:[{x:-1400,z:-1500},{x:-1370,z:-1500}],width:4.2,depth:1.75,completed:false},{id:'p',name:'Off floor',type:'facility',kind:'rest',trenchId:'t',x:-1390,z:-1470,facing:0,stock:{ammo:0,food:0,water:0,materials:0,fuel:0,mortarHE:0,mortarSmoke:0,smokeGrenades:0,medical:0}}];
  const before=JSON.stringify(p),count=scenarioDiagnostics.instantiations,issues=preflight(p);
  expect(issues.filter(i=>i.entityId==='p').length).toBeGreaterThanOrEqual(2);expect(JSON.stringify(p)).toBe(before);expect(scenarioDiagnostics.instantiations).toBe(count);
 });
 it('commits a gesture once, with immutable undo/redo snapshots',()=>{
  const doc=new ScenarioDocument(),before=JSON.stringify(doc.preset);let preview=structuredClone(doc.preset);
  for(let n=0;n<100;n++)preview={...preview,name:'Gesture '+n};expect(doc.diagnostics.commits).toBe(0);expect(JSON.stringify(doc.preset)).toBe(before);
  doc.change(p=>{p.name=preview.name;});expect(doc.diagnostics.commits).toBe(1);doc.undo();expect(JSON.stringify(doc.preset)).toBe(before);doc.redo();expect(doc.preset.name).toBe('Gesture 99');
 });
});
describe('honest authored intentions',()=>{
 it.each([['attack','probe'],['defend','support'],['hold','reserve']] as const)('%s and legacy %s produce the same actual commander decisions',(current,legacy)=>{
  const run=(intent:typeof current|typeof legacy)=>{const p=blankScenario();p.entities=[{id:'q',name:'Author squad',type:'formation',side:'player',kind:'rifle',count:2,x:-1400,z:-1500,ammo:80,food:2,water:3,intent,targetId:'o'},{id:'o',name:'Goal',type:'objective',owner:'neutral',x:-1300,z:-1500,radius:20}];const state=instantiateScenario(p),sim=new BattlefieldSimulation(state);for(let n=0;n<30;n++)sim.stepFixed();return {order:state.squads[0].order,plans:state.operation!.authored!.memories.player?.plans??[]};};
  expect(intentKind(legacy)).toBe(current);const result=run(current);expect(run(legacy)).toEqual(result);
  if(current==='hold')expect(result.plans).toEqual([]);else expect(result.plans[0].role).toBe(current==='defend'?'defend':'advance');
 });
});
