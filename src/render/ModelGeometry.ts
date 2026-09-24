import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original, metre-scaled geometry with a single vertex-colour material. */
export class ModelGeometry {
  private parts:THREE.BufferGeometry[]=[];
  add(source:THREE.BufferGeometry,color:number,x=0,y=0,z=0,rx=0,ry=0,rz=0):void{
    const g=source.index?source.toNonIndexed():source;if(g!==source)source.dispose();
    g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);
    const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));this.parts.push(g);
  }
  box(w:number,h:number,d:number,color:number,x=0,y=0,z=0,rx=0,ry=0,rz=0):void{this.add(new THREE.BoxGeometry(w,h,d),color,x,y,z,rx,ry,rz);}
  oval(xr:number,yr:number,zr:number,color:number,x=0,y=0,z=0):void{this.add(new THREE.SphereGeometry(1,10,7).scale(xr,yr,zr),color,x,y,z);}
  rod(radius:number,length:number,color:number,x=0,y=0,z=0,rx=0,rz=0):void{this.add(new THREE.CylinderGeometry(radius*.85,radius,length,7),color,x,y,z,rx,0,rz);}
  finish():THREE.BufferGeometry{const g=mergeGeometries(this.parts);this.parts.forEach(p=>p.dispose());this.parts=[];return g;}
}
