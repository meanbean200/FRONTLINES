import {afterEach,describe,expect,it,vi} from 'vitest';
import {StrategyCamera} from './StrategyCamera';
import type {TerrainSystem} from '../terrain/TerrainSystem';

function setup(){
  vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()});
  vi.stubGlobal('document',{documentElement:{dataset:{}}});
  const canvas={addEventListener:vi.fn(),removeEventListener:vi.fn(),getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture:vi.fn()} as unknown as HTMLCanvasElement;
  const camera=new StrategyCamera(canvas,{heightAt:()=>0} as unknown as TerrainSystem);
  camera.resize(1440,900);camera.update(.016);return camera;
}
afterEach(()=>vi.unstubAllGlobals());

describe('strategy camera overlay projection',()=>{
  it('responds to a held pan in the first frame and reverses without a long catch-up tail',()=>{
    const camera=setup(),handler=(name:string)=>vi.mocked(window.addEventListener).mock.calls.find(([n])=>n===name)![1] as (e:KeyboardEvent)=>void;
    const down=handler('keydown'),up=handler('keyup'),start=camera.target.clone();
    down({code:'KeyD',target:null} as KeyboardEvent);camera.update(1/60);
    const first=camera.target.distanceTo(start),intended=(12+camera.zoomDistance*.5)/60;
    expect(first/intended).toBeGreaterThan(.4);expect(first/intended).toBeLessThan(1);
    for(let i=0;i<30;i++)camera.update(1/60);
    up({code:'KeyD'} as KeyboardEvent);down({code:'KeyA',target:null} as KeyboardEvent);
    const turning=camera.target.clone();for(let i=0;i<3;i++)camera.update(1/60);
    expect(camera.target.x).toBeLessThan(turning.x);
    up({code:'KeyA'} as KeyboardEvent);for(let i=0;i<10;i++)camera.update(1/60);
    const stopped=camera.target.clone();for(let i=0;i<30;i++)camera.update(1/60);
    expect(camera.target.distanceTo(stopped)).toBeLessThan(.02);
  });
  it('cannot reverse damping or fly outside the world after a stale RAF timestamp on load',()=>{
    const camera=setup(),before=camera.target.clone(),zoom=camera.zoomDistance;
    camera.focus({x:600,z:500},300);
    for(const dt of [-.5,-10,NaN,Infinity]){camera.update(dt);expect(camera.target).toEqual(before);expect(camera.zoomDistance).toBe(zoom);}
    for(let i=0;i<60;i++)camera.update(.05);
    expect(camera.target.x).toBeCloseTo(600);expect(camera.target.z).toBeCloseTo(500);expect(camera.zoomDistance).toBeCloseTo(300);
  });
  it('bounds focus, held pan and both zoom extremes to the new world',()=>{
    const camera=setup(),down=vi.mocked(window.addEventListener).mock.calls.find(([name])=>name==='keydown')![1] as (event:KeyboardEvent)=>void;
    camera.focus({x:4500,z:-4500},9000);for(let i=0;i<240;i++)camera.update(1/60);
    expect(camera.target.x).toBeCloseTo(1980);expect(camera.target.z).toBeCloseTo(-1980);expect(camera.zoomDistance).toBeCloseTo(4600);expect(camera.camera.far).toBe(8800);
    down({code:'ShiftLeft',target:null} as KeyboardEvent);down({code:'KeyD',target:null} as KeyboardEvent);for(let i=0;i<240;i++)camera.update(1/60);
    expect(Math.abs(camera.target.x)).toBeLessThanOrEqual(1980);expect(Math.abs(camera.target.z)).toBeLessThanOrEqual(1980);
    camera.focus({x:0,z:0},1);for(let i=0;i<240;i++)camera.update(1/60);expect(camera.zoomDistance).toBeCloseTo(25);
  });
  it('updates aspect ratio and projection coordinates after repeated narrow/wide resizes',()=>{
    const camera=setup();
    for(const [width,height] of [[390,844],[1024,600],[1920,1080],[600,400]]){
      camera.resize(width,height);camera.update(.016);
      expect(camera.camera.aspect).toBe(width/height);
      const projected=camera.project({x:camera.target.x,z:camera.target.z});
      expect(projected.x).toBeCloseTo(width/2,6);expect(projected.y).toBeCloseTo(height/2,6);
    }
  });
  it('uses the current transform before rendering, including pan, rotation and zoom',()=>{
    const camera=setup();camera.focus({x:-800,z:-900},180);
    const down=vi.mocked(window.addEventListener).mock.calls.find(([name])=>name==='keydown')![1] as (event:KeyboardEvent)=>void;
    down({code:'KeyQ',target:null} as KeyboardEvent);camera.update(.1);
    const before=camera.project({x:-1100,z:-1150},3);
    camera.camera.updateMatrixWorld(true);
    expect(camera.project({x:-1100,z:-1150},3)).toEqual(before);
  });
  it('keeps every intermediate focus/zoom frame current at high refresh rates',()=>{
    const camera=setup();camera.focus({x:-800,z:-900},180);
    let changed=0,previous=camera.project({x:-1100,z:-1150},3);
    for(let i=0;i<100;i++){
      camera.update(1/144);const projected=camera.project({x:-1100,z:-1150},3);
      if(projected.x!==previous.x||projected.y!==previous.y)changed++;
      camera.camera.updateMatrixWorld(true);expect(camera.project({x:-1100,z:-1150},3)).toEqual(projected);
      previous=projected;
    }
    expect(changed).toBe(100);
  });
});
