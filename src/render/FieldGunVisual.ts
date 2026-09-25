import * as THREE from 'three';
import {ModelGeometry} from './ModelGeometry';

/** Original 1940s-inspired silhouette, metres; +Z is fire, origin is axle midpoint.
 * One vertex-colour material / instanced draw. No external asset dependencies. */
export function fieldGunGeometry(part:'carriage'|'upper'|'all'='all'):THREE.BufferGeometry {
  const b=new ModelGeometry(),olive=0x656c50,edge=0x858a6a,steel=0x343b33,rubber=0x292f29;
  if(part!=='upper'){
  b.box(2.6,.20,.25,steel,0,.73,0);
  for(const side of [-1,1]){
    b.add(new THREE.CylinderGeometry(.69,.69,.25,16),rubber,side*1.3,.71,0,0,0,Math.PI/2);
    b.add(new THREE.CylinderGeometry(.42,.42,.28,12),olive,side*1.3,.71,0,0,0,Math.PI/2);
    b.add(new THREE.CylinderGeometry(.14,.14,.34,10),edge,side*1.3,.71,0,0,0,Math.PI/2);
    b.box(.25,.24,3.6,olive,side*.73,.33,-1.63,-.08,-side*.36);
    b.box(.65,.30,.38,steel,side*1.34,.15,-3.16);
    b.box(.67,1.30,.10,olive,side*.76,1.45,.26,-.08);
    b.box(.24,.54,.12,edge,side*1.02,1.58,.30,-.08);
  }
  b.box(.84,.38,1.25,olive,0,1.10,.14);
  }
  if(part!=='carriage'){
  b.box(.62,.42,.65,steel,0,1.37,-.46);
  b.box(.72,.14,.21,edge,0,1.34,-.85);
  const elevation=.20,angle=Math.PI/2-elevation;
  b.rod(.17,3.55,olive,0,1.75,1.41,angle);
  b.rod(.20,.36,steel,0,2.05,3.05,angle);
  b.rod(.145,.025,0x141b18,0,2.09,3.23,angle);
  b.rod(.075,2.9,steel,.28,1.65,1.11,angle);
  b.add(new THREE.TorusGeometry(.22,.03,5,12),edge,.66,1.15,-.45,0,Math.PI/2);
  b.box(.11,.42,.11,steel,-.55,1.54,-.40);b.box(.29,.09,.12,edge,-.57,1.77,-.40);
  }
  return b.finish();
}
