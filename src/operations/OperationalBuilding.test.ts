import {it,expect,vi} from 'vitest';
import {createOperation} from './createOperation';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {commandOperationalEnemy} from './OperationalCommander';
import type {EnemyObservation,OwnSquad} from './EnemyCommander';

function fixture(){
  const terrain=new TerrainSystem(createOperation('advance'));
  const house=terrain.buildings.find(b=>b.width*b.depth>=125)!;
  // A held, sheltered patch requires no new tactical Move on its own. It must
  // still be considered when the commander reviews nearby useful buildings.
  vi.spyOn(terrain,'coverAt').mockReturnValue('low-ground');
  const person=(id:number,x:number):OwnSquad=>({id,x,z:house.z,able:8,initial:8,health:100,morale:100,energy:100,suppression:0,ammo:60,moving:false,planning:false});
  const observation:EnemyObservation={at:0,seed:1944,mode:'advance',squads:[person(1,house.x-600),person(2,house.x+25),person(3,house.x+600)],contacts:[],
    objectives:[{id:'home',x:house.x,z:house.z,radius:180,owner:'enemy',contested:false,ammo:0}],
    operational:{intent:'defend',front:{origin:{x:house.x,z:house.z},forward:{x:0,z:1},right:{x:1,z:0},beltDepth:0},rear:{x:house.x,z:house.z+300},deploymentDepth:0,targets:[{id:'home',point:{x:house.x,z:house.z}}]}};
  return {terrain,house,observation};
}

it('an idle defender can choose nearby physical shelter even without a pending tactical move',()=>{
  const {terrain,observation}=fixture(),before=JSON.stringify(observation);
  const result=commandOperationalEnemy(observation,terrain),command=result.commands.find(c=>c.squadId===2);
  expect(command?.type).toBe('move');
  const chosen=terrain.buildings.findIndex(b=>b.x===command?.goal.x&&b.z===command?.goal.z);
  expect(chosen).toBeGreaterThanOrEqual(0);
  expect(Math.hypot(command!.goal.x-observation.squads[1].x,command!.goal.z-observation.squads[1].z)).toBeLessThan(60);
  expect(result.memory.plans.find(p=>p.squadId===2)?.goal).toEqual(command?.goal);
  expect(JSON.stringify(observation)).toBe(before);
  observation.at=3;observation.squads[1].buildingOrder=chosen;
  expect(commandOperationalEnemy(observation,terrain,result.memory,result.commander).commands.some(c=>c.squadId===2)).toBe(false);
});

it.each(['working','emplaced','supportBusy'] as const)('building opportunities do not steal %s personnel',protectedRole=>{
  const {terrain,observation}=fixture();observation.squads[1][protectedRole]=true;
  expect(commandOperationalEnemy(observation,terrain).commands.some(c=>c.squadId===2)).toBe(false);
});

it('building adoption preserves an unexpired movement commitment',()=>{
  const {terrain,observation}=fixture(),first=commandOperationalEnemy(observation,terrain);
  observation.at=3;observation.squads[1].moving=true;observation.squads[1].orderTarget={x:observation.squads[1].x+15,z:observation.squads[1].z};
  expect(commandOperationalEnemy(observation,terrain,first.memory,first.commander).commands.some(c=>c.squadId===2)).toBe(false);
});
