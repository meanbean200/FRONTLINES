import {describe,it,expect,vi} from 'vitest';
import {commandEnemy,observeEnemy,type EnemyObservation,type OwnSquad} from './EnemyCommander';
import {createOperation} from './createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {distance} from '../core/types';
import {balance,consume} from '../garrison/Inventory';

function fixture(){
  const sim=new BattlefieldSimulation(createOperation('defense'));
  vi.spyOn(sim.terrain,'obstacleAt').mockReturnValue(false);vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');
  vi.spyOn(sim.terrain,'coverAt').mockReturnValue('open');vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);
  vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);sim.terrain.buildings=[];vi.spyOn(sim.terrain.objects,'trees').mockReturnValue([]);
  const squad=(id:number,x:number,z:number):OwnSquad=>({id,x,z,able:8,initial:8,health:100,morale:90,energy:90,suppression:0,ammo:60,effectiveUntil:1000,moving:false,planning:false});
  const o:EnemyObservation={at:100,seed:1944,mode:'defense',squads:[squad(1,-100,0),squad(2,-100,25)],contacts:[{soldierId:101,squadId:10,x:0,z:0,lastSeen:100,visible:true,active:true}],objectives:[{id:'village',x:30,z:0,owner:'player',contested:false,ammo:0,radius:43},{id:'farm',x:-150,z:-100,owner:'neutral',contested:false,ammo:0,radius:43},{id:'orchard',x:130,z:120,owner:'player',contested:false,ammo:0,radius:43}]};
  return {sim,o};
}
describe('enemy tactical commander',()=>{
  it('pairs a holding fire-support squad with a lateral maneuver instead of charging together',()=>{
    const {sim,o}=fixture(),result=commandEnemy(o,sim.terrain);
    expect(result.memory.plans.map(p=>p.role)).toEqual(['support','flank']);
    const flank=result.commands.find(c=>c.squadId===2)!;expect(flank.type).toBe('move');
    const original=o.squads[1],d=distance(original,o.contacts[0]);
    const lateral=(flank.goal.x*original.z-flank.goal.z*original.x)/d;
    expect(Math.abs(lateral)).toBeGreaterThan(28);expect(distance(flank.goal,o.contacts[0])).toBeGreaterThan(55);
    expect(result.commands.some(c=>c.squadId===1&&c.type==='move')).toBe(false);
  });
  it('does not flank without another able squad covering',()=>{
    const {sim,o}=fixture();o.squads[0].moving=true;
    expect(commandEnemy(o,sim.terrain).memory.plans.every(p=>p.role==='support')).toBe(true);
  });
  it('does not count a withdrawing or newly moving squad as covering fire',()=>{
    const {sim,o}=fixture();o.squads[0].morale=15;
    const result=commandEnemy(o,sim.terrain);
    expect(result.memory.plans.map(p=>p.role)).toEqual(['withdraw','support']);
    o.squads[0].morale=90;
    vi.mocked(sim.terrain.coverAt).mockImplementation(x=>x< -104?'forest':'open');
    const cover=commandEnemy(o,sim.terrain);
    expect(cover.commands.some(c=>c.squadId===1&&c.type==='move')).toBe(true);
    expect(cover.memory.plans[1].role).toBe('support');
  });
  it('uses nearby cover broad enough for a squad when establishing fire support',()=>{
    const {sim,o}=fixture();o.squads=[o.squads[0]];
    vi.mocked(sim.terrain.coverAt).mockImplementation(x=>x< -104?'forest':'open');
    const result=commandEnemy(o,sim.terrain),move=result.commands[0];
    expect(move.type).toBe('move');expect(move.goal.x).toBeLessThan(-104);expect(distance(move.goal,o.squads[0])).toBeLessThan(16);
  });
  it('withdraws weakened squads away from observed threats, without changing health or ammunition',()=>{
    const {sim,o}=fixture();o.squads[0].able=2;const before=structuredClone(o);
    const result=commandEnemy(o,sim.terrain),plan=result.memory.plans[0];
    expect(plan.role).toBe('withdraw');expect(distance(plan.goal,o.contacts[0])).toBeGreaterThan(distance(o.squads[0],o.contacts[0])+35);
    expect(o).toEqual(before);
  });
  it('pins heavily suppressed squads instead of ordering a long exposed flank',()=>{
    const {sim,o}=fixture();o.squads[1].suppression=85;
    const plan=commandEnemy(o,sim.terrain).memory.plans[1];expect(plan.role).toBe('pinned');expect(distance(plan.goal,o.squads[1])).toBeLessThanOrEqual(9.01);
  });
  it('seeks only a finite enemy-owned cache when ammunition is low',()=>{
    const {sim,o}=fixture();o.contacts=[];o.squads[0].ammo=2;o.objectives[1].owner='enemy';o.objectives[1].ammo=100;
    const result=commandEnemy(o,sim.terrain),plan=result.memory.plans[0];
    expect(plan.role).toBe('resupply');expect(plan.goal).toEqual({x:-150,z:-100});expect(o.squads[0].ammo).toBe(2);
    o.objectives[1].ammo=0;expect(commandEnemy(o,sim.terrain).memory.plans[0].role).toBe('withdraw');
  });
  it('finishes physical loading and immediately abandons a cache lost to the enemy',()=>{
    const {sim,o}=fixture();o.contacts=[];o.squads[0].ammo=2;o.objectives[1].owner='enemy';o.objectives[1].ammo=100;
    const first=commandEnemy(o,sim.terrain);o.at=130;o.squads[0].ammo=15;
    Object.assign(o.squads[0],first.memory.plans[0].goal);
    const loading=commandEnemy(o,sim.terrain,first.memory);expect(loading.memory.plans[0].role).toBe('resupply');
    o.at=133;o.objectives[1].owner='player';
    expect(commandEnemy(o,sim.terrain,loading.memory).memory.plans[0].role).not.toBe('resupply');
  });
  it('holds useful defensive cover and advances toward uncaptured objectives without contacts',()=>{
    const {sim,o}=fixture();o.contacts=[];
    const advancing=commandEnemy(o,sim.terrain).memory.plans[0];expect(advancing.role).toBe('advance');
    expect(distance(advancing.goal,o.objectives[0])).toBeLessThan(distance(o.squads[0],o.objectives[0])-20);
    o.mode='advance';o.squads=[{...o.squads[0],x:30,z:0}];o.objectives[0].owner='enemy';vi.mocked(sim.terrain.coverAt).mockReturnValue('forest');
    const defending=commandEnemy(o,sim.terrain);expect(defending.memory.plans[0].role).toBe('defend');expect(defending.commands).toHaveLength(0);
  });
  it('preserves commitments rather than replacing movement orders every decision',()=>{
    const {sim,o}=fixture();let {memory,commands}=commandEnemy(o,sim.terrain);expect(commands).toHaveLength(1);
    o.squads[1].moving=true;o.squads[1].orderTarget=memory.plans[1].goal;
    for(let i=1;i<4;i++){o.at+=3;o.squads[1].x+=2;const next=commandEnemy(o,sim.terrain,memory);expect(next.commands).toHaveLength(0);memory=next.memory;}
    expect(memory.plans[1].orders).toBe(1);
  });
  it('retries rate-limited changed orders instead of committing to an unissued plan',()=>{
    const {sim,o}=fixture();o.contacts=[];o.squads=[o.squads[0]];
    const first=commandEnemy(o,sim.terrain);o.at+=3;
    first.memory.plans[0].commitUntil=o.at;
    o.squads[0].moving=true;o.squads[0].orderTarget={x:-400,z:100};
    const limited=commandEnemy(o,sim.terrain,first.memory);
    expect(limited.commands).toHaveLength(0);expect(limited.memory.plans[0].commitUntil).toBe(o.at);
    o.at+=3;expect(commandEnemy(o,sim.terrain,limited.memory).commands).toHaveLength(1);
  });
  it('does not read hidden enemy positions, casualties, orders or personal supplies',()=>{
    const a=createOperation('advance'),b=structuredClone(a);
    for(const soldier of b.soldiers.filter(s=>b.squads.find(q=>q.id===s.squadId)?.faction==='player')){
      soldier.x+=2000;soldier.z-=2000;soldier.health=0;soldier.carried!.ammo=0;soldier.needs!.life='dead';
    }
    for(const q of b.squads.filter(q=>q.faction==='player'))q.order={type:'move',target:{x:2500,z:2500},issuedAt:0};
    expect(observeEnemy(b)).toEqual(observeEnemy(a));
    const terrain=new BattlefieldSimulation(a).terrain;
    expect(commandEnemy(observeEnemy(b),terrain)).toEqual(commandEnemy(observeEnemy(a),terrain));
  });
  it('uses the last observed coordinates and stops searching once the contact expires',()=>{
    const {sim,o}=fixture();o.contacts[0].visible=false;
    expect(commandEnemy(o,sim.terrain).memory.plans[0].role).toBe('search');
    o.contacts=[];expect(commandEnemy(o,sim.terrain).memory.plans[0].role).toBe('advance');
  });
  it('continues saved enemy plans exactly, with no new supply or player orders',()=>{
    const a=new BattlefieldSimulation(createOperation('defense'));
    for(let i=0;i<2200;i++)a.step(.05);
    expect(a.state.operation!.enemyAI!.plans).toHaveLength(6);
    const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(a.state)));
    for(let i=0;i<400;i++){a.step(.05);b.step(.05);}
    expect(b.state).toEqual(a.state);expect(a.state.squads.filter(q=>q.faction==='player').every(q=>q.order.type==='hold')).toBe(true);
    for(const error of Object.values(balance(a.state)))expect(Math.abs(error)).toBeLessThan(1e-7);
  },45000);
  it('walks to ammunition, transfers only on arrival, and resumes a saved resupply trip exactly',()=>{
    const a=new BattlefieldSimulation(createOperation('advance')),state=a.state;
    const q=state.squads.find(s=>s.faction==='enemy')!,people=state.soldiers.filter(s=>s.squadId===q.id);
    // Isolate a real trip; all other troops remain alive but away from the route.
    for(const squad of state.squads)if(squad!==q){squad.x+=1200;squad.z+=1200;for(const s of state.soldiers.filter(s=>s.squadId===squad.id)){s.x+=1200;s.z+=1200;}}
    for(const s of state.soldiers)s.nextShotAt=10000;
    for(const s of people){consume(state,s.carried!,'ammo',58);s.ammunition=s.carried!.ammo;}
    const farm=state.operation!.objectives[0];farm.owner='enemy';farm.control=-1;
    state.operation!.nextOrders=0;
    const crate=state.living!.crates.find(c=>c.id===farm.cacheId)!;
    const start=crate.stock.ammo;
    let b:BattlefieldSimulation|undefined,loaded=false;
    for(let tick=0;tick<1600;tick++){
      const before=people.map(s=>s.carried!.ammo);a.step(.05);b?.step(.05);
      for(const [i,s] of people.entries())if(s.carried!.ammo>before[i]){loaded=true;expect(distance(s,crate)).toBeLessThanOrEqual(12.001);}
      if(tick===99){expect(crate.stock.ammo).toBe(start);expect(q.order.type).toBe('move');b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));}
    }
    expect(loaded).toBe(true);expect(crate.stock.ammo).toBeLessThan(start-200);
    expect(people.reduce((sum,s)=>sum+s.carried!.ammo,0)/people.length).toBeGreaterThanOrEqual(25);
    expect(b!.state).toEqual(state);
    for(const error of Object.values(balance(state)))expect(Math.abs(error)).toBeLessThan(1e-7);
  },45000);
  it('validates persisted AI memories and accepts pre-AI saves',()=>{
    const state=createOperation('advance'),save=new SaveSystem(),sim=new BattlefieldSimulation(state);
    expect(()=>save.parse(JSON.stringify(state))).not.toThrow();
    for(let i=0;i<70;i++)sim.step(.05);expect(state.operation!.enemyAI).toBeDefined();
    const valid=JSON.stringify(state);expect(()=>save.parse(valid)).not.toThrow();
    state.operation!.enemyAI!.plans[0].squadId=state.squads[0].id;expect(()=>save.parse(JSON.stringify(state))).toThrow();
    const bad=JSON.parse(valid);bad.operation.enemyAI.plans[0].goal.x=null;expect(()=>save.parse(JSON.stringify(bad))).toThrow();
    const version=JSON.parse(valid);version.operation.enemyAI.version=999;expect(()=>save.parse(JSON.stringify(version))).toThrow();
  });
});
