import * as THREE from 'three';
import {ModelGeometry} from './ModelGeometry';

/** Crew-served silhouette at metre scale: plate, elevated barrel, bipod,
 * traversing screw and sight. Mounted only while real equipment is present. */
export function mortarGeometry():THREE.BufferGeometry{
  const b=new ModelGeometry(),steel=0x666c5c,dark=0x363e36,edge=0x898d77,angle=.43;
  b.add(new THREE.CylinderGeometry(.43,.48,.11,10),steel,0,.075,0);
  for(const x of [-.22,.22])b.box(.045,.07,.66,dark,x,.15,0);
  b.rod(.081,1.32,steel,0,.72,.27,angle);
  b.rod(.103,.12,edge,0,1.31,.54,angle);
  b.rod(.066,.025,0x151d19,0,1.37,.568,angle);
  b.box(.30,.13,.18,dark,0,.82,.38);
  for(const side of [-1,1]){
    b.rod(.026,.87,steel,side*.28,.48,.55,-.2,-side*.50);
    b.box(.17,.065,.25,dark,side*.48,.06,.62);
  }
  b.rod(.016,.55,edge,0,.81,.46,0,Math.PI/2);
  b.add(new THREE.TorusGeometry(.10,.019,5,12),dark,.33,.82,.46,0,Math.PI/2);
  b.box(.07,.14,.07,edge,-.16,.97,.36);b.box(.16,.045,.055,dark,-.19,1.04,.36);
  return b.finish();
}
