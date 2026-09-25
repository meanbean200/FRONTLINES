import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from './createOperationalBattle';
import {placeMissionOperation,type MissionKind} from './MissionContent';
import {defaultBattleSetup,resolveBattleSetup} from './BattleSetup';
import {SaveSystem} from '../persistence/SaveSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {stepPhysicalMission} from './MissionRuntime';
import {observeEnemy} from './EnemyCommander';
import {commandOperationalEnemy} from './OperationalCommander';
import {balance,transfer} from '../garrison/Inventory';
import {firingPoints} from '../terrain/BuildingGeometry';
import {atDepth,frontDepth} from './OperationGeometry';

const kinds:MissionKind[]=['breakthrough','line-defense','meeting'];
const setup=(kind:MissionKind,seed=1944)=>resolveBattleSetup({...defaultBattleSetup(),operation:kind,map:'seed',seed},seed);
function tick(sim:BattlefieldSimulation,n=1){for(let i=0;i<n;i++){sim.state.elapsed++;sim.state.operation!.elapsed++;stepPhysicalMission(sim.state,sim.terrain);}}

describe('physical mission content v1 (synthetic rule fixtures, not acceptance play)',()=>{
  it('keeps new rear depots on their own approach, while version-one saved geography remains loadable',()=>{
    for(const kind of kinds)for(const seed of [1944,1945,1946]){
      const options=setup(kind,seed),s=createOperationalBattle(kind,seed,options,true),r=s.operation!.runtime!;
      expect(r.missionPlan!.version).toBe(2);
      for(const source of r.reinforcements)expect(frontDepth(r.front,source.rear)*(source.side==='player'?-1:1)).toBeGreaterThan(250);
      const legacy=createOperationalBattle(kind,seed,options,true,1),old=legacy.operation!.runtime!;
      // No geometry rewrite, people movement, resources or roster migration.
      const before=JSON.stringify(legacy);expect(new SaveSystem().parse(before).operation!.runtime).toEqual(old);expect(JSON.stringify(legacy)).toBe(before);
    }
  });
  it.each(kinds)('%s builds real landmarks and preserves physical stock and saves',kind=>{
    for(const seed of [1944,1945,1946]){
      const s=createOperationalBattle(kind,seed,setup(kind,seed),true),sim=new BattlefieldSimulation(s),r=s.operation!.runtime!;
      expect(r.missionPlan).toEqual(placeMissionOperation(kind,seed,setup(kind,seed)).missionPlan);
      expect(sim.terrain.buildings[r.missionPlan!.houseId]).toMatchObject(r.missionPlan!.house);
      expect(s.operation!.duration).toBe(0);expect(r.objectives[0].spec.type).toBe('physical-mission');
      expect(Math.max(...Object.values(balance(s)).map(Math.abs))).toBeLessThan(1e-7);
      tick(sim,4);expect(()=>new SaveSystem().parse(JSON.stringify(s))).not.toThrow();
      expect(s.squads.filter(q=>q.faction==='player').every(q=>Math.hypot(q.x-r.front.origin.x,q.z-r.front.origin.z)<650)).toBe(true);
    }
  });
  it('preserves old mission geometry and rejects incompatible or forged new content',()=>{
    const old=createOperationalBattle('line-defense'),legacy=JSON.stringify(old.operation!.runtime);
    expect(JSON.stringify(new SaveSystem().parse(JSON.stringify(old)).operation!.runtime)).toBe(legacy);
    const fresh=createOperationalBattle('meeting',1944,setup('meeting'),true);
    fresh.operation!.runtime!.missionPlan!.houseId++;
    expect(()=>new SaveSystem().parse(JSON.stringify(fresh))).toThrow();
  });
  it('constructs every force size and cardinal approach without duplicate prepared works',()=>{
    for(const kind of kinds)for(const size of ['small','medium','large'] as const)for(const direction of ['north','east','south','west'] as const){
      const options=setup(kind);options.size=size;options.advanced.direction=direction;
      const s=createOperationalBattle(kind,1944,options,true),plan=s.operation!.runtime!.missionPlan!;
      expect(s.trenches.length,`${kind}/${size}/${direction}`).toBe(plan.prepared.length);
      expect(s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player')).toHaveLength(s.operation!.initialPlayer);
      expect(()=>new SaveSystem().parse(JSON.stringify(s))).not.toThrow();
    }
  });
  it('does not complete objectives from a global flag, invisible casualties or a delivery promise',()=>{
    const s=createOperationalBattle('meeting',1944,setup('meeting'),true),sim=new BattlefieldSimulation(s);
    for(const o of s.operation!.objectives){o.owner='player';o.control=1;}
    for(const p of s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='enemy')){p.health=0;p.needs!.life='dead';}
    tick(sim,100);expect(s.operation!.status).toBe('active');expect(s.operation!.runtime!.mission!.checks).toMatchObject({house:false,line:false,supply:false});
  });
  it('allows an attack against an already occupied farm; losing it after capture is different',()=>{
    const s=createOperationalBattle('breakthrough',1944,setup('breakthrough'),true),sim=new BattlefieldSimulation(s),r=s.operation!.runtime!,id=r.missionPlan!.houseId,b=sim.terrain.buildings[id];
    const own=s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player'),enemy=s.soldiers.filter(p=>!own.includes(p)),points=firingPoints(b);
    const occupy=(people:typeof own)=>people.slice(0,2).forEach((p,i)=>{Object.assign(p,points[i]);p.building={id,floor:0,vertical:0,route:[],index:0,stage:'station',target:points[i],targetFloor:0,stairTime:0};});
    occupy(enemy);tick(sim,60);expect(s.operation!.status).toBe('active');expect(r.mission!.breachedFor).toBe(0);
    enemy.forEach(p=>delete p.building);occupy(own);tick(sim);expect(r.mission!.houseTaken).toBe(true);
    own.forEach(p=>delete p.building);occupy(enemy);tick(sim,31);expect(s.operation!.status).toBe('defeat');
  });
  it('ends an impossible finite-force mission without counting serious casualties as field strength',()=>{
    for(const kind of kinds){
      const s=createOperationalBattle(kind,1944,setup(kind),true),sim=new BattlefieldSimulation(s);
      const own=s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player');
      // Exhaustion alone is recoverable and must not count as permanent loss.
      for(const p of own){p.needs!.life='incapacitated';p.needs!.energy=0;}
      tick(sim,60);expect(s.operation!.status).toBe('active');
      const minimum=kind==='line-defense'?2:5;
      own.forEach((p,i)=>{p.combat??={shotSequence:0};p.needs!.life=i<minimum?'active':'incapacitated';p.needs!.energy=40;if(i>=minimum)p.combat.wound={severity:'disabling',at:s.elapsed,stabilized:true,care:'stabilized'};});
      tick(sim);expect(s.operation!.status).toBe('active');
      own[minimum-1].needs!.life='incapacitated';own[minimum-1].combat!.wound={severity:'critical',at:s.elapsed,stabilized:true,care:'stabilized'};
      tick(sim);expect(s.operation!.status).toBe('defeat');expect(s.operation!.reason).toContain('Serious casualties');
    }
  });
  it('stages defense before committing scouts; knowledge excludes hidden progress and people',()=>{
    const s=createOperationalBattle('line-defense',1944,setup('line-defense'),true),sim=new BattlefieldSimulation(s),o=observeEnemy(s),a=commandOperationalEnemy(o,sim.terrain);
    expect(a.commands.every(c=>c.type==='hold'||Math.hypot(c.goal.x-o.squads.find(q=>q.id===c.squadId)!.x,c.goal.z-o.squads.find(q=>q.id===c.squadId)!.z)<25)).toBe(true);
    const copy=structuredClone(s);copy.operation!.runtime!.mission!.phase='secured';copy.operation!.runtime!.mission!.lineTaken=true;
    for(const p of copy.soldiers.filter(p=>copy.squads.find(q=>q.id===p.squadId)?.faction==='player')){p.x+=500;p.health=0;}
    expect(observeEnemy(copy)).toEqual(o);
    o.at=95;expect(commandOperationalEnemy(o,sim.terrain).commands.some(c=>c.type==='move')).toBe(true);
  });
  it.each(kinds)('%s requires an occupied building, a physical line/delivery and permits defeat',kind=>{
    const s=createOperationalBattle(kind,1944,setup(kind),true),sim=new BattlefieldSimulation(s),r=s.operation!.runtime!,m=r.mission!,plan=r.missionPlan!;
    const own=s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player'),hostile=s.soldiers.filter(p=>!own.includes(p));
    // Synthetic terminal-condition fixture: actual gameplay setup is verified separately.
    for(const p of hostile){p.health=0;p.needs!.life='dead';}
    const points=firingPoints(sim.terrain.buildings[plan.houseId]);
    for(const [i,p] of own.slice(0,2).entries()){Object.assign(p,points[i]);p.building={id:plan.houseId,floor:0,vertical:0,route:[],index:0,stage:'station',target:points[i],targetFloor:0,stairTime:0};}
    const line=sim.trenches.create([atDepth(r.front,-70,-20),atDepth(r.front,-70,20)]);line.progress=1;line.status='complete';sim.terrain.syncModifications();
    for(const p of own.slice(2,5))Object.assign(p,kind==='breakthrough'?plan.prepared[0].points[2]:line.points[0]);
    const g=sim.garrisons.ensureArea(line.id)!;g.lastDeliveryAt=1;
    for(const [key,n] of [['ammo',30],['food',10],['water',10]] as const)transfer(s.living!.rearStock,g.cache,key,n);
    m.contactAt=0;s.elapsed=s.operation!.elapsed=100;r.lastEvaluation=r.nextEvaluation=100;
    tick(sim,14);expect(s.operation!.status).toBe('victory');expect(s.simSpeed).toBe(0);
    expect(()=>new SaveSystem().parse(JSON.stringify(s))).not.toThrow();
    const lost=createOperationalBattle(kind,1944,setup(kind),true),loss=new BattlefieldSimulation(lost);
    for(const p of lost.soldiers.filter(p=>lost.squads.find(q=>q.id===p.squadId)?.faction==='player')){p.health=0;p.needs!.life='dead';}
    tick(loss);expect(lost.operation!.status).toBe('defeat');
  });
});
