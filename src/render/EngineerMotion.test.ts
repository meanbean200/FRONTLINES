import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {UnitRenderer} from './UnitRenderer';
import {createBattlefield} from '../simulation/createBattlefield';
import type {TerrainSystem} from '../terrain/TerrainSystem';

describe('engineer approach animation',()=>{
  it('keeps feet on the sampled floor throughout smoothed horizontal movement and excavation',()=>{
    const state=createBattlefield(),q=state.squads.find(q=>q.kind==='engineer')!,s=state.soldiers.find(s=>s.squadId===q.id)!;
    state.squads=[q];state.soldiers=[s];s.x=0;s.z=0;s.heading=0;
    let depth=-1.75;
    const heightAt=(x:number)=>x<.5?0:depth;
    const renderer=new UnitRenderer(state,{heightAt} as unknown as TerrainSystem),matrix=new THREE.Matrix4();
    renderer.update(new Set());s.x=1;
    for(let i=0;i<5;i++){
      renderer.update(new Set(),1/60);(renderer.group.children[1] as THREE.InstancedMesh).getMatrixAt(0,matrix);
      expect(matrix.elements[13]).toBeCloseTo(heightAt(matrix.elements[12]),6);
    }
    depth=-2;renderer.update(new Set(),1/60);(renderer.group.children[1] as THREE.InstancedMesh).getMatrixAt(0,matrix);
    expect(matrix.elements[13]).toBe(-2);
  });
  it('shows outside selection rings by actual cover rather than a garrison reservation',()=>{
    const state=createBattlefield(),q=state.squads.find(q=>q.kind==='engineer')!,s=state.soldiers.find(s=>s.squadId===q.id)!;
    state.squads=[q];state.soldiers=[s];s.cover='trench';delete s.trenchId;
    s.needs={energy:100,hunger:0,thirst:0,life:'active',hungryHours:0,thirstyHours:0,sleepHours:0,day:0,watchHours:0,interruptedSleep:0,taskChanges:0};
    const renderer=new UnitRenderer(state,{heightAt:()=>-1.75} as unknown as TerrainSystem);
    renderer.update(new Set([q.id]));expect((renderer.group.children[4] as THREE.InstancedMesh).count).toBe(0);
    s.cover='open';s.trenchId=99;renderer.update(new Set([q.id]));expect((renderer.group.children[4] as THREE.InstancedMesh).count).toBe(1);
  });
  it('animates steps for both new working-face travel states',()=>{
    const state=createBattlefield(),q=state.squads.find(q=>q.kind==='engineer')!,s=state.soldiers.find(s=>s.squadId===q.id)!;
    state.squads=[q];state.soldiers=[s];state.elapsed=1;s.x=0;s.z=0;s.heading=0;
    const renderer=new UnitRenderer(state,{heightAt:()=>0} as unknown as TerrainSystem),matrix=new THREE.Matrix4();
    for(const action of ['moving to work front','moving along work front']){
      s.action=action;renderer.update(new Set(),1/60);
      (renderer.group.children[3] as THREE.InstancedMesh).getMatrixAt(0,matrix);
      expect(matrix.elements[14]).toBeCloseTo(Math.sin(8)*.2,6);
    }
    s.action='digging';renderer.update(new Set(),1/60);
    (renderer.group.children[3] as THREE.InstancedMesh).getMatrixAt(0,matrix);expect(matrix.elements[14]).toBe(0);
  });
});
