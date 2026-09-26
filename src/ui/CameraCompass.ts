import type {StrategyCamera} from '../render/StrategyCamera';

/** World north is -Z, east +X. Read the interpolated camera, not input intent. */
export class CameraCompass {
  readonly element=document.createElement('div');
  private dial:HTMLElement;private readout:HTMLElement;
  constructor(private camera:StrategyCamera){
    this.element.className='camera-compass';this.element.setAttribute('aria-label','Camera compass');
    this.element.innerHTML='<div class="compass-dial"><b class="north">N</b><span class="east">E</span><span class="south">S</span><span class="west">W</span><i></i></div><output></output>';
    this.dial=this.element.querySelector('.compass-dial')!;this.readout=this.element.querySelector('output')!;
    // Share the HUD stacking context so management/review sheets occlude it.
    document.querySelector('#ui-root')!.append(this.element);
  }
  update():void{
    const camera=this.camera.camera.position,target=this.camera.target;
    const angle=Math.atan2(camera.x-target.x,camera.z-target.z),bearing=((Math.round(-angle*180/Math.PI)%360)+360)%360;
    this.dial.style.transform=`rotate(${angle}rad)`;const text=String(bearing).padStart(3,'0')+'°';if(this.readout.textContent!==text)this.readout.textContent=text;
    this.element.title=`Camera faces ${text} · north is -Z; east is +X`;
  }
}
