export interface ViewportSize {width:number;height:number;ratio:number}
/** CSS pixels are authoritative. DPR only changes the drawing buffer. */
export function viewportSize(width:number,height:number,dpr:number,limit:number):ViewportSize|undefined {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
  return {width,height,ratio:Math.min(Number.isFinite(dpr)&&dpr>0?dpr:1,limit)};
}

/** Observe the host, never the canvas's backing buffer (no resize feedback). */
export class HostViewport {
  private frame=0;
  private readonly observer:ResizeObserver;
  private resolution?:MediaQueryList;
  private previous='';
  private lastDpr=window.devicePixelRatio;
  constructor(private readonly host:HTMLElement,private readonly limit:()=>number,private readonly apply:(size:ViewportSize)=>void){
    this.observer=new ResizeObserver(this.schedule);this.observer.observe(host);
    window.addEventListener('resize',this.schedule);
    window.visualViewport?.addEventListener('resize',this.schedule);
    window.addEventListener('pageshow',this.schedule);
    document.addEventListener('fullscreenchange',this.schedule);
    document.addEventListener('visibilitychange',this.schedule);
    this.watchResolution();this.sync();
  }
  readonly sync=():void=>{
    this.lastDpr=window.devicePixelRatio;
    const rect=this.host.getBoundingClientRect(),size=viewportSize(rect.width,rect.height,window.devicePixelRatio,this.limit());
    // Hidden/collapsed embeds keep their last good projection until revealed.
    if(!size)return;
    const key=[rect.left,rect.top,size.width,size.height,size.ratio].join(':');
    if(key===this.previous)return;this.previous=key;
    const root=document.documentElement;
    for(const [name,value] of Object.entries({left:rect.left,top:rect.top,width:size.width,height:size.height}))root.style.setProperty(`--game-${name}`,`${value}px`);
    this.apply(size);
  };
  /** Chromium may omit resize/media-query events on DPR-only changes. This
   * check does no layout work on ordinary frames. */
  checkPixelRatio():void{if(window.devicePixelRatio!==this.lastDpr)this.sync();}
  private readonly schedule=():void=>{if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.sync();});};
  private readonly resolutionChanged=():void=>{this.watchResolution();this.schedule();};
  private watchResolution():void{
    this.resolution?.removeEventListener('change',this.resolutionChanged);
    this.resolution=window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.resolution.addEventListener('change',this.resolutionChanged);
  }
  dispose():void{
    cancelAnimationFrame(this.frame);this.observer.disconnect();this.resolution?.removeEventListener('change',this.resolutionChanged);
    window.removeEventListener('resize',this.schedule);window.visualViewport?.removeEventListener('resize',this.schedule);
    window.removeEventListener('pageshow',this.schedule);document.removeEventListener('fullscreenchange',this.schedule);document.removeEventListener('visibilitychange',this.schedule);
  }
}
