import {afterEach,describe,it,expect,vi} from 'vitest';
import {viewportSize,HostViewport} from './HostViewport';
afterEach(()=>vi.unstubAllGlobals());
describe('host viewport authority',()=>{
  for(const dpr of [1,1.25,1.5,2])it(`keeps CSS dimensions unchanged at DPR ${dpr}`,()=>{
    expect(viewportSize(907,510,dpr,1.65)).toEqual({width:907,height:510,ratio:Math.min(dpr,1.65)});
  });
  it('retains subpixel host geometry instead of using monitor dimensions',()=>expect(viewportSize(931.5,517.25,2,1.25)).toEqual({width:931.5,height:517.25,ratio:1.25}));
  it('does not replace a collapsed host with a bogus 1 by 1 projection',()=>{
    for(const [w,h] of [[0,400],[500,0],[-1,400],[NaN,400],[500,Infinity]])expect(viewportSize(w,h,1,1.25)).toBeUndefined();
  });
  it('observes the host, coalesces events, responds to DPR and ignores unchanged layout',()=>{
    const schedule:Record<string,()=>void>={},observe=vi.fn(),disconnect=vi.fn(),apply=vi.fn();let frame:(()=>void)|undefined;
    const events={addEventListener:(name:string,fn:()=>void)=>{schedule[name]=fn;},removeEventListener:vi.fn()};
    const win={...events,devicePixelRatio:1,visualViewport:events,matchMedia:()=>events};
    vi.stubGlobal('window',win);vi.stubGlobal('document',{...events,documentElement:{style:{setProperty:vi.fn()}}});
    vi.stubGlobal('requestAnimationFrame',(fn:()=>void)=>{frame=fn;return 1;});vi.stubGlobal('cancelAnimationFrame',vi.fn());
    vi.stubGlobal('ResizeObserver',class {constructor(fn:()=>void){schedule.observed=fn;}observe=observe;disconnect=disconnect;});
    let box={left:0,top:0,width:907,height:510};const host={getBoundingClientRect:()=>box} as HTMLElement;
    const viewport=new HostViewport(host,()=>1.25,apply);
    expect(observe).toHaveBeenCalledWith(host);expect(apply).toHaveBeenCalledExactlyOnceWith({width:907,height:510,ratio:1});
    schedule.resize();schedule.observed();frame!();expect(apply).toHaveBeenCalledTimes(1);
    win.devicePixelRatio=2;schedule.change();frame!();expect(apply).toHaveBeenLastCalledWith({width:907,height:510,ratio:1.25});
    win.devicePixelRatio=1;viewport.checkPixelRatio();expect(apply).toHaveBeenLastCalledWith({width:907,height:510,ratio:1});
    viewport.checkPixelRatio();expect(apply).toHaveBeenCalledTimes(3);
    win.devicePixelRatio=2;viewport.checkPixelRatio();expect(apply).toHaveBeenCalledTimes(4);
    box={left:0,top:0,width:0,height:0};schedule.observed();frame!();expect(apply).toHaveBeenCalledTimes(4);
    box={left:0,top:0,width:1216,height:684};schedule.observed();frame!();expect(apply).toHaveBeenLastCalledWith({width:1216,height:684,ratio:1.25});
    viewport.dispose();expect(disconnect).toHaveBeenCalledOnce();
  });
});
