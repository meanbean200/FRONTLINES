import {describe,it,expect} from 'vitest';
import {defaultBattleSetup,resolveBattleSetup,validBattleSetup} from './BattleSetup';
import {createOperationalBattle} from './createOperationalBattle';
import {defaultEndlessOptions,type ReinforcementPolicy} from './EndlessTypes';
import {endEndlessBattle,stepEndlessController,endlessEvent} from './EndlessController';
import {loadEndlessManifest,stepEndlessAvailability,endlessDeficit} from './EndlessEconomy';
import {requestReserveSquad,stepReplacements} from './Replacements';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance,consume} from '../garrison/Inventory';
import {RESOURCES} from '../garrison/types';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {OperationSystem} from './OperationSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {recordDeath} from '../simulation/DeathRecord';
import {commandEndless} from './EndlessDirector';
import {observeEnemy} from './EnemyCommander';
import {SETTLEMENTS} from '../terrain/WorldFeatures';
import {calendarHoursPerSecond} from '../simulation/Calendar';
import {updateNeeds} from '../garrison/NeedsSystem';
import {renderedPersonnel,RECENT_FALLEN_LIMIT} from '../render/PersonnelVisibility';

const create=(policy:ReinforcementPolicy='finite',seed=1944)=>{
  const setup=resolveBattleSetup({...defaultBattleSetup(),operation:'open-front',map:'seed',seed,battleMode:'endless',endless:{...defaultEndlessOptions(),reinforcements:policy}},seed);
  return createOperationalBattle('open-front',seed,setup,true);
};
const isBattlefieldState=(s:unknown)=>{try{new SaveSystem().parse(JSON.stringify(s));return true;}catch{return false;}};
const kill=(s:ReturnType<typeof create>,n:number,side='player')=>{
  for(const p of s.soldiers.filter(p=>p.needs!.life!=='dead'&&s.squads.some(q=>q.id===p.squadId&&(q.faction??'player')===side)).slice(0,n))recordDeath(s,p,{cause:'combat-fire',at:s.elapsed});
};
const check=(s:ReturnType<typeof create>)=>{
  expect(Math.max(...Object.values(balance(s)).map(Math.abs))).toBeLessThan(1e-6);
  expect(isBattlefieldState(s)).toBe(true);
  expect(new SaveSystem().parse(JSON.stringify(s)).operation?.endless).toEqual(s.operation!.endless);
};
describe('Endless mode ownership and persistence',()=>{
  it.each(['finite','replenishing','continuous'] as const)('creates and restores explicit %s state without changing force size',policy=>{
    const s=create(policy),e=s.operation!.endless!;
    expect(s.operation!.battleMode).toBe('endless');expect(s.operation!.runtime!.missionPlan).toBeUndefined();
    expect(s.operation!.runtime!.locations.filter(l=>l.kind==='village')).toHaveLength(SETTLEMENTS.length);
    expect(e.targetStrength).toEqual({player:s.operation!.initialPlayer,enemy:s.operation!.initialEnemy});check(s);
  });
  it('keeps old settings and normal operations normal; rejects mismatched or missing mode state',()=>{
    const setup=defaultBattleSetup();expect(validBattleSetup(setup)).toBe(true);
    const ordinary=createOperationalBattle('open-front');expect(ordinary.operation!.endless).toBeUndefined();expect(isBattlefieldState(ordinary)).toBe(true);
    const s=create();delete s.operation!.battleMode;expect(isBattlefieldState(s)).toBe(false);
    const missing=create();delete missing.operation!.endless;expect(isBattlefieldState(missing)).toBe(false);
    expect(validBattleSetup({...setup,battleMode:'endless'})).toBe(false);
  });
  it('never hands a persistent battle to the operational outcome evaluator',()=>{
    const s=create(),op=s.operation!,system=new OperationSystem(s,new TerrainSystem(s));
    for(const p of op.runtime!.progress)Object.assign(p,{heldFor:5000,complete:true,satisfied:true});
    op.elapsed=10000;s.elapsed=10000;op.nextOrders=10003;op.nextCombat=10003;
    system.step(.05,()=>{});
    expect(op.status).toBe('active');expect(op.runtime!.lastEvaluation).toBe(0);expect(op.runtime!.nextEvaluation).toBe(0);
    expect(op.endless!.ended).toBeUndefined();
  });
  it('captures, loses and retakes a site using physical presence without creating stock or ending',()=>{
    const s=create(),op=s.operation!,system=new OperationSystem(s,new TerrainSystem(s)),site=op.objectives.find(o=>o.owner==='neutral')!;
    const zone=op.runtime!.zones.find(z=>z.id===site.id)!,crate=s.living!.crates.find(c=>c.id===site.cacheId)!,original={...crate.stock};
    const players=s.soldiers.filter(p=>s.squads.some(q=>q.id===p.squadId&&q.faction!=='enemy')).slice(0,5);
    const enemies=s.soldiers.filter(p=>s.squads.some(q=>q.id===p.squadId&&q.faction==='enemy')).slice(0,5);
    // Isolated capture-authority fixture, not a browser playthrough or a coarse simulation tick.
    op.nextCombat=op.nextOrders=1e9;
    const control=(side:'player'|'enemy')=>{
      for(const p of [...players,...enemies])Object.assign(p,{x:1800,z:1800});
      for(const p of side==='player'?players:enemies)Object.assign(p,{...zone.center,x:zone.center.x+20,action:'watching'});
      for(let i=0;i<1850;i++){s.elapsed+=.05;system.step(.05,()=>{});}
      expect(site.owner).toBe(side);expect(op.status).toBe('active');expect(crate.stock).toEqual(original);
    };
    control('player');control('enemy');control('player');
    expect(op.endless!.statistics.captured.player).toBeGreaterThanOrEqual(2);
    expect(op.endless!.statistics.lost.player).toBeGreaterThanOrEqual(1);
  },15000);
  it('concludes only on explicit End Battle or genuine finite exhaustion, not sleeping or blocked arrivals',()=>{
    const s=create(),e=s.operation!.endless!,r=s.operation!.campaign!.replacements!;
    for(const p of s.soldiers)p.needs!.life='incapacitated';stepEndlessController(s);expect(s.operation!.status).toBe('active');
    expect(endEndlessBattle(s)).toBe(true);expect(e.ended?.cause).toBe('player-ended');expect(s.operation!.status).toBe('ended');expect(endEndlessBattle(s)).toBe(false);check(s);
    const empty=create();kill(empty,1000);stepEndlessController(empty);expect(empty.operation!.status).toBe('active');
    // Spend the remaining finite reserve through real loss manifests, rather than deleting it.
    for(let i=1;i<=6;i++){empty.elapsed=i*180;stepReplacements(empty,.05);}expect(empty.operation!.campaign!.replacements!.reserve.player).toBe(0);stepEndlessController(empty);expect(empty.operation!.status).toBe('active');
    expect(r.reserve.player).toBe(48);
    const zeroSetup=resolveBattleSetup({...defaultBattleSetup(),operation:'open-front',battleMode:'endless',endless:{reinforcements:'finite',pressure:'standard'},advanced:{...defaultBattleSetup().advanced,reserves:0}},42);
    const zero=createOperationalBattle('open-front',42,zeroSetup);kill(zero,1000);stepEndlessController(zero);expect(zero.operation!.endless!.ended).toMatchObject({cause:'force-exhausted',side:'player'});check(zero);
  });
  it('bounds recent history, saves totals, and rejects corrupt authorization/cap state',()=>{
    const s=create();for(let i=0;i<100;i++)endlessEvent(s,'control','record '+i);expect(s.operation!.endless!.history).toHaveLength(64);check(s);
    s.operation!.endless!.sourceStock.player.ammo++;expect(isBattlefieldState(s)).toBe(false);
    const altered=create();altered.operation!.endless!.targetStrength.player++;expect(isBattlefieldState(altered)).toBe(false);
  });
});

describe('bounded physical Endless economy',()=>{
  it('spends only its finite off-map allowance and never overwrites returned stock',()=>{
    const s=create(),w=s.living!,e=s.operation!.endless!,t=w.trucks.find(t=>t.role==='convoy'&&t.faction!=='enemy')!;
    for(let i=0;i<20;i++){
      for(const key of RESOURCES)consume(s,w.rearStock,key,w.rearStock[key]);
      const before={...t.cargo};loadEndlessManifest(s,t,w.rearStock);for(const key of RESOURCES)expect(t.cargo[key]).toBeGreaterThanOrEqual(before[key]);
      for(const key of RESOURCES)consume(s,t.cargo,key,t.cargo[key]);
      s.elapsed+=450;stepEndlessAvailability(s);
    }
    for(const key of RESOURCES)expect(e.sourceUsed.player[key]).toBeLessThanOrEqual(e.sourceInitial[key]+1e-6);
    expect(e.sourceGenerated.player.ammo).toBe(0);check(s);
  });
  it.each(['replenishing','continuous'] as const)('%s stock and manpower authorization stay bounded without demand',policy=>{
    const s=create(policy),e=s.operation!.endless!,r=s.operation!.campaign!.replacements!;
    for(let i=0;i<1000;i++){s.elapsed+=600;stepEndlessAvailability(s);stepReplacements(s,.05);}
    expect(r.reserve.player).toBe(48);expect(r.manifests).toHaveLength(0);expect(e.sourceStock.player).toEqual(e.sourceInitial);expect(e.generatedReserve.player).toBe(0);check(s);
  });
  it('does not import toward a rear target already met, and does not authorize larger armies',()=>{
    const s=create('continuous'),w=s.living!,e=s.operation!.endless!,t=w.trucks.find(t=>t.role==='convoy'&&t.faction!=='enemy')!;
    for(const key of RESOURCES){w.ledger.initial[key]+=e.rearTarget.player[key]-w.rearStock[key];w.rearStock[key]=e.rearTarget.player[key];}
    const before={...w.ledger.imported};loadEndlessManifest(s,t,w.rearStock);expect(w.ledger.imported).toEqual(before);
    expect(requestReserveSquad(s,w.garrisons[0].id).accepted).toBe(false);expect(endlessDeficit(s,'player')).toBe(0);check(s);
  });
  it('physically carries capped replacements through convoy and shuttle; preserves exact mid-travel continuation',()=>{
    let s=create('continuous'),sim=new BattlefieldSimulation(s);kill(s,3);
    const initial=s.operation!.endless!.targetStrength.player;
    let saved=false;const stages=new Set<string>();
    for(let i=0;i<24000;i++){
      s.elapsed+=.05;stepReplacements(s,.05);sim.garrisons.logistics.step(.05);
      const manifests=s.operation!.campaign!.replacements!.manifests;
      for(const m of manifests)stages.add(m.stage);
      if(!saved&&manifests.some(m=>m.stage==='shuttle')){check(s);const loaded=new SaveSystem().parse(JSON.stringify(s));expect(loaded.operation!.campaign!.replacements).toEqual(s.operation!.campaign!.replacements);s=loaded;sim=new BattlefieldSimulation(s);saved=true;}
      if(manifests.filter(m=>m.stage==='arrived').length===3)break;
    }
    expect([...stages]).toEqual(expect.arrayContaining(['edge','convoy','rear','shuttle','arrived']));expect(saved).toBe(true);
    expect(endlessDeficit(s,'player')).toBe(0);expect(s.soldiers.filter(p=>p.needs!.life!=='dead'&&s.squads.some(q=>q.id===p.squadId&&q.faction!=='enemy'))).toHaveLength(initial);
    expect(s.operation!.campaign!.replacements!.reserve.player).toBe(45);check(s);
  },20000);
  it('does not use calendar hours for dispatch cadence',()=>{
    const a=create('continuous'),b=create('continuous');kill(a,2);kill(b,2);a.living!.campaignHours=8;b.living!.campaignHours=800;
    a.elapsed=b.elapsed=90;stepReplacements(a,.05);stepReplacements(b,.05);
    expect(a.operation!.campaign!.replacements!.manifests.map(m=>m.personId)).toEqual(b.operation!.campaign!.replacements!.manifests.map(m=>m.personId));
    expect(a.operation!.campaign!.replacements!.nextAt).toEqual(b.operation!.campaign!.replacements!.nextAt);
  });
  it('uses reported knowledge only, regroups after losses and keeps a reserve',()=>{
    const s=create(),terrain=new TerrainSystem(s),observation=observeEnemy(s),e=s.operation!.endless!;
    const first=commandEndless(observation,terrain,e.director,'standard');
    const changed=structuredClone(s);for(const p of changed.soldiers.filter(p=>changed.squads.some(q=>q.id===p.squadId&&q.faction!=='enemy'))){p.x=1700;p.z=1700;}
    expect(commandEndless(observeEnemy(changed),terrain,e.director,'standard')).toEqual(first);
    const memory={...first.director,phase:'commit' as const,startingAble:1000,reviewAt:1000};
    const retreat=commandEndless(observation,terrain,memory,'standard');expect(retreat.director.phase).toBe('regroup');expect(retreat.director.failedTargets).toHaveLength(1);
  });
  it('physically reoccupies a nearby network while regrouping, unless a delivered threat blocks it',()=>{
    const s=create(),g=s.living!.garrisons.find(g=>g.faction==='enemy')!,q=s.squads.find(q=>g.squadIds.includes(q.id))!;
    q.order={type:'hold',issuedAt:s.elapsed};Object.assign(q,g.entrance);
    const e=s.operation!.endless!;e.director.phase='regroup';e.director.reviewAt=1000;s.operation!.nextOrders=0;
    const occupied:number[]=[];
    const step=()=>new OperationSystem(s,new TerrainSystem(s)).step(.05,()=>{},()=>{},ids=>{occupied.push(...ids);return true;});
    step();expect(occupied).toContain(q.id);
    occupied.length=0;s.operation!.nextOrders=0;
    // Explicit delivered report fixture, not hidden opposing coordinates.
    s.operation!.intelligence!.command.enemy=[{soldierId:s.soldiers[0].id,squadId:s.soldiers[0].squadId,...g.entrance,lastSeen:0,active:true,visible:true}];
    s.operation!.nextCombat=1000;s.operation!.elapsed=.1;step();expect(occupied).not.toContain(q.id);
  });
  it('separates 10/20/30-minute calendars from needs, rolling sleep credit and physical truck motion',()=>{
    const runs=([10,20,30] as const).map(minutes=>{
      const s=create('continuous');s.operation!.setup!.calendarDayMinutes=minutes;
      const sim=new BattlefieldSimulation(s),person=s.soldiers[0];delete person.duty;person.action='walking';person.needs!.sleepHours=3;
      for(let i=0;i<2400;i++){s.elapsed+=.05;s.living!.campaignHours+=.05*calendarHoursPerSecond(s);updateNeeds(s,person,.05);stepReplacements(s,.05);sim.garrisons.logistics.step(.05);}
      check(s);return s;
    });
    expect(runs.map(s=>Number(s.living!.campaignHours.toFixed(2)))) .toEqual([12.8,10.4,9.6]);
    expect(runs[0].soldiers[0].needs).toEqual(runs[1].soldiers[0].needs);expect(runs[1].soldiers[0].needs).toEqual(runs[2].soldiers[0].needs);
    expect(runs[0].living!.trucks).toEqual(runs[1].living!.trucks);expect(runs[1].living!.trucks).toEqual(runs[2].living!.trucks);
    expect(runs[0].living!.ledger).toEqual(runs[2].living!.ledger);
  });
  it('continues the actual fixed-step simulation exactly after save/load',()=>{
    const s=create('continuous'),sim=new BattlefieldSimulation(s);
    for(let i=0;i<200;i++)sim.step(.05);
    check(s);const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));
    for(let i=0;i<200;i++){sim.step(.05);copy.step(.05);}
    expect(copy.state).toEqual(s);check(s);
  },15000);
  it('retires only old casualty presentation, not people, physical dropped stock or provenance',()=>{
    const s=create();kill(s,1000,'player');kill(s,1000,'enemy');
    const stocks=structuredClone(s.living!.crates),people=structuredClone(s.soldiers);
    expect(renderedPersonnel(s).length).toBe(RECENT_FALLEN_LIMIT);
    s.elapsed=301;expect(renderedPersonnel(s)).toHaveLength(0);
    expect(s.living!.crates).toEqual(stocks);expect(s.soldiers).toEqual(people);check(s);
  });
});
