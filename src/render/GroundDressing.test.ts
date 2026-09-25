import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {dressingSites,GroundDressing} from './GroundDressing';
import {createGroundGeometry} from './GroundGeometry';

describe('bounded cosmetic ground dressing',()=>{
  it('is deterministic, excludes real excavation, and cannot create cover or change state',()=>{
    const sim=createStudyScenario(),t=sim.state.trenches[0],p=t.points[0],tx=Math.floor(p.x/32),tz=Math.floor(p.z/32),before=JSON.stringify(sim.state);
    const sites=dressingSites(sim.terrain,tx,tz);expect(sites).toEqual(dressingSites(sim.terrain,tx,tz));expect(sites.length).toBeLessThanOrEqual(256);
    for(const s of sites){expect(Math.abs(sim.terrain.deformationAt(s.x,s.z))).toBeLessThanOrEqual(.025);expect([s.x,s.y,s.z,s.scale].every(Number.isFinite)).toBe(true);}
    const dressing=new GroundDressing(sim.terrain);dressing.setQuality('high');for(let n=0;n<120;n++)dressing.update(p.x,p.z,55,n*40);
    expect(dressing.group.children.length).toBeGreaterThan(10);expect(dressing.group.children.length).toBeLessThan(100);
    dressing.setQuality('low');dressing.update(p.x,p.z,55,6000);expect(dressing.group.visible).toBe(false);
    dressing.reset();expect(dressing.group.children).toHaveLength(0);expect(JSON.stringify(sim.state)).toBe(before);
  });
  it('transfers bounded yard wear with worker ground data, retaining physical vertex heights',()=>{
    const sim=createStudyScenario(),b=sim.terrain.buildings[0],x=Math.floor(b.x/500)*500,z=Math.floor(b.z/500)*500;
    const mesh=createGroundGeometry(sim.terrain,x,z,32),cover=mesh.attributes.groundCover;
    expect(cover.itemSize).toBe(3);expect(cover.count).toBe(mesh.attributes.position.count);
    const wear=Array.from({length:cover.count},(_,i)=>cover.getZ(i));expect(wear.every(n=>n>=0&&n<=1)).toBe(true);expect(Math.max(...wear)).toBeGreaterThan(.5);
  });
});
