import * as THREE from 'three';
import type { BattlefieldState, TrenchState } from '../core/types';
import { pointAlongPolyline, polylineLength } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {excavatedSpan,excavationKey,excavationBoundsKey} from '../core/TrenchGeometry';
import {trenchTimbers} from './TrenchDressing';

export class TrenchRenderer {
  readonly group=new THREE.Group();
  private signatures=new Map<number,string>();
  private visuals=new Map<number,THREE.Group>();
  private neighborhoods=new Map<number,{revision:number;key:string}>();
  private readonly timber=new THREE.MeshStandardMaterial({color:0x85725a,roughness:1});
  private readonly plank=new THREE.BoxGeometry(1,1,1);
  private readonly planMaterial=new THREE.LineDashedMaterial({color:0xc5ae7d,dashSize:3,gapSize:2,depthTest:false,transparent:true,opacity:.8});
  constructor(private state:BattlefieldState,private readonly terrain:TerrainSystem){}
  replaceState(state:BattlefieldState):void {this.state=state;for(const g of this.visuals.values())this.dispose(g);this.group.clear();this.visuals.clear();this.signatures.clear();this.neighborhoods.clear();}
  update(zoom=0):void {
    for(const trench of this.state.trenches) {
      // Neighbour excavation can open a branch through this trench's old timber.
      let neighborhood=this.neighborhoods.get(trench.id);
      if(neighborhood?.revision!==this.terrain.revision){
        const xs=trench.points.map(p=>p.x),zs=trench.points.map(p=>p.z),x=Math.min(...xs)-8,z=Math.min(...zs)-8,size=Math.max(Math.max(...xs)-x,Math.max(...zs)-z)+8;
        neighborhood={revision:this.terrain.revision,key:this.state.trenches.map(t=>excavationBoundsKey(t,x,z,size)).filter(Boolean).join('|')};this.neighborhoods.set(trench.id,neighborhood);
      }
      const signature=`${excavationKey(trench,2)}:${trench.status}:${neighborhood.key}`;
      if(this.signatures.get(trench.id)===signature){const g=this.visuals.get(trench.id);if(g?.userData.detail)g.userData.detail.visible=zoom<650;continue;}
      const previous=this.visuals.get(trench.id);if(previous){this.group.remove(previous);this.dispose(previous);}
      const visual=this.createVisual(trench);visual.userData.detail.visible=zoom<650;this.visuals.set(trench.id,visual);this.signatures.set(trench.id,signature);this.group.add(visual);
    }
  }
  private createVisual(trench:TrenchState):THREE.Group {
    const group=new THREE.Group(),length=polylineLength(trench.points),span=excavatedSpan(trench);
    for(const [start,end] of [[0,span.start],[span.end,length]])if(end-start>.01) {
      const samples=Math.max(2,Math.ceil((end-start)/2));
      const pts=Array.from({length:samples},(_,i)=>{
        const p=pointAlongPolyline(trench.points,(start+(end-start)*i/(samples-1))/length);
        return new THREE.Vector3(p.x,this.terrain.baseHeightAt(p.x,p.z)+.35,p.z);
      });
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),this.planMaterial);line.computeLineDistances();line.renderOrder=5;group.add(line);
    }
    const parts=trenchTimbers(trench,this.terrain),detail=new THREE.Group();group.userData.detail=detail;group.add(detail);
    const supports=new THREE.InstancedMesh(this.plank,this.timber,parts.length),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3(),color=new THREE.Color();let n=0;
    for(const p of parts){position.set(p.x,p.y,p.z);scale.set(p.w,p.h,p.d);rotation.setFromEuler(new THREE.Euler(p.pitch,p.angle,p.roll,'YXZ'));matrix.compose(position,rotation,scale);supports.setMatrixAt(n,matrix);supports.setColorAt(n++,color.setHex(p.tint));}
    supports.count=n;supports.castShadow=supports.receiveShadow=true;detail.add(supports);return group;
  }
  private dispose(group:THREE.Group):void {group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();else if(o instanceof THREE.Line)o.geometry.dispose();});}
}
