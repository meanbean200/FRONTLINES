import {describe,it,expect} from 'vitest';
import {createBattlefield} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {polylineLength,distance,type TrenchState} from '../core/types';
import {atDistance} from '../core/Polyline';
import {excavatedSpan,excavatedPoints,excavationBoundsKey} from '../core/TrenchGeometry';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {balance} from '../garrison/Inventory';

function fixture(offset=20){
  const state=createBattlefield();state.squads=state.squads.filter(q=>q.kind==='engineer').slice(0,1);
  const q=state.squads[0];state.soldiers=state.soldiers.filter(s=>s.squadId===q.id);state.trenches=[];state.craters=[];
  q.x=-1800;q.z=-1700-offset;
  state.soldiers.forEach((s,i)=>{s.x=q.x+(i%4-1.5)*1.5;s.z=q.z+Math.floor(i/4)*1.5;});
  const sim=new BattlefieldSimulation(state);
  const main=sim.createTrench([{x:-1880,z:-1700},{x:-1720,z:-1700}],q.id)!;
  return {sim,q,main:state.trenches.find(t=>t.id===main)!};
}
function run(sim:BattlefieldSimulation,seconds:number){for(let i=0;i<seconds*20;i++)sim.step(.05);}

describe('engineer work parties',()=>{
  it('uses a whole mixed-kit detail without inventing tools or sending escorts outside',()=>{
    const {sim,q,main}=fixture();
    sim.state.soldiers.forEach((s,i)=>s.equipment!.tools=i===0);
    run(sim,35);
    expect(sim.state.soldiers.filter(s=>s.action==='digging')).toHaveLength(1);
    expect(sim.state.soldiers.filter(s=>s.action==='clearing spoil')).toHaveLength(7);
    expect(sim.state.soldiers.filter(s=>s.equipment!.tools)).toHaveLength(1);
    expect(sim.state.soldiers.every(s=>sim.terrain.coverAt(s.x,s.z)==='trench')).toBe(true);
    const before=main.progress*polylineLength(main.points);run(sim,1);
    expect(main.progress*polylineLength(main.points)-before).toBeCloseTo(.9,2);
    expect(q.orderNote).toContain('7 clearing spoil');
    const loaded=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    run(sim,20);run(loaded,20);expect(loaded.state).toEqual(sim.state);
  });
  it('slows a one-tool detail when helpers are lost and stops when its tool carrier is lost',()=>{
    const {sim,main}=fixture();sim.state.soldiers.forEach((s,i)=>s.equipment!.tools=i===0);run(sim,35);
    for(const s of sim.state.soldiers.slice(4)){s.health=0;s.needs!.life='dead';}
    const before=main.progress;run(sim,1);expect((main.progress-before)*160).toBeLessThanOrEqual(.500001);
    sim.state.soldiers[0].health=0;sim.state.soldiers[0].needs!.life='dead';
    const stopped=main.progress;run(sim,3);expect(main.progress).toBe(stopped);
  });
  it('shares limited tool carriers between fronts, then completes both ends',()=>{
    const {sim,main}=fixture();sim.state.soldiers.forEach((s,i)=>s.equipment!.tools=i<2);run(sim,40);
    expect(main.excavation!.start).toBeLessThan(80);expect(main.excavation!.end).toBeGreaterThan(80);
    expect(sim.state.soldiers.filter(s=>s.action==='clearing spoil')).toHaveLength(6);
    run(sim,170);expect(main.status).toBe('complete');
  });
  it('starts a fresh isolated line at its middle and opens both real work fronts',()=>{
    const {sim,q,main}=fixture();expect(main.excavation).toEqual({start:80,end:80,origin:80});
    run(sim,40);
    expect(main.excavation!.start).toBeLessThan(65);expect(main.excavation!.end).toBeGreaterThan(95);
    expect(main.progress).toBeLessThan(.5);
    expect(new Set(q.engineerWork!.crews.map(c=>c.direction))).toEqual(new Set([-1,1]));
    expect(sim.state.soldiers.some(s=>s.x< -1810&&s.action==='digging')).toBe(true);
    expect(sim.state.soldiers.some(s=>s.x> -1790&&s.action==='digging')).toBe(true);
    sim.terrain.syncModifications();expect(sim.terrain.coverAt(-1800,-1700)).toBe('trench');
    expect(sim.terrain.coverAt(-1870,-1700)).not.toBe('trench');expect(sim.terrain.coverAt(-1730,-1700)).not.toBe('trench');
    const network=new TrenchNetwork();network.sync(sim.state.trenches);
    expect(network.corridorContains({x:-1800,z:-1700})).toBe(true);
    expect(network.corridorContains({x:-1870,z:-1700})).toBe(false);
  });
  it('does not excavate remotely while walking to a distant job',()=>{
    const {sim,main}=fixture(200);run(sim,20);expect(main.progress).toBe(0);
    expect(excavatedPoints(main)).toEqual([]);
  });
  it('splits onto a connected branch while both main-line fronts are still unfinished',()=>{
    const {sim,q,main}=fixture();const id=sim.createTrench([{x:-1800,z:-1700},{x:-1800,z:-1780}],q.id)!;
    const branch=sim.state.trenches.find(t=>t.id===id)!;run(sim,40);
    expect(main.progress).toBeGreaterThan(0);expect(main.progress).toBeLessThan(1);expect(branch.progress).toBeGreaterThan(.05);
    expect(branch.excavation!.origin).toBeLessThan(3);
    expect(new Set(q.engineerWork!.crews.map(c=>`${c.trenchId}:${c.direction}`)).size).toBe(3);
    run(sim,230);expect(sim.state.trenches.every(t=>t.progress===1)).toBe(true);expect(q.constructionQueue).toHaveLength(0);
  });
  it('keeps disconnected drawings queued, then completes them without abandoning unfinished ends',()=>{
    const {sim,q,main}=fixture();const id=sim.createTrench([{x:-1900,z:-1900},{x:-1820,z:-1900}],q.id)!;
    const other=sim.state.trenches.find(t=>t.id===id)!;run(sim,40);
    expect(main.progress).toBeGreaterThan(0);expect(other.progress).toBe(0);expect(other.excavation).toBeUndefined();
    run(sim,300);expect(main.progress).toBe(1);expect(other.progress).toBe(1);
  });
  it('finishes a bent loop and several branches without leaving a crew or unfinished arm behind',()=>{
    const {sim,q,main}=fixture();
    const ids=[
      sim.createTrench([{x:-1800,z:-1700},{x:-1800,z:-1760},{x:-1740,z:-1760},{x:-1740,z:-1700}],q.id),
      sim.createTrench([{x:-1840,z:-1700},{x:-1840,z:-1640}],q.id),
      sim.createTrench([{x:-1760,z:-1700},{x:-1760,z:-1640}],q.id),
    ];
    expect(ids.every(id=>id!==undefined)).toBe(true);
    run(sim,500);
    expect(sim.state.trenches.every(t=>t.status==='complete'&&t.progress===1)).toBe(true);
    expect(q.order.type).toBe('hold');expect(q.engineerWork).toBeUndefined();expect(q.constructionQueue).toHaveLength(0);
    const network=new TrenchNetwork();network.sync(sim.state.trenches);
    expect(network.route({x:-1830,z:-1700},{x:-1740,z:-1730}).length).toBeGreaterThan(1);
    expect(main.excavation).toEqual({start:0,end:160,origin:80});
  });
  it('does no work while every engineer is suppressed, then recovers without losing the fronts',()=>{
    const {sim,main}=fixture();run(sim,25);
    const before={...main.excavation!};sim.state.soldiers.forEach(s=>s.suppression=100);
    run(sim,1);expect(main.excavation).toEqual(before);
    sim.state.soldiers.forEach(s=>s.suppression=0);run(sim,1);
    expect(main.excavation!.start).toBeLessThan(before.start);expect(main.excavation!.end).toBeGreaterThan(before.end);
  });
  it('bounds total work by present fit people and scales down after casualties',()=>{
    const {sim,main}=fixture();run(sim,25);
    const before=main.progress*polylineLength(main.points);run(sim,1);
    const amount=main.progress*polylineLength(main.points)-before;expect(amount).toBeGreaterThan(1.4);expect(amount).toBeLessThanOrEqual(1.600001);
    for(const s of sim.state.soldiers.slice(0,4)){s.health=0;s.needs!.life='dead';}
    const after=main.progress*polylineLength(main.points);run(sim,1);
    expect(main.progress*polylineLength(main.points)-after).toBeLessThanOrEqual(.800001);
  });
  it('pauses every branch and resumes owned unfinished works without moving completed earth',()=>{
    const {sim,q,main}=fixture();sim.createTrench([{x:-1800,z:-1700},{x:-1800,z:-1780}],q.id);run(sim,35);
    const spans=sim.state.trenches.map(t=>({...t.excavation!}));sim.issueHold([q.id]);run(sim,5);
    expect(q.engineerWork).toBeUndefined();expect(sim.state.trenches.map(t=>t.excavation)).toEqual(spans);
    expect(sim.state.trenches.every(t=>t.status==='planned')).toBe(true);expect(sim.resumeConstruction([q.id])).toBe(1);
    run(sim,240);expect(main.progress).toBe(1);expect(sim.state.trenches.every(t=>t.progress===1)).toBe(true);
  });
  it('continues a saved multi-front trip and excavation identically',()=>{
    const {sim:a,q}=fixture();a.createTrench([{x:-1800,z:-1700},{x:-1800,z:-1780}],q.id);run(a,20);
    const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(a.state)));
    run(a,80);run(b,80);expect(b.state).toEqual(a.state);
    for(const value of Object.values(balance(a.state)))expect(Math.abs(value)).toBeLessThan(1e-7);
  });
  it('retains legacy prefix excavation rather than moving it to the middle',()=>{
    const {sim,q,main}=fixture();sim.issueHold([q.id]);delete main.excavation;main.progress=.25;main.status='planned';
    sim.resumeConstruction([q.id]);expect(main.excavation).toEqual({start:0,end:40,origin:0});
    expect(distance(sim.trenches.constructionHead(main),atDistance(main.points,40))).toBeLessThan(.001);
    run(sim,10);expect(main.excavation!.start).toBe(0);expect(main.excavation!.end).toBeGreaterThanOrEqual(40);
  });
  it('validates work intervals and rejects duplicated or foreign crew members',()=>{
    const {sim,q,main}=fixture();run(sim,1);const save=new SaveSystem(),valid=JSON.stringify(sim.state);
    expect(()=>save.parse(valid)).not.toThrow();
    main.excavation!.start=main.excavation!.end+10;expect(()=>save.parse(JSON.stringify(sim.state))).toThrow();
    const duplicate=JSON.parse(valid);duplicate.squads[0].engineerWork.crews[1].soldierIds[0]=q.engineerWork!.crews[0].soldierIds[0];
    expect(()=>save.parse(JSON.stringify(duplicate))).toThrow();
    const foreign=JSON.parse(valid);foreign.squads[0].engineerWork.crews[0].soldierIds[0]=999999;expect(()=>save.parse(JSON.stringify(foreign))).toThrow();
  });
  it('clips bent completed geometry without opening either unfinished arm',()=>{
    const t:TrenchState={id:1,points:[{x:0,z:0},{x:40,z:0},{x:40,z:40}],progress:.5,status:'building',width:4.2,depth:1.75,excavation:{start:20,end:60,origin:40}};
    expect(excavatedPoints(t)).toEqual([{x:20,z:0},{x:40,z:0},{x:40,z:20}]);
    expect(excavatedSpan({...t,excavation:{start:20.2,end:60.8,origin:40}},1)).toEqual({start:21,end:60});
    const network=new TrenchNetwork();network.sync([t]);expect(network.corridorContains({x:0,z:0})).toBe(false);
    expect(network.route({x:25,z:0},{x:40,z:15}).length).toBeGreaterThan(1);
  });
  it('invalidates only terrain near the growing front, not a finished distant chunk',()=>{
    const t:TrenchState={id:1,points:[{x:-2000,z:100},{x:2000,z:100}],progress:.5,status:'building',width:4.2,depth:1.75,excavation:{start:1000,end:3000,origin:2000}};
    const middle=excavationBoundsKey(t,0,0),left=excavationBoundsKey(t,-1500,0),right=excavationBoundsKey(t,1000,0);
    t.excavation!.start-=20;t.progress+=20/4000;
    expect(excavationBoundsKey(t,0,0)).toBe(middle);expect(excavationBoundsKey(t,1000,0)).toBe(right);
    expect(excavationBoundsKey(t,-1500,0)).not.toBe(left);
  });
});
