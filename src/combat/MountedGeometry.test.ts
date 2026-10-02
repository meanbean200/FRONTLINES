import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {preparedPosition} from './testing/PositionFixture';
import {mountedGeometry} from './MountedGeometry';
import {muzzlePoint,resolveShot} from './Ballistics';
describe('fixed mounted gun geometry',()=>{
  it('uses the active replacement operator aim when the first listed gunner is incapacitated',()=>{
    const sim=createStudyScenario(),state=sim.state,q=state.squads[0],first=state.soldiers.find(p=>p.squadId===q.id)!;
    first.equipment!.weapon='crew-mg';const f=preparedPosition(state,q.id,'emplacement'),replacement=state.soldiers.find(p=>p.id!==first.id)!;
    f.weaponCrewIds=[first.id,replacement.id];first.needs!.life='incapacitated';
    const frame=mountedGeometry(state,sim.terrain,f);Object.assign(replacement,frame.operator,{heading:f.facing??0});
    const aim={x:frame.pivot.x,y:frame.pivot.y+8,z:frame.pivot.z+70};
    first.combat={shotSequence:0,aim:{point:{...aim,y:frame.pivot.y-8},since:0,lastSeen:0,lastHeading:0,lastPosition:{x:first.x,z:first.z},settlingUntil:0}};
    replacement.combat={shotSequence:0,aim:{point:aim,since:0,lastSeen:0,lastHeading:0,lastPosition:{x:replacement.x,z:replacement.z},settlingUntil:0}};
    expect(mountedGeometry(state,sim.terrain,f,replacement.heading).muzzle).toEqual(resolveShot(state,sim.terrain,replacement,aim,[],0).from);
  });
  it('pitches the physical barrel and authoritative shot from the same intended uphill or downhill solution',()=>{
    const sim=createStudyScenario(),state=sim.state,q=state.squads[0],p=state.soldiers.find(p=>p.squadId===q.id)!;
    p.equipment!.weapon='crew-mg';const f=preparedPosition(state,q.id,'emplacement');p.heading=f.facing=0;
    Object.assign(p,mountedGeometry(state,sim.terrain,f).operator);
    for(const rise of [-6,6]){
      const pivot=mountedGeometry(state,sim.terrain,f).pivot,aim={x:pivot.x,y:pivot.y+rise,z:pivot.z+70};
      p.combat={shotSequence:0,aim:{point:aim,since:0,lastSeen:0,lastHeading:0,lastPosition:{x:p.x,z:p.z},settlingUntil:0}};
      const frame=mountedGeometry(state,sim.terrain,f),shot=resolveShot(state,sim.terrain,p,aim,[],0);
      expect(Math.sign(frame.pitch)).toBe(Math.sign(rise));expect(shot.from).toEqual(frame.muzzle);
      expect(Math.atan2(frame.muzzle.y-frame.pivot.y,frame.muzzle.z-frame.pivot.z)).toBeCloseTo(frame.pitch,9);
      expect(shot.aim).toEqual(aim);
    }
  });
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
