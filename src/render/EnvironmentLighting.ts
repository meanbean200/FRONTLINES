import * as THREE from 'three';
import {VISUAL_QUALITY,type VisualQuality} from './VisualQuality';

export function environmentDaylight(hours:number):number{return Math.max(0,Math.sin((hours%24-6)/12*Math.PI));}

/** Presentation only. Campaign time is read, never advanced here. */
export class EnvironmentLighting {
  readonly sun=new THREE.DirectionalLight(0xffeed5,2.5);
  private readonly sky=new THREE.HemisphereLight(0xc4d4dc,0x554b3d,1);
  private readonly fog=new THREE.FogExp2(0xa7aea8,.00024);
  private readonly day=new THREE.Color(0xa7aea8);
  private readonly night=new THREE.Color(0x202c3c);
  private quality:VisualQuality='balanced';
  private lastShadow=-Infinity;
  private span=0;
  constructor(private scene:THREE.Scene,private renderer:THREE.WebGLRenderer){
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    scene.background=this.day.clone();scene.fog=this.fog;
    this.sun.castShadow=true;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=2200;
    this.sun.shadow.bias=-.00008;this.sun.shadow.normalBias=.025;
    scene.add(this.sky,this.sun,this.sun.target);this.setQuality('balanced');
  }
  setQuality(quality:VisualQuality):void{
    this.quality=quality;const settings=VISUAL_QUALITY[quality];
    const shadows=settings.shadowSize>0,changed=this.renderer.shadowMap.enabled!==shadows;
    this.renderer.shadowMap.enabled=shadows;this.sun.castShadow=shadows;this.releaseShadows();
    // Three caches lit programs. A disabled map must not leave its old sampler
    // bound in already-compiled terrain/foliage materials after a preset switch.
    if(changed)this.scene.traverse(object=>{
      if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])material.needsUpdate=true;
    });
    this.sun.shadow.mapSize.setScalar(settings.shadowSize||1024);this.lastShadow=-Infinity;
  }
  releaseShadows():void{this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
  update(hours:number,target:THREE.Vector3,distance:number,now:number):void{
    const daylight=environmentDaylight(hours),nightFill=1-Math.min(1,daylight*5);
    // Readable moon/sky fill, not a change to the simulation's night visibility.
    // Daylight above twilight is identical to the calibrated day presentation.
    this.sun.intensity=.2+daylight*2.7+nightFill*.18;this.sky.intensity=.38+daylight*.82+nightFill*.48;
    this.sun.color.setHex(daylight<.1?0x91a8c4:0xffeed5);
    (this.scene.background as THREE.Color).copy(this.night).lerp(this.day,Math.min(1,daylight*1.6));
    this.fog.color.copy(this.scene.background as THREE.Color);
    this.fog.density=.00023+(1-daylight)*.000035;
    // Texel-snapped, zoom-fitted shadow coverage keeps close boots/posts grounded
    // without making operational shadows consume a giant texture.
    const span=Math.max(32,Math.min(600,distance*.8)),size=VISUAL_QUALITY[this.quality].shadowSize||1024;
    if(Math.abs(span-this.span)>Math.max(2,this.span*.04)){
      this.span=span;Object.assign(this.sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span});this.sun.shadow.camera.updateProjectionMatrix();this.lastShadow=-Infinity;
    }
    const snap=this.span*2/size,x=Math.round(target.x/snap)*snap,z=Math.round(target.z/snap)*snap;
    this.sun.position.set(x-380,target.y+620,z+250);this.sun.target.position.set(x,target.y,z);
    if(now-this.lastShadow>VISUAL_QUALITY[this.quality].shadowInterval){this.renderer.shadowMap.needsUpdate=true;this.lastShadow=now;}
  }
}
