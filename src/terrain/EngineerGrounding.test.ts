import {describe,it,expect} from 'vitest';
import {createBattlefield} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {TerrainSystem} from './TerrainSystem';
import type {TrenchState} from '../core/types';

function earthwork(origin=50){
  const state=createBattlefield();state.craters=[];
  const t:TrenchState={id:state.nextEntityId++,points:[{x:-1850,z:-1700},{x:-1750,z:-1700}],width:4.2,depth:1.75,status:'building',progress:.4,excavation:{start:30,end:70,origin}};
  state.trenches=[t];return {state,t,terrain:new TerrainSystem(state)};
}

describe('engineers on excavated ground',()=>{
  it('gives both work fronts the same dug floor without dragging an entrance ramp along the left face',()=>{
    const {terrain}=earthwork();
    for(const x of [-1819.3,-1780.7]){
      expect(terrain.deformationAt(x,-1699.35)).toBeCloseTo(-1.75,6);
      expect(terrain.coverAt(x,-1699.35)).toBe('trench');
    }
    expect(terrain.coverAt(-1830,-1700)).not.toBe('trench');
  });
  it('does not refill finished ground as either face advances',()=>{
    const {terrain,t}=earthwork();const before=terrain.deformationAt(-1819.3,-1699.35);
    t.excavation!.start=20;t.excavation!.end=80;t.progress=.6;terrain.syncModifications();
    expect(terrain.deformationAt(-1819.3,-1699.35)).toBe(before);
    expect(terrain.coverAt(-1829.3,-1699.35)).toBe('trench');
  });
  it('retains the fixed entrance slope of a legacy end-started trench',()=>{
    const {terrain,t}=earthwork(0);t.excavation!.start=0;t.progress=.7;terrain.syncModifications();
    expect(terrain.coverAt(-1849.8,-1700)).not.toBe('trench');
    expect(terrain.deformationAt(-1840,-1700)).toBeCloseTo(-1.75,6);
    const before=terrain.deformationAt(-1849.8,-1700);
    t.excavation!.end=90;t.progress=.9;terrain.syncModifications();
    expect(terrain.deformationAt(-1849.8,-1700)).toBe(before);
  });
  it('keeps a reverse-started entrance at its original end',()=>{
    const {terrain,t}=earthwork(100);t.excavation!.end=100;t.progress=.7;terrain.syncModifications();
    expect(terrain.coverAt(-1750.2,-1700)).not.toBe('trench');
    expect(terrain.deformationAt(-1819.3,-1699.35)).toBeCloseTo(-1.75,6);
  });
  it('refreshes cover for an immobile suppressed engineer when nearby earth is excavated',()=>{
    const {state,t}=earthwork(),q=state.squads.find(q=>q.kind==='engineer')!;
    state.squads=[q];state.soldiers=state.soldiers.filter(s=>s.squadId===q.id);
    q.order={type:'construct-trench',trenchId:t.id,issuedAt:0};t.engineerSquadId=q.id;
    q.workStarted=true;q.engineerWork={version:1,nextReview:1000,crews:[{soldierIds:q.soldierIds,trenchId:t.id,direction:1,route:[],routeIndex:0,approached:true}]};
    state.soldiers.forEach(s=>{s.x=-1810;s.z=-1700;s.cover='open';s.suppression=100;});
    t.depth=.4;const sim=new BattlefieldSimulation(state);sim.step(.05);
    expect(state.soldiers.every(s=>s.cover!=='trench')).toBe(true);
    t.depth=1.75;sim.step(.05);
    expect(state.soldiers.every(s=>s.cover===sim.terrain.coverAt(s.x,s.z))).toBe(true);
    expect(state.soldiers.every(s=>s.cover==='trench'&&s.x===-1810&&s.z===-1700)).toBe(true);
  });
  it('keeps all established work parties sheltered on both sides of a real middle-out job',()=>{
    const {state}=earthwork(),q=state.squads.find(q=>q.kind==='engineer')!;
    state.squads=[q];state.soldiers=state.soldiers.filter(s=>s.squadId===q.id);state.trenches=[];
    q.x=-1800;q.z=-1720;state.soldiers.forEach((s,i)=>{s.x=q.x+(i%4-1.5)*1.5;s.z=q.z+Math.floor(i/4)*1.5;});
    const sim=new BattlefieldSimulation(state);sim.createTrench([{x:-1880,z:-1700},{x:-1720,z:-1700}],q.id);
    for(let i=0;i<800;i++)sim.step(.05);
    expect(state.soldiers.filter(s=>s.action==='digging')).toHaveLength(8);
    expect(state.soldiers.every(s=>s.cover==='trench')).toBe(true);
  });
});
