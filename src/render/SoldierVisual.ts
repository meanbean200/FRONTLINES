import * as THREE from 'three';
import {ModelGeometry} from './ModelGeometry';

export const UNIFORMS={rifle:0x777657,engineer:0x82785a,enemy:0x646b60};
export function soldierGeometry(engineer:boolean,enemy=false,detail=true):THREE.BufferGeometry{
  const b=new ModelGeometry(),cloth=enemy?UNIFORMS.enemy:engineer?UNIFORMS.engineer:UNIFORMS.rifle,web=enemy?0x5a5141:0x99906a;
  // Tapered tunic: shoulders, waist and hem, not a rectangular torso.
  const rings=[[.18,.89],[.215,.94],[.17,1.07],[.22,1.3],[.235,1.36],[.15,1.42]].map(([r,y])=>new THREE.Vector2(r,y));
  b.add(new THREE.LatheGeometry(rings,12).scale(1,1,.7),cloth);
  b.oval(.19,.135,.14,cloth,0,.88,0);b.rod(.075,.14,0xa59174,0,1.45,0);
  b.oval(.125,.16,.13,0xb49a7b,0,1.6,.005);
  const helmet=new THREE.LatheGeometry([[0,.15],[.085,.142],[.15,.105],[.179,.05],[.19,-.005],[.207,-.015],[.2,-.034]].reverse().map(([r,y])=>new THREE.Vector2(r,y)),14);
  b.add(helmet,enemy?0x4c554c:0x566344,0,1.69,0);
  if(detail){
    b.oval(.035,.038,.046,0xb49a7b,0,1.58,.126);
    b.box(.022,.21,.016,0x5c5745,-.114,1.53,.048,0,0,.18);b.box(.022,.21,.016,0x5c5745,.114,1.53,.048,0,0,-.18);
    for(const x of [-.13,.13]){b.box(.042,.43,.018,web,x,1.18,.157,0,0,-x*.5);b.oval(.071,.092,.038,web,x,.99,.175);}
    b.box(.37,.045,.28,web,0,.94,0);b.box(.028,.044,.027,0xbbb293,0,.94,.15);
    b.oval(.155,.2,.065,0x6e6c4e,0,1.16,-.17);b.rod(.067,.26,0x827c5b,0,1.37,-.21,0,Math.PI/2);
    b.oval(.063,.09,.05,0x706d58,.21,.97,-.09);
    if(engineer){b.rod(.015,.56,0x806449,-.22,1.11,-.19,.2);b.oval(.06,.09,.012,0x52584f,-.22,.8,-.13);}
  }
  return b.finish();
}
export function legGeometry():THREE.BufferGeometry{
  const b=new ModelGeometry();
  b.add(new THREE.CylinderGeometry(.083,.074,.34,8),0xffffff,0,.17,0);
  b.oval(.077,.084,.08,0xffffff,0,.015,.015);
  b.add(new THREE.CylinderGeometry(.069,.056,.31,8),0xffffff,0,-.145,.015);
  b.oval(.075,.08,.14,0x51493a,0,-.285,.061);
  b.box(.145,.026,.24,0x37352d,0,-.337,.068);
  return b.finish();
}
export type WeaponVisualKind='rifle'|'smg'|'automatic'|'machinegun';
export function shovelGeometry():THREE.BufferGeometry{
  const b=new ModelGeometry();b.rod(.014,.82,0x857052,0,.05,0);b.oval(.075,.11,.016,0x555d56,0,-.43,0);b.box(.11,.025,.027,0x857052,0,.47,0);return b.finish();
}
export function weaponGeometry(kind:WeaponVisualKind):THREE.BufferGeometry{
  const b=new ModelGeometry(),metal=0x3e4540,wood=0x705239,smg=kind==='smg',mg=kind==='machinegun',automatic=kind==='automatic';
  const stock=new THREE.BoxGeometry(.075,.10,.29),p=stock.attributes.position;
  for(let i=0;i<p.count;i++){const taper=p.getZ(i)>.0?.65:1;p.setX(i,p.getX(i)*taper);p.setY(i,p.getY(i)*taper);}
  b.add(stock,wood,0,-.035,-.30);
  b.box(.07,.075,smg?.2:.3,metal,0,0,-.08);
  b.rod(mg?.038:.014,smg?.32:.64,metal,0,.005,smg?.13:.28,Math.PI/2);
  if(!mg)b.box(.055,.052,smg?.13:.36,wood,0,-.023,.15);
  b.box(.025,.022,.033,metal,0,.065,smg?.26:.57);
  b.box(.018,.035,.014,0x73766a,0,.045,-.1);
  b.box(.022,.072,.08,metal,0,-.068,-.13);
  if(smg||mg||automatic){b.box(mg?.15:.055,automatic?.15:.2,.07,metal,mg?.09:0,-.13,.01);b.box(.055,.105,.06,wood,0,-.1,-.18,.2);}
  if(mg){for(let i=0;i<7;i++)b.box(.006,.04,.012,0x1b201d,.036,.007,.1+i*.065);for(const side of [-1,1])b.rod(.011,.30,metal,side*.09,-.13,.42,0,side*.5);}
  if(automatic)for(const side of [-1,1])b.rod(.009,.20,metal,side*.06,-.09,.42,0,side*.45);
  return b.finish();
}
