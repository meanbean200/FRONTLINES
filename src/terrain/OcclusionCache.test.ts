import {describe,it,expect} from 'vitest';
import {createBattlefield} from '../simulation/createBattlefield';
import {TerrainSystem} from './TerrainSystem';

describe('exact terrain-cache invalidation',()=>{
  it('matches fresh production traces through construction, cratering, removal and building damage',()=>{
    const state=createBattlefield();state.trenches=[];state.craters=[];
    const copy=structuredClone(state),cached=new TerrainSystem(state),fresh=new TerrainSystem(copy);
    const rays=Array.from({length:40},(_,i)=>({from:{x:-80+i*7,z:-95+i%4*9},to:{x:70-i*3,z:100-i%7*11}}));
    for(let phase=0;phase<8;phase++){
      const trench={id:9000,points:[{x:-100,z:20},{x:150,z:20}],width:7.2,depth:1.75,progress:Math.min(1,(phase+1)/4),status:'building' as const};
      state.trenches=phase===6?[]:[trench];
      if(phase===4)state.craters.push({id:9001,x:0,z:25,radius:12,depth:3});
      if(phase===7)state.buildingChanges=[{id:0,condition:'ruined',damage:100}];
      copy.trenches=structuredClone(state.trenches);copy.craters=structuredClone(state.craters);copy.buildingChanges=structuredClone(state.buildingChanges);
      cached.syncModifications();fresh.syncModifications();fresh.objects.reset();
      for(const {from,to}of rays)for(const foliage of [false,true]){
        const fromY=cached.heightAt(from.x,from.z)+1.4,toY=cached.heightAt(to.x,to.z)+1.4;
        expect(cached.objects.trace(from,to,fromY,toY,foliage,!foliage)).toEqual(fresh.objects.trace(from,to,fromY,toY,foliage,!foliage));
      }
    }
  });
});
