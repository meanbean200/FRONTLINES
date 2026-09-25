import type {WebGLRenderer,PerspectiveCamera} from 'three';

/** Opt-in read-only developer diagnostic; never a normal gameplay overlay. */
export function readViewportDiagnostic(host:HTMLElement,canvas:HTMLCanvasElement,renderer:WebGLRenderer,camera:PerspectiveCamera){
    const bounds=(element:Element|null)=>{const r=element?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;};
    return {
      inner:{width:innerWidth,height:innerHeight},outer:{width:outerWidth,height:outerHeight},
      visual:visualViewport?{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale,offsetLeft:visualViewport.offsetLeft,offsetTop:visualViewport.offsetTop}:null,
      document:bounds(document.documentElement),body:bounds(document.body),app:bounds(host),canvas:bounds(canvas),ui:bounds(document.querySelector('#ui-root')),
      menu:bounds(document.querySelector('.operation-menu[open]')),overlay:bounds(document.querySelector('.tactical-overlay')),
      backing:{width:canvas.width,height:canvas.height},devicePixelRatio,rendererPixelRatio:renderer.getPixelRatio(),cameraAspect:camera.aspect,
      fullscreen:{active:Boolean(document.fullscreenElement),element:document.fullscreenElement?.id??null},iframe:window.self!==window.top,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    };
}
export function installViewportDiagnostic(host:HTMLElement,canvas:HTMLCanvasElement,renderer:WebGLRenderer,camera:PerspectiveCamera):void{
  if(!import.meta.env.DEV&&new URLSearchParams(location.search).get('viewportDebug')!=='1')return;
  window.__FRONTLINES_VIEWPORT__=()=>readViewportDiagnostic(host,canvas,renderer,camera);
}
