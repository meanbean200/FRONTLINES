import * as THREE from 'three';
import {ModelGeometry} from './ModelGeometry';

/** Generic period cargo lorry, not an additional simulated vehicle type. +Z is front. */
export function truckGeometry():THREE.BufferGeometry {
  const b=new ModelGeometry(),paint=0x66694d,dark=0x343b33,canvas=0x89816a,glass=0x516260;
  b.box(1.65,.22,5.75,dark,0,.68,0);b.box(2.15,.24,3.35,paint,0,1.10,-1.12);
  // Cab has a sloping windscreen and separate hood, fenders and running boards.
  b.box(1.95,.68,1.3,paint,0,1.42,1.05);b.box(1.91,.92,.13,paint,0,1.95,.38);
  b.box(1.96,.11,1.44,paint,0,2.43,1.0);b.box(1.6,.10,.15,dark,0,1.83,1.72);
  b.box(1.73,.58,.025,glass,0,2.08,1.62,-.16);
  for(const x of [-.90,0,.90])b.box(.055,.70,.055,paint,x,2.10,1.62,-.16);
  for(const side of [-1,1]){
    b.box(.07,.6,1.23,paint,side*.95,1.51,1.0);b.box(.03,.50,.88,glass,side*.97,2.08,.99);
    b.box(.04,.06,1.27,paint,side*.99,1.80,1.02);b.box(.065,.65,.075,paint,side*.96,2.07,.39);
    b.box(.07,.06,.16,dark,side*1.00,1.65,.74);b.box(.40,.11,1.4,dark,side*1.02,.95,1.0);
    b.box(.42,.12,1.1,paint,side*.98,1.34,2.07);b.box(.38,.12,2.2,paint,side*1.03,1.25,-1.7);
    b.box(.10,.45,.10,paint,side*1.02,1.87,1.80);b.oval(.10,.11,.04,dark,side*1.05,2.04,1.82);
  }
  b.box(1.42,.69,1.12,paint,0,1.42,2.07);b.box(1.47,.6,.055,dark,0,1.43,2.65);
  for(let i=-5;i<=5;i++)b.box(.045,.50,.04,paint,i*.12,1.44,2.69);
  b.box(2.2,.18,.14,dark,0,.90,2.83);
  for(const side of [-1,1]){b.oval(.13,.13,.065,0xaaa489,side*.85,1.39,2.68);b.rod(.025,.33,dark,side*.84,1.23,2.67);}
  // Open rear canvas: hoop profile and thin sides, rather than one solid box.
  const roof=new THREE.CylinderGeometry(1.02,1.02,3.28,14,1,true,0,Math.PI).rotateZ(Math.PI/2).rotateY(Math.PI/2);
  b.add(roof,canvas,0,1.80,-1.10);
  for(const side of [-1,1]){b.box(.045,.64,3.26,canvas,side*1.02,1.49,-1.10);for(let z=-2.65;z<.35;z+=.65)b.box(.03,.72,.035,0x6c6856,side*1.046,1.54,z);}
  b.box(2.04,.30,.08,paint,0,1.26,-2.78);
  for(const z of [-2.23,-1.28,1.90])b.rod(.07,2.15,dark,0,.56,z,0,Math.PI/2);
  return b.finish();
}
export function truckWheelGeometry():THREE.BufferGeometry{
  const b=new ModelGeometry();b.add(new THREE.CylinderGeometry(.50,.50,.30,16),0x292b27,0,0,0,0,0,Math.PI/2);
  b.add(new THREE.CylinderGeometry(.25,.25,.32,12),0x626751,0,0,0,0,0,Math.PI/2);
  for(let n=0;n<12;n++){const a=n*Math.PI/6;b.box(.31,.04,.08,0x363830,0,Math.sin(a)*.474,Math.cos(a)*.474,-a);}
  return b.finish();
}
