import * as THREE from 'three';
import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {ImpactEffects} from './ImpactEffects';

describe('gameplay smoke readability',()=>{
  it.each([['low',18],['balanced',28],['high',40]] as const)('renders player-ordered smoke across its physical footprint at %s quality',(quality,count)=>{
    const state=createOperation('open-front'),terrain=new TerrainSystem(state),effects=new ImpactEffects(),radius=18;
    state.elapsed=5;state.operation!.smokeFields=[{id:999,x:0,z:0,radius,born:0,until:65,side:'player',source:'PLAYER'}];
    for(const p of state.soldiers.filter(p=>state.squads.find(q=>q.id===p.squadId)?.faction!=='enemy')){p.x=-1100;p.z=-1100;}
    effects.setQuality(quality);effects.update(state,terrain);expect(effects.particles.count).toBe(count);
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),distances:number[]=[],widths:number[]=[];
    for(let i=0;i<effects.particles.mesh.count;i++){effects.particles.mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);matrix.decompose(position,rotation,scale);distances.push(Math.hypot(position.x,position.z));widths.push(scale.x);}
    expect(Math.max(...distances)).toBeGreaterThan(radius*.65);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(radius*.51);
  });
  it('does not reveal an unobserved enemy smoke launch',()=>{
    const state=createOperation('open-front'),terrain=new TerrainSystem(state),effects=new ImpactEffects();state.elapsed=5;
    state.operation!.smokeFields=[{id:999,x:1100,z:1100,radius:18,born:0,until:65,side:'enemy',source:'ENEMY_AI'}];effects.update(state,terrain);expect(effects.particles.count).toBe(0);
  });
});
