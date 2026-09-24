import * as THREE from 'three';
import type { BattlefieldState, TrenchState } from '../core/types';
import { pointAlongPolyline, polylineLength } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {excavatedSpan,excavationKey} from '../core/TrenchGeometry';
import {hash2D} from '../core/random';

export class TrenchRenderer {
  readonly group=new THREE.Group();
  private signatures=new Map<number,string>();
  private visuals=new Map<number,THREE.Group>();
  private readonly timber=new THREE.MeshStandardMaterial({color:0x85725a,roughness:1});
  private readonly plank=new THREE.BoxGeometry(1,1,1);
  private readonly planMaterial=new THREE.LineDashedMaterial({color:0xc5ae7d,dashSize:3,gapSize:2,depthTest:false,transparent:true,opacity:.8});
  constructor(private state:BattlefieldState,private readonly terrain:TerrainSystem){}
  replaceState(state:BattlefieldState):void {this.state=state;for(const g of this.visuals.values())this.dispose(g);this.group.clear();this.visuals.clear();this.signatures.clear();}
  update(zoom=0):void {
    for(const trench of this.state.trenches) {
      const signature=`${excavationKey(trench,2)}:${trench.status}`;
      if(this.signatures.get(trench.id)===signature){const g=this.visuals.get(trench.id);if(g?.userData.detail)g.userData.detail.visible=zoom<650;continue;}
      const previous=this.visuals.get(trench.id);if(previous){this.group.remove(previous);this.dispose(previous);}
      const visual=this.createVisual(trench);visual.userData.detail.visible=zoom<650;this.visuals.set(trench.id,visual);this.signatures.set(trench.id,signature);this.group.add(visual);
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
    const count=Math.max(0,Math.floor((built-4)/.6)),detail=new THREE.Group();group.userData.detail=detail;group.add(detail);
    const supports=new THREE.InstancedMesh(this.plank,this.timber,count*8),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3(),color=new THREE.Color();let n=0;
    const plank=(x:number,y:number,z:number,w:number,h:number,d:number,angle:number,tint:number)=>{position.set(x,y,z);scale.set(w,h,d);rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),angle);matrix.compose(position,rotation,scale);supports.setMatrixAt(n,matrix);supports.setColorAt(n++,color.setHex(tint));};
    for(let i=0;i<count;i++){
      const along=span.start+3+i*.6,p=pointAlongPolyline(trench.points,along/length),q=pointAlongPolyline(trench.points,Math.min(1,(along+.2)/length)),angle=Math.atan2(q.x-p.x,q.z-p.z),nx=Math.cos(angle),nz=-Math.sin(angle),floor=this.terrain.heightAt(p.x,p.z);
      const wear=hash2D(i,trench.id,41),width=1.15+wear*.2;
      // Thin boards sit on the existing floor; they are not a new walk/collision surface.
      plank(p.x,floor+.025,p.z,width,.035,.53,angle+(wear-.5)*.06,wear>.5?0xa2967b:0x80755e);
      if(i%4!==0)continue;
      for(const side of [-1,1]){
        const x=p.x+nx*trench.width*.37*side,z=p.z+nz*trench.width*.37*side;
        // Leave real branch openings clear instead of drawing a timber fence across them.
        if(this.terrain.deformationAt(p.x+nx*trench.width*.7*side,p.z+nz*trench.width*.7*side)<-.4)continue;
        const top=this.terrain.baseHeightAt(x,z)-.12,height=Math.max(.2,top-floor);
        plank(x,floor+height*.5,z,.13,height,.16,angle,0x74664f);
        for(let level=0;level<4;level++)plank(x+nx*.08*side,floor+height*(.16+level*.205),z,.065,height*.16,2.28,angle,level%2?0x6d5e48:0x8b795b);
      }
    }
    supports.count=n;supports.castShadow=supports.receiveShadow=true;detail.add(supports);return group;
  }
  private dispose(group:THREE.Group):void {group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();else if(o instanceof THREE.Line)o.geometry.dispose();});}
}
