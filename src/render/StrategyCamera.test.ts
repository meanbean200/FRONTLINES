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
