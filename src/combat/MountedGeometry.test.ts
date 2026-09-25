import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {preparedPosition} from './testing/PositionFixture';
import {mountedGeometry} from './MountedGeometry';
import {muzzlePoint,resolveShot} from './Ballistics';
describe('fixed mounted gun geometry',()=>{
  it('keeps receiver ahead of the torso and uses exactly the same muzzle for shots and presentation',()=>{
    const sim=createStudyScenario(),s=sim.state,q=s.squads[0],p=s.soldiers.find(p=>p.squadId===q.id)!;p.equipment!.weapon='crew-mg';
    const f=preparedPosition(s,q.id,'emplacement');
    for(const facing of [0,Math.PI/2,Math.PI,-Math.PI/2]){
      f.facing=facing;p.heading=facing;const frame=mountedGeometry(s,sim.terrain,f);p.x=frame.operator.x;p.z=frame.operator.z;
      expect(Math.hypot(frame.pivot.x-p.x,frame.pivot.z-p.z)-.45/2).toBeGreaterThan(.23);
      expect(muzzlePoint(sim.terrain,p,s)).toEqual(frame.muzzle);
      expect(resolveShot(s,sim.terrain,p,{x:p.x+Math.sin(facing)*50,y:frame.muzzle.y,z:p.z+Math.cos(facing)*50},[],0).from).toEqual(frame.muzzle);
      const old=structuredClone(frame);f.weaponCrewIds=[];expect(mountedGeometry(s,sim.terrain,f)).toEqual(old);f.weaponCrewIds=[p.id];
    }
  });
});
