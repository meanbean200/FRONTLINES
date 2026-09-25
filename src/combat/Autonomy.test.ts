import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {prepareActions,registerIncoming} from './Reactions';
import {COVER_BUDGET,chooseLocalCover,CoverSpace} from './LocalCover';
import {bodyVolume} from './Ballistics';
import {coordinateMovement} from './Cooperation';
import {SaveSystem} from '../persistence/SaveSystem';
import {insideWorld} from '../terrain/WorldLayout';
import {WORLD_HALF} from '../core/types';
function fixture(){
  const state=createOperation('advance'),sim=new BattlefieldSimulation(state),s=state.soldiers[0],q=state.squads[0];
  Object.assign(s,{x:0,z:0});Object.assign(q,{x:0,z:0});state.operation!.nextOrders=1e9;
  vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);
  vi.spyOn(sim.terrain,'coverAt').mockReturnValue('open');vi.spyOn(sim.terrain,'obstacleAt').mockReturnValue(false);
  vi.spyOn(sim.terrain,'localCoverAnchors').mockReturnValue([{x:3,z:0},{x:-3,z:0}]);vi.spyOn(sim.navigation,'segmentClear').mockReturnValue(true);
  vi.spyOn(sim.terrain.objects,'trace').mockImplementation((_a,b)=>({clear:Math.abs(b.x)<2,transmission:1}));
  return {state,sim,s,q};
}
describe('autonomous protective behavior',()=>{
  it('pinned soldiers lower their body and crawl a bounded distance to reachable cover while retaining the order',()=>{
    const {state,sim,s,q}=fixture();q.order={type:'move',target:{x:30,z:0},drawnPath:[{x:0,z:0},{x:30,z:0}],issuedAt:0,pushThrough:true};
    const before=structuredClone(q.order),upright=bodyVolume(sim.terrain,s);s.suppression=85;registerIncoming(s,0,0);
    prepareActions(state,sim.terrain,sim.navigation,.05);
    expect(s.posture).toBe('prone');expect(s.action).toBe('crawling to cover');expect(Math.hypot(s.x,s.z)).toBeCloseTo(.0225);expect(bodyVolume(sim.terrain,s).ry).toBeLessThan(upright.ry);expect(q.order).toEqual(before);
    const saved=new SaveSystem().parse(JSON.stringify(state));expect(saved.soldiers[0]).toEqual(s);
    const copy=new BattlefieldSimulation(saved);vi.spyOn(copy.terrain,'obstacleAt').mockReturnValue(false);vi.spyOn(copy.terrain,'coverAt').mockReturnValue('open');
    for(let n=0;n<20;n++){state.elapsed+=.05;saved.elapsed+=.05;prepareActions(state,sim.terrain,sim.navigation,.05);prepareActions(saved,copy.terrain,copy.navigation,.05);}
    expect(saved.soldiers[0]).toEqual(s);
  });
  it('cover choice rejects allied occupied and unreachable locations and has a hard query budget',()=>{
    const {state,sim,s,q}=fixture();registerIncoming(s,0,0);s.posture='prone';const ally=state.soldiers[1];Object.assign(ally,{x:3,z:0});
    vi.spyOn(sim.navigation,'segmentClear').mockImplementation((_a,b)=>b.x===3||b.x===-3);
    const choice=chooseLocalCover(s,q,sim.terrain,sim.navigation,new CoverSpace(state),true);
    expect(choice.point).toEqual({x:-3,z:0});expect(choice.tested).toBeLessThan(COVER_BUDGET);
    vi.mocked(sim.navigation.segmentClear).mockReturnValue(false);expect(chooseLocalCover(s,q,sim.terrain,sim.navigation,new CoverSpace(state),true).point).toBeUndefined();
  });
  it('uses only an incoming bearing and allied reservations, never hidden enemy positions',()=>{
    const {state,sim,s,q}=fixture();vi.mocked(sim.terrain.objects.trace).mockImplementation((a,b)=>({clear:Math.abs(b.x)<.5||(a.x>0?b.x>0:b.x<0),transmission:1}));
    registerIncoming(s,0,Math.PI/2);const first=chooseLocalCover(s,q,sim.terrain,sim.navigation,new CoverSpace(state));expect(first.point!.x).toBeLessThan(0);
    for(const enemy of state.soldiers.filter(p=>state.squads.find(q=>q.id===p.squadId)?.faction==='enemy'))Object.assign(enemy,first.point);
    expect(chooseLocalCover(s,q,sim.terrain,sim.navigation,new CoverSpace(state))).toEqual(first);
    registerIncoming(s,0,-Math.PI/2);expect(chooseLocalCover(s,q,sim.terrain,sim.navigation,new CoverSpace(state)).point!.x).toBeGreaterThan(0);
  });
  it('never reserves off-map cover, even when the terrain query makes it attractive',()=>{
    const {state,sim,s,q}=fixture();registerIncoming(s,0,0);s.posture='prone';
    vi.mocked(sim.terrain.objects.trace).mockImplementation((_a,b)=>({clear:insideWorld(b),transmission:1}));
    for(const edge of [{x:WORLD_HALF,z:0},{x:-WORLD_HALF,z:0},{x:0,z:WORLD_HALF},{x:0,z:-WORLD_HALF}]){
      Object.assign(s,edge);const outside={x:edge.x*1.002,z:edge.z*1.002};
      vi.mocked(sim.terrain.localCoverAnchors).mockReturnValue([outside]);
      expect(chooseLocalCover(s,q,sim.terrain,sim.navigation,new CoverSpace(state),true).point).toBeUndefined();
    }
  });
  it('rejects an old off-map reaction route without moving the soldier or losing the player order',()=>{
    const {state,sim,s,q}=fixture();s.suppression=85;const order=structuredClone(q.order);
    for(const edge of [{x:WORLD_HALF,z:0},{x:-WORLD_HALF,z:0},{x:0,z:WORLD_HALF},{x:0,z:-WORLD_HALF}]){
      Object.assign(s,edge);s.combat={shotSequence:0,reaction:'pinned',reactionUntil:6,coverReview:10,reactionIndex:0,reactionRoute:[{x:edge.x*1.002,z:edge.z*1.002}]};
      prepareActions(state,sim.terrain,sim.navigation,.05);
      expect({x:s.x,z:s.z}).toEqual(edge);expect(s.combat.reactionRoute).toBeUndefined();
      expect(s.combat.pauseReason).toContain('map boundary');expect(q.order).toEqual(order);
      expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
    }
  });
  it('broken morale overrides protective crawling and preserves the destination',()=>{
    const {state,sim,s,q}=fixture();s.morale=5;s.suppression=85;q.order={type:'move',target:{x:30,z:0},issuedAt:0};vi.spyOn(sim.navigation,'plan').mockReturnValue([{x:-5,z:0}]);
    prepareActions(state,sim.terrain,sim.navigation,.05);expect(s.combat!.reaction).toBe('broken');expect(s.action).toBe('falling back');expect(q.order.target).toEqual({x:30,z:0});
  });
  it('ordinary movement does not wait forever for ineffective support',()=>{
    const {state,q}=fixture();q.order={type:'move',target:{x:100,z:0},issuedAt:0};state.operation!.intelligence={squads:[{squadId:q.id,contacts:[{soldierId:999,squadId:888,x:100,z:0,lastSeen:0,visible:true,active:true}],exposure:[],link:'connected',nextReport:0}],reports:[],command:{player:[],enemy:[]},sounds:[]};
    const people=state.soldiers.filter(s=>s.squadId===q.id);for(const s of people)s.combat={shotSequence:0,owner:'order'};
    coordinateMovement(state);expect(people.filter(s=>s.combat!.owner==='order')).toHaveLength(0);
    state.elapsed=3;for(const s of people)s.combat!.owner='order';coordinateMovement(state);
    expect(people.filter(s=>s.combat!.owner==='order').length).toBe(4);expect(q.order.type).toBe('move');
  });
});
