import {describe,it,expect} from 'vitest';
import {defaultBattleSetup,resolveBattleSetup,validBattleSetup,applyPreset,configuredDefinition,forceSummary,armyFor,type BattleSize,type Army} from './BattleSetup';
import {createOperationalBattle} from './createOperationalBattle';
import {OPERATION_IDS,forceSize} from './OperationDefinitions';
import {placeOperation} from './OperationPlacement';
import {placeMissionOperation} from './MissionContent';
import {inZone} from './OperationGeometry';
import {updateRouteAccess,stepOperationalRuntime} from './OperationalRuntime';
import {observeEnemy} from './EnemyCommander';
import {SaveSystem} from '../persistence/SaveSystem';
import {readSetupPresets,saveSetupPreset,SETUP_STORAGE_KEY} from '../persistence/SetupPresets';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {insideWorld,roadRoute} from '../terrain/WorldLayout';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {balance} from '../garrison/Inventory';
import {RESOURCES} from '../garrison/types';
import {equipWeapon} from '../combat/Weapons';
import {renderBattleBriefing} from '../ui/BattleSetupView';

const resolved=(operation=OPERATION_IDS[0],seed=1944)=>resolveBattleSetup({...defaultBattleSetup(),operation,map:'seed',seed},1);

describe('Quick Battle configuration boundary',()=>{
  it('has a valid zero-advanced-input default and reproducible random side',()=>{
    const draft=defaultBattleSetup(),a=resolveBattleSetup({...draft,side:'random'},9876);
    expect(a).toEqual(resolveBattleSetup({...draft,side:'random'},9876));expect(a.map).toBe('seed');
    expect(['us','german']).toContain(a.side);expect(a.seed).toBe(9876);expect(draft.map).toBe('random');
    expect(resolveBattleSetup({...draft,map:'seed',seed:55},99).seed).toBe(55);
  });
  it('rejects corrupt, unsupported and unbounded settings rather than guessing',()=>{
    const s=defaultBattleSetup();for(const patch of [{version:9},{seed:0},{seed:2.4},{size:'1000'},{side:'moon'},{operation:'fake'},{advanced:null},{advanced:{...s.advanced,engineers:100}}])expect(validBattleSetup({...s,...patch})).toBe(false);
    expect(validBattleSetup(s,true)).toBe(false);expect(()=>resolveBattleSetup(s,0)).toThrow();
  });
  it('presets populate real editable options without changing the chosen mission/map',()=>{
    const s={...defaultBattleSetup(),operation:'open-front' as const,side:'german' as const};
    const low=applyPreset(s,'low-supply');expect(low.advanced.supply).toBe('low');expect(low.operation).toBe(s.operation);expect(low.side).toBe('german');
    low.advanced.smoke=false;expect(applyPreset(low,'standard').advanced).toEqual(s.advanced);
    expect(s.advanced.smoke).toBe(true);
  });
  it('bounds all presets below 200 people and does not label them as historical establishments',()=>{
    for(const operation of OPERATION_IDS)for(const size of ['small','medium','large'] as BattleSize[]){const s=resolved(operation);s.size=size;s.advanced.engineers=2;const d=configuredDefinition(operation,s);
      expect(forceSize(d.forces.player)+forceSize(d.forces.enemy)).toBeLessThan(200);
      expect(d.forces.player.rifles).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('Complete setup matrix: 4 operations × 3 sizes × 2 sides × 3 seeds',()=>{
  for(const operation of OPERATION_IDS)for(const size of ['small','medium','large'] as BattleSize[])for(const side of ['us','german'] as Army[]){
    it(`${operation} / ${size} / ${side}: deployment, route, recreation, briefing and save`,()=>{
      for(const seed of [1944,1945,1946]){
        const s={...resolved(operation,seed),size,side},state=createOperationalBattle(operation,seed,s),r=state.operation!.runtime!,t=new TerrainSystem(state);
        expect(state).toEqual(createOperationalBattle(operation,seed,s));
        expect(state.soldiers.length).toBe(state.operation!.initialPlayer+state.operation!.initialEnemy);
        for(const q of state.squads){expect(inZone(q,r.zones.find(z=>z.id===`${q.faction}-deployment`)!)).toBe(true);}
        expect(state.soldiers.every(p=>insideWorld(p)&&!t.obstacleAt(p.x,p.z,.1)&&t.groundTypeAt(p.x,p.z)!=='river')).toBe(true);
        updateRouteAccess(r,t,{player:[],enemy:[]});
        for(const faction of ['player','enemy'] as const){
          expect(r.routes.some(p=>p.side===faction&&r.routeAccess[p.id])).toBe(true);
          const source=r.reinforcements.find(r=>r.side===faction)!;
          expect(roadRoute(source.entry,source.rear).every(p=>insideWorld(p)&&!t.obstacleAt(p.x,p.z,1.6)&&t.groundTypeAt(p.x,p.z)!=='river')).toBe(true);
        }
        expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-7)).toBe(true);
        const sim=new BattlefieldSimulation(state);sim.step(.05);
        const loaded=new SaveSystem().parse(JSON.stringify(state));expect(loaded.operation!.setup).toEqual(s);
        expect(loaded.soldiers).toEqual(state.soldiers);expect(loaded.operation!.runtime).toEqual(r);
        const html=renderBattleBriefing(s);expect(html).toContain(forceSummary(s));expect(html).toContain(placeMissionOperation(s.operation,s.seed,s).objectives[0].title);
        expect(html).toContain(String(state.operation!.initialPlayer));
      }
    },60000);
  }
});

describe('Advanced options change the existing systems',()=>{
  it('uses configured staging in enemy knowledge and scaled forces in mission victory',()=>{
    const s=resolved('meeting');s.size='large';s.advanced.approach='close';const state=createOperationalBattle(s.operation,s.seed,s),r=state.operation!.runtime!;
    expect(observeEnemy(state).operational!.deploymentDepth).toBe(650);
    // Physical occupancy of two sites, and 25 effective enemies: below 45% of
    // this large force, but above 45% of the old fixed default. No contact oracle.
    const friendly=state.squads.filter(q=>q.faction==='player'&&q.kind==='rifle');
    for(let i=0;i<2;i++)for(const p of state.soldiers.filter(p=>p.squadId===friendly[i].id))Object.assign(p,r.locations[i].position);
    const enemyCombat=new Set(state.squads.filter(q=>q.faction==='enemy'&&['rifle','machinegun'].includes(q.kind)).map(q=>q.id));
    state.soldiers.filter(p=>enemyCombat.has(p.squadId)).slice(25).forEach(p=>{p.needs!.life='dead';p.health=0;});
    const terrain=new TerrainSystem(state);for(let i=0;i<91;i++){state.elapsed++;state.operation!.elapsed++;stepOperationalRuntime(state,terrain);}
    expect(state.operation!.status).toBe('victory');
  });
  it.each(OPERATION_IDS)('%s accepts supported extreme options with bounded deployment',id=>{
    const s=resolved(id,7151);s.size='large';Object.assign(s.advanced,{direction:'north',time:'night',engineers:2,mortars:false,smoke:false,supply:'low',reserves:24,approach:'close'});
    const state=createOperationalBattle(id,s.seed,s),r=state.operation!.runtime!;
    expect(r.front.forward).toEqual({x:0,z:-1});expect(state.living!.campaignHours).toBe(22);
    expect(state.squads.every(q=>q.kind==='rifle')).toBe(true);expect(state.soldiers.filter(s=>s.equipment?.tools)).toHaveLength(32);expect(state.soldiers.some(s=>s.equipment?.mortar)).toBe(false);
    expect(state.soldiers.every(p=>insideWorld(p))).toBe(true);
    expect(state.living!.logistics!.manifest.smokeGrenades).toBe(0);expect(state.living!.logistics!.manifest.mortarHE).toBe(0);
    expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-7)).toBe(true);
    if(id==='open-front'){expect(state.operation!.campaign!.replacements!.reserve).toEqual({player:24,enemy:24});expect(r.reinforcements[0].reserve).toBe(24);}
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
  });
  it('keeps low-supply inventory and future manifests honest',()=>{
    const s=resolved(),standard=createOperationalBattle(s.operation,s.seed,s);s.advanced.supply='low';const low=createOperationalBattle(s.operation,s.seed,s);
    for(const key of RESOURCES)expect(low.living!.logistics!.manifest[key]).toBe(Math.floor(standard.living!.logistics!.manifest[key]*.5));
    expect(low.soldiers[0].carried!.ammo).toBe(30);expect(low.living!.rearStock.ammo).toBe(500);
    expect(Object.values(balance(low)).every(n=>Math.abs(n)<1e-7)).toBe(true);
  });
  it('switches nationality, not player authority or AI access',()=>{
    const s=resolved();s.side='german';const state=createOperationalBattle(s.operation,s.seed,s);
    const player=state.squads.find(q=>q.faction==='player'&&q.kind==='rifle')!,enemy=state.squads.find(q=>q.faction==='enemy'&&q.kind==='rifle')!;
    expect(equipWeapon(state,state.soldiers.find(p=>p.id===player.soldierIds[0])!).id).toBe('kar98k');
    expect(equipWeapon(state,state.soldiers.find(p=>p.id===player.soldierIds[1])!).id).toBe('mg42');
    expect(equipWeapon(state,state.soldiers.find(p=>p.id===enemy.soldierIds[0])!).id).toBe('m1');
    expect(armyFor(new SaveSystem().parse(JSON.stringify(state)),'player')).toBe('german');
  });
  it('serializes exact custom continuation and deterministic rematches',()=>{
    const s=resolved('open-front');s.side='german';s.advanced.time='night';s.advanced.reserves=0;
    const state=createOperationalBattle(s.operation,s.seed,s),sim=new BattlefieldSimulation(state);for(let n=0;n<20;n++)sim.step(.05);
    const loaded=new SaveSystem().parse(JSON.stringify(state)),other=new BattlefieldSimulation(loaded);
    for(let n=0;n<20;n++){sim.step(.05);other.step(.05);}expect(loaded).toEqual(state);
    const savedSetup=loaded.operation!.setup!;expect(createOperationalBattle(savedSetup.operation,savedSetup.seed,savedSetup)).toEqual(createOperationalBattle(s.operation,s.seed,s));
    const tampered=structuredClone(state);tampered.operation!.setup!.advanced.direction='west';expect(()=>new SaveSystem().parse(JSON.stringify(tampered))).toThrow();
  });
  it('preserves legacy V2 geometry and saves that lack a setup',()=>{
    const state=createOperationalBattle('breakthrough');expect(state.operation!.setup).toBeUndefined();
    expect(state.operation!.runtime).toEqual(placeOperation('breakthrough',1944));expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
  });
  it('accepts cross-engine road rounding without admitting real geometry changes',()=>{
    const s=resolved(),state=createOperationalBattle(s.operation,s.seed,s),p=state.operation!.runtime!.routes[0].points[118];
    p.z+=1e-10;const loaded=new SaveSystem().parse(JSON.stringify(state));
    expect(loaded.operation!.runtime!.routes[0].points[118].z).toBe(p.z);
    p.z+=.0001;expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow();
    const corrupt=structuredClone(state);(corrupt.operation!.setup as unknown as {advanced:null}).advanced=null;
    expect(()=>new SaveSystem().parse(JSON.stringify(corrupt))).toThrow('not a supported');
  });
});

describe('Local configuration presets',()=>{
  it('stores only settings under a separate key, handles bad data and preserves prior saves on errors',()=>{
    const data=new Map([['frontlines-battlefield-v3-world2-4km','untouched']]);
    const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
    saveSetupPreset(storage,'Night defense',defaultBattleSetup());expect(readSetupPresets(storage)).toHaveLength(1);
    expect(data.get('frontlines-battlefield-v3-world2-4km')).toBe('untouched');expect(data.get(SETUP_STORAGE_KEY)).not.toContain('soldiers');
    expect(()=>saveSetupPreset(storage,'Night defense',defaultBattleSetup())).toThrow('already exists');
    expect(()=>saveSetupPreset({...storage,setItem:()=>{throw Error('quota');}},'Another',defaultBattleSetup())).toThrow('quota');
    expect(readSetupPresets(storage)).toHaveLength(1);data.set(SETUP_STORAGE_KEY,'{');expect(readSetupPresets(storage)).toEqual([]);
  });
});
