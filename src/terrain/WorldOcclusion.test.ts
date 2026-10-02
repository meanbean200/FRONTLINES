import {describe,it,expect,vi} from 'vitest';
import {createBattlefield} from '../simulation/createBattlefield';
import {TerrainSystem} from './TerrainSystem';
import {treeCleared} from './WorldFeatures';
function fixture(){const t=new TerrainSystem(createBattlefield());t.buildings=[];vi.spyOn(t,'baseHeightAt').mockReturnValue(0);vi.spyOn(t,'heightAt').mockReturnValue(0);vi.spyOn(t,'deformationAt').mockReturnValue(0);vi.spyOn(t,'groundTypeAt').mockReturnValue('field');vi.spyOn(t.objects,'trees').mockReturnValue([]);return t;}
describe('shared world occlusion',()=>{
  it('rechecks exact rays after excavation and removals',()=>{
    const state=createBattlefield();state.trenches=[];state.craters=[];const t=new TerrainSystem(state);t.buildings=[];
    vi.spyOn(t,'baseHeightAt').mockReturnValue(0);vi.spyOn(t,'groundTypeAt').mockReturnValue('field');vi.spyOn(t.objects,'trees').mockReturnValue([]);
    const a={x:0,z:0},b={x:20,z:0},ray=()=>t.objects.trace(a,b,.3,.3,false,true);
    expect(ray().clear).toBe(true);const traces=t.objects.counts.traces;
    state.trenches.push({id:9001,points:[{x:600,z:600},{x:630,z:600}],width:4.2,depth:1.75,progress:1,status:'complete'});t.syncModifications();
    expect(ray().clear).toBe(true);expect(t.objects.counts.traces).toBe(traces+1);
    state.trenches.push({id:9002,points:[{x:10,z:-10},{x:10,z:10}],width:4.2,depth:1.75,progress:1,status:'complete'});t.syncModifications();
    expect(ray().blockedBy).toBe('terrain');expect(t.objects.counts.traces).toBe(traces+2);
    state.trenches.pop();t.syncModifications();expect(ray().clear).toBe(true);expect(t.objects.counts.traces).toBe(traces+3);
  });
  it('solid walls block close sight and fire, but finite roofs can be seen over',()=>{const t=fixture();t.buildings=[{x:10,z:0,width:2,depth:10,height:5,angle:0}];expect(t.objects.trace({x:8,z:2},{x:12,z:2},1.6,1.6).blockedBy).toBe('building');expect(t.objects.trace({x:8,z:2},{x:12,z:2},12,12).clear).toBe(true);});
  it('a trunk stops a bullet while foliage conceals without becoming armor',()=>{const t=fixture(),tree={x:25,z:2,size:4,index:0};vi.mocked(t.objects.trees).mockImplementation((x,z)=>x===0&&z===0?[tree]:[]);expect(t.objects.trace({x:10,z:2},{x:40,z:2},1.6,1.6,false).blockedBy).toBe('trunk');const sight=t.objects.trace({x:10,z:4},{x:40,z:4},5,5);expect(sight.clear).toBe(true);expect(sight.transmission).toBeLessThan(.9);expect(t.objects.trace({x:10,z:4},{x:40,z:4},5,5,false).transmission).toBe(1);});
  it('excavation removes exactly the tree whose rendered clearance footprint was cut',()=>{const t=fixture(),tree={x:25,z:2,size:4,index:0};vi.mocked(t.objects.trees).mockImplementation((x,z)=>x===0&&z===0?[tree]:[]);expect(t.objects.trace({x:10,z:2},{x:40,z:2},1.6,1.6,false).clear).toBe(false);vi.mocked(t.deformationAt).mockImplementation(x=>x===28?-1:0);t.revision++;expect(treeCleared(t,tree)).toBe(true);expect(t.objects.trace({x:10,z:2},{x:40,z:2},1.6,1.6,false).clear).toBe(true);});
  it('a real ridge blocks fire without a range cutoff or a forest armor modifier',()=>{const t=fixture();vi.mocked(t.heightAt).mockImplementation(x=>x>40&&x<60?6:0);expect(t.objects.trace({x:0,z:0},{x:120,z:0},1.6,1.6,false).blockedBy).toBe('terrain');vi.mocked(t.heightAt).mockReturnValue(0);t.revision++;expect(t.objects.trace({x:0,z:0},{x:600,z:0},1.6,1.6,false).clear).toBe(true);});
});
