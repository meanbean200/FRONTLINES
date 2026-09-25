import {describe,it,expect,vi} from 'vitest';
import {TacticalOverlay} from './TacticalOverlay';

function fixture(){
  const marker={style:{display:'',transform:''}};
  const squad={id:1,x:10,z:20,faction:'player',soldierIds:[2]};
  const projected={x:300,y:250,visible:true};
  // Exercise the actual update/projection methods without a WebGL/DOM environment.
  const view=Object.assign(Object.create(TacticalOverlay.prototype),{
    markerTimer:1/30,mapTimer:-1000,networkTimer:0,
    layer:{classList:{toggle:vi.fn()},inert:false},
    getState:()=>({squads:[squad],trenches:[]}),
    markers:new Map([[1,marker]]),trenchMarkers:new Map(),objectiveMarkers:new Map(),labels:[],
    camera:{project:vi.fn(()=>({...projected})),zoomDistance:490},updateMarkers:vi.fn(),
  });
  return {view,marker,projected};
}

describe('continuous world labels',()=>{
  it('projects on every frame even when content refresh is throttled',()=>{
    const {view,marker,projected}=fixture();
    for(let i=0;i<12;i++){
      projected.x+=3;projected.y-=2;view.update(1/144);
      expect(marker.style.transform).toBe(`translate(${projected.x}px,${projected.y-18}px) translate(-50%,-100%)`);
      expect(marker.style.display).toBe('');
    }
    expect(view.camera.project).toHaveBeenCalledTimes(12);
    expect(view.updateMarkers.mock.calls.length).toBeLessThan(4);
    expect(view.layer.classList.toggle).not.toHaveBeenCalled();expect(view.layer.inert).toBe(false);
  });
  it('creates initial content before projecting the very first frame',()=>{
    const {view,marker}=fixture();view.markers.clear();
    view.updateMarkers.mockImplementation(()=>view.markers.set(1,marker));
    view.update(1/240);
    expect(view.updateMarkers).toHaveBeenCalledOnce();
    expect(marker.style.transform).toBe('translate(300px,232px) translate(-50%,-100%)');
  });
  it('only hides a marker when its projected anchor leaves the view, with no return delay',()=>{
    const {view,marker,projected}=fixture();projected.visible=false;view.update(1/144);
    expect(marker.style.display).toBe('none');
    projected.visible=true;view.update(1/144);expect(marker.style.display).toBe('');
    expect(view.layer.inert).toBe(false);
  });
});
