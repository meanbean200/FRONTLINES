import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {bankPoint} from '../garrison/DefensivePositions';
import {weaponCrewPoint,inlineGeometry} from '../construction/PositionDefinitions';
import {inventory,type Facility} from '../garrison/types';
import {clearAimPoint,muzzlePoint,resolveShot} from './Ballistics';

/** Controlled production geometry, not a reproduction of the player's missing save. */
function fixture(slope:number,trench=false,mounted=false,opposed=false,crater=false){
  const state=createOperation('advance'),sim=new BattlefieldSimulation(state),terrain=sim.terrain;
  const shooter=state.soldiers[0],target=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
  terrain.buildings=[];vi.spyOn(terrain,'baseHeightAt').mockImplementation((_x,z)=>z*slope);
  vi.spyOn(terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(terrain.objects,'trees').mockReturnValue([]);
  state.trenches=[];state.craters=[];
  Object.assign(shooter,{x:0,z:0,heading:0,posture:'standing',action:'holding',suppression:0,morale:100,combat:{shotSequence:0}});delete shooter.duty;
  Object.assign(target,{x:0,z:70,heading:Math.PI,posture:'standing',action:'holding',suppression:0});delete target.duty;
  if(trench){
    const t={id:9001,points:[{x:-40,z:0},{x:40,z:0}],width:7.2,depth:1.75,progress:1,status:'complete' as const};state.trenches.push(t);
    sim.garrisons.network.sync(state.trenches);Object.assign(shooter,bankPoint(sim.garrisons.network,shooter,0));
    if(mounted){
      const f:Facility={id:9002,garrisonId:0,kind:'emplacement',...inlineGeometry(t,40,0).position,connectorId:t.id,trenchAnchor:{trenchId:t.id,along:40},facing:0,progress:1,paid:true,stock:inventory({ammo:120}),capacity:2,materialCost:16,installation:{kind:'crew-mg',source:'construction'},weaponCrewIds:[shooter.id]};
      state.living!.facilities.push(f);Object.assign(shooter,weaponCrewPoint(state,f,0));
    }
  }
  if(opposed){state.trenches.push({id:9003,points:[{x:-40,z:70},{x:40,z:70}],width:7.2,depth:1.75,progress:1,status:'complete'});sim.garrisons.network.sync(state.trenches);Object.assign(target,bankPoint(sim.garrisons.network,target,Math.PI));}
  if(crater)state.craters.push({id:9010,x:4,z:28,radius:6,depth:2});
  terrain.syncModifications();return {state,terrain,shooter,target};
}

describe('direct-fire terrain evidence matrix',()=>{
  it.each([
    ['level',0,false,false,false,false],['mild-uphill',.08,false,false,false,false],
    ['steep-uphill',.22,false,false,false,false],['mild-downhill',-.08,false,false,false,false],['steep-downhill',-.22,false,false,false,false],
    ['trench-open-uphill',.08,true,false,false,false],['trench-opposing-trench',.06,true,false,true,false],
    ['mounted-level',0,true,true,false,false],['mounted-uphill',.08,true,true,false,false],['mounted-steep-uphill',.22,true,true,false,false],['mounted-downhill',-.08,true,true,false,false],['mounted-steep-downhill',-.22,true,true,false,false],
    ['mounted-opposing-trench',.06,true,true,true,false],['mounted-cratered',.06,true,true,false,true],
    ['cratered',.06,true,false,false,true],
  ] as const)('%s uses a clear real muzzle/body solution without systematic immediate ground hits',(name,slope,trench,mounted,opposed,crater)=>{
    const {state,terrain,shooter,target}=fixture(slope,trench,mounted,opposed,crater),aim=clearAimPoint(terrain,shooter,target,state);
    expect(aim).toBeDefined();const from=muzzlePoint(terrain,shooter,state,aim);
    expect(from.y-terrain.heightAt(from.x,from.z)).toBeGreaterThan(0);
    expect(resolveShot(state,terrain,shooter,aim!,[target],0).hitId).toBe(target.id);
    let terrainHits=0,immediate=0,hits=0;const failures=[],examples=[];
    for(let i=0;i<1000;i++){
      const shot=resolveShot(state,terrain,shooter,aim!,[target],mounted?1.14:1);
      if(examples.length<3)examples.push({geometryMuzzle:from,authoritativeFrom:shot.from,intended:shot.aim,resolvedEnd:shot.projectedEnd,firstImpact:shot.to,obstruction:shot.obstruction??'none'});
      expect(shot.from).toEqual(from);
      if(shot.hitId!==undefined)hits++;
      if(shot.obstruction==='terrain'){terrainHits++;if(Math.hypot(shot.to.x-shot.from.x,shot.to.z-shot.from.z)<8){immediate++;if(failures.length<4)failures.push({from:shot.from,intended:aim,end:shot.to,firstObstruction:shot.obstruction});}}
    }
    console.info('DIRECT_FIRE_TERRAIN',JSON.stringify({name,muzzle:from,aim,shots:1000,hits,terrainHits,immediate,examples,failures}));
    expect(immediate).toBeLessThanOrEqual(20);
  });
  it('rejects a muzzle starting inside nearby earth, including a ray shorter than one trace step',()=>{
    const {terrain}=fixture(0);vi.spyOn(terrain,'heightAt').mockImplementation((_x,z)=>z<.12?1:0);terrain.revision++;
    const from={x:0,z:0},end={x:0,z:.3};
    expect(terrain.objects.trace(from,end,.8,.8,false,true).clear).toBe(false);
    expect(terrain.objects.trace(from,{x:0,z:20},.8,1.5,false,true).clear).toBe(false);
  });
});
