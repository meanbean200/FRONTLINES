import * as THREE from 'three';
import type { BattlefieldState, TrenchState } from '../core/types';
import { pointAlongPolyline, polylineLength } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {excavatedSpan,excavationKey} from '../core/TrenchGeometry';

export class TrenchRenderer {
  readonly group=new THREE.Group();
  private signatures=new Map<number,string>();
  private visuals=new Map<number,THREE.Group>();
  private readonly timber=new THREE.MeshStandardMaterial({color:0x78644a,roughness:1});
  private readonly plank=new THREE.BoxGeometry(1,1,1);
  private readonly planMaterial=new THREE.LineDashedMaterial({color:0xc5ae7d,dashSize:3,gapSize:2,depthTest:false,transparent:true,opacity:.8});
  constructor(private state:BattlefieldState,private readonly terrain:TerrainSystem){}
  replaceState(state:BattlefieldState):void {this.state=state;for(const g of this.visuals.values())this.dispose(g);this.group.clear();this.visuals.clear();this.signatures.clear();}
  update():void {
    for(const trench of this.state.trenches) {
      const signature=`${excavationKey(trench,2)}:${trench.status}`;
      if(this.signatures.get(trench.id)===signature)continue;
      const previous=this.visuals.get(trench.id);if(previous){this.group.remove(previous);this.dispose(previous);}
      const visual=this.createVisual(trench);this.visuals.set(trench.id,visual);this.signatures.set(trench.id,signature);this.group.add(visual);
    }
  }
  private createVisual(trench:TrenchState):THREE.Group {
    const group=new THREE.Group(),length=polylineLength(trench.points),span=excavatedSpan(trench),built=span.end-span.start;
    for(const [start,end] of [[0,span.start],[span.end,length]])if(end-start>.01) {
      const samples=Math.max(2,Math.ceil((end-start)/2));
      const pts=Array.from({length:samples},(_,i)=>{
        const p=pointAlongPolyline(trench.points,(start+(end-start)*i/(samples-1))/length);
        return new THREE.Vector3(p.x,this.terrain.baseHeightAt(p.x,p.z)+.35,p.z);
      });
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),this.planMaterial);line.computeLineDistances();line.renderOrder=5;group.add(line);
    }
    const count=Math.max(0,Math.floor((built-5)/2.5));
    const supports=new THREE.InstancedMesh(this.plank,this.timber,count*3);
    const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3();
    for(let i=0;i<count;i++) {
      const along=span.start+5+i*2.5,p=pointAlongPolyline(trench.points,along/length),q=pointAlongPolyline(trench.points,(along+.4)/length);
      const angle=Math.atan2(q.x-p.x,q.z-p.z),nx=Math.cos(angle),nz=-Math.sin(angle);
      rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
      position.set(p.x,this.terrain.heightAt(p.x,p.z)+.08,p.z);scale.set(1.5,.12,.55);
      matrix.compose(position,rotation,scale);supports.setMatrixAt(i*3,matrix);
      for(let side=0;side<2;side++) {
        const direction=side===0?-1:1,x=p.x+nx*trench.width*.3*direction,z=p.z+nz*trench.width*.3*direction;
        position.set(x,this.terrain.baseHeightAt(x,z)-trench.depth*.48,z);scale.set(.13,trench.depth*.92,.16);
        matrix.compose(position,rotation,scale);supports.setMatrixAt(i*3+side+1,matrix);
      }
    }
    supports.castShadow=supports.receiveShadow=true;group.add(supports);return group;
  }
  private dispose(group:THREE.Group):void {group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();else if(o instanceof THREE.Line)o.geometry.dispose();});}
}
