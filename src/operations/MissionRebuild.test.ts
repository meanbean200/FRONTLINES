import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from './createOperationalBattle';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {stepPhysicalMission} from './MissionRuntime';
import {firingPoints} from '../terrain/BuildingGeometry';
import {observeEnemy} from './EnemyCommander';
import {commandOperationalEnemy} from './OperationalCommander';
describe('version-three mission rules, not subjective play acceptance',()=>{
  it('keeps every legacy version loadable while generating three different new physical problems',()=>{
    for(const kind of ['breakthrough','line-defense','meeting'] as const)for(const seed of [1944,1945,1946]){
      const s=createOperationalBattle(kind,seed,undefined,true),p=s.operation!.runtime!.missionPlan!;
      expect(p.version).toBe(3);expect(new SaveSystem().parse(JSON.stringify(s))).toEqual(s);
      if(kind==='meeting'){expect(p.secondHouseId).toBeDefined();expect(p.prepared).toHaveLength(0);}
      if(kind==='line-defense')expect(p.preparationSeconds).toBe(180);
      if(kind==='breakthrough')expect(p.prepared.some(p=>p.side==='enemy')).toBe(true);
      for(const version of [1,2] as const){const old=createOperationalBattle(kind,seed,undefined,true,version);expect(new SaveSystem().parse(JSON.stringify(old))).toEqual(old);}
    }
  });
  it('a meeting engagement can be won by two physically occupied road houses, without compulsory trenches or delivery',()=>{
    const sim=new BattlefieldSimulation(createOperationalBattle('meeting',1944,undefined,true)),s=sim.state,p=s.operation!.runtime!.missionPlan!,own=s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player');
    for(const [index,id] of [p.houseId,p.secondHouseId!].entries())for(const [i,person] of own.slice(index*2,index*2+2).entries()){
      const target=firingPoints(sim.terrain.buildings[id])[i];Object.assign(person,target);person.building={id,floor:0,vertical:0,route:[],index:0,stage:'station',target,targetFloor:0,stairTime:0};
    }
    for(const enemy of s.soldiers.filter(p=>!own.includes(p))){enemy.x=-1900;enemy.z=-1900;}
    for(let i=0;i<32;i++){s.elapsed++;s.operation!.elapsed++;stepPhysicalMission(s,sim.terrain);}
    expect(s.operation!.status).toBe('victory');expect(s.trenches).toHaveLength(0);expect(s.operation!.runtime!.mission!.checks?.supply).toBe(false);
  });
  it('uses two forward reconnaissance formations and never reads hidden friendly changes',()=>{
    const sim=new BattlefieldSimulation(createOperationalBattle('line-defense',1944,undefined,true)),s=sim.state,o=observeEnemy(s);o.at=185;
    const a=commandOperationalEnemy(o,sim.terrain);expect(a.commander.reason).toContain('Two formations');
    expect(a.memory.plans.filter(p=>p.role==='advance').length).toBeGreaterThanOrEqual(2);
    for(const p of s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player')){p.x+=400;p.health=0;}
    const changed=observeEnemy(s);changed.at=185;expect(changed).toEqual(o);expect(commandOperationalEnemy(changed,sim.terrain)).toEqual(a);
  });
});
