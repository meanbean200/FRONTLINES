import * as THREE from 'three';
import type {BattlefieldState,Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {playerVisibleEnemies,playerCanSeePoint} from '../operations/Visibility';
import {emplacementBoxes} from '../terrain/SupportGeometry';
import {truckGeometry,truckWheelGeometry} from './VehicleVisual';
export class LivingRenderer {
  readonly group=new THREE.Group();
  private readonly boxes=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:1}),8192);
  private readonly routes=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xd9b56b,transparent:true,opacity:.55}));
  private last=-1;
  private readonly vehicles=new THREE.InstancedMesh(truckGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,side:THREE.DoubleSide}),64);
  private readonly wheels=new THREE.InstancedMesh(truckWheelGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}),384);
  private readonly lastTrucks=new Map<number,{x:number;z:number;angle:number;roll:number}>();
  private identity?:object;
  constructor(private getState:()=>BattlefieldState,private terrain:TerrainSystem){this.boxes.frustumCulled=false;this.boxes.castShadow=true;this.boxes.receiveShadow=true;this.group.add(this.boxes,this.routes,this.vehicles,this.wheels);for(const mesh of [this.vehicles,this.wheels]){mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;mesh.count=0;}}
  update(now:number,showRoutes:boolean):void {
    this.routes.visible=showRoutes;if(now-this.last<80)return;this.last=now;
    const state=this.getState(),w=state.living;if(!w){this.boxes.count=this.vehicles.count=this.wheels.count=0;return;}
    if(this.identity!==w){this.identity=w;this.lastTrucks.clear();}
    const visible=playerVisibleEnemies(state),enemies=new Set(state.squads.filter(q=>q.faction==='enemy').map(q=>q.id));
    const hidden=(s:BattlefieldState['soldiers'][number])=>Boolean(state.operation&&enemies.has(s.squadId)&&!visible.has(s.id));
    const seen=(p:Vec2)=>playerCanSeePoint(state,this.terrain,p);
    const garrisons=w.garrisons.filter(g=>g.faction!=='enemy'||seen(g.entrance));
    const trucks=w.trucks.filter(t=>t.faction!=='enemy'||seen(t));
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),color=new THREE.Color(),position=new THREE.Vector3(),scale=new THREE.Vector3();let count=0;
    const box=(x:number,y:number,z:number,sx:number,sy:number,sz:number,tint:number,angle=0)=>{if(count>=8192)return;position.set(x,y,z);scale.set(sx,sy,sz);q.setFromAxisAngle(new THREE.Vector3(0,1,0),angle);matrix.compose(position,q,scale);this.boxes.setMatrixAt(count,matrix);this.boxes.setColorAt(count++,color.setHex(tint));};
    let vehicleCount=0,wheelCount=0;const axis=new THREE.Vector3(0,1,0),wheelAxis=new THREE.Vector3(1,0,0),wheelRotation=new THREE.Quaternion();
    for(const t of trucks.slice(0,64)){
      const next=t.route[t.routeIndex],last=this.lastTrucks.get(t.id),angle=next&&Math.hypot(next.x-t.x,next.z-t.z)>.1?Math.atan2(next.x-t.x,next.z-t.z):last?.angle??Math.PI/2,h=this.terrain.heightAt(t.x,t.z);
      const roll=(last?.roll??0)+(last?Math.min(4,Math.hypot(t.x-last.x,t.z-last.z))/.5:0);this.lastTrucks.set(t.id,{x:t.x,z:t.z,angle,roll});
      q.setFromAxisAngle(axis,angle);matrix.compose(position.set(t.x,h,t.z),q,scale.setScalar(1));this.vehicles.setMatrixAt(vehicleCount++,matrix);
      wheelRotation.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(wheelAxis,roll));
      for(const side of [-1,1])for(const z of [-2.23,-1.28,1.9]){position.set(side*1.04,.52,z).applyQuaternion(q).add(new THREE.Vector3(t.x,h,t.z));matrix.compose(position,wheelRotation,scale);this.wheels.setMatrixAt(wheelCount++,matrix);}
    }
    this.vehicles.count=vehicleCount;this.wheels.count=wheelCount;this.vehicles.instanceMatrix.needsUpdate=this.wheels.instanceMatrix.needsUpdate=true;
    const piles=[{point:w.rear,stock:w.rearStock},...garrisons.flatMap(g=>[{point:g.entrance,stock:g.cache},...(g.faction!=='enemy'||seen(g.forward)?[{point:g.forward,stock:g.forwardStock}]:[])]),...(w.enemySupply&&seen(w.enemySupply.rear)?[{point:w.enemySupply.rear,stock:w.enemySupply.stock}]:[])];
    for(const {point:p,stock} of piles){const crates=Math.min(12,Math.ceil((stock.food+stock.water+stock.materials)/20));for(let i=0;i<crates;i++){const x=p.x+2+(i%4)*1.15,z=p.z+Math.floor(i/4)*1.1;box(x,this.terrain.heightAt(x,z)+.35,z,.9,.65,.8,i%2?0x80734c:0x686e49);}}
    for(const f of w.facilities){
      if(w.garrisons.find(g=>g.id===f.garrisonId)?.faction==='enemy'&&!seen(f))continue;
      const h=this.terrain.heightAt(f.x,f.z);
      if(f.progress<=0){for(const x of [-2.7,2.7])for(const z of [-2.7,2.7])box(f.x+x,h+.5,f.z+z,.15,1,.15,0xd9b56b);continue;}
      if(f.kind==='emplacement'&&f.progress===1){for(const b of emplacementBoxes(f))box(b.x,h+b.y,b.z,b.rx*2,b.ry*2,b.rz*2,0x958965);continue;}
      box(f.x,h+.08,f.z,5.5,.14,5.5,0x827357);
      for(const side of [-1,1])box(f.x+side*2.7,h+.7*f.progress,f.z,.18,1.4*f.progress,5.5,0x695540);
      box(f.x,h+.7*f.progress,f.z+2.7,5.5,1.4*f.progress,.18,0x695540);
      if(f.progress<1)continue;
      if(f.kind==='rest'){for(let i=0;i<9;i++)if(i!==4)box(f.x+(i%3-1)*1.8,h+.22,f.z+(Math.floor(i/3)-1)*1.8,.75,.25,1.3,0x6f785b);}
      else if(f.kind==='meal'){box(f.x,h+.65,f.z,3.5,.15,1.1,0x958060);for(const side of [-1,1])box(f.x,h+.3,f.z+side*1.3,3.5,.22,.4,0x81714d);}
      else if(f.kind==='aid'){for(const side of [-1,1])box(f.x+side*1.3,h+.45,f.z,1,.2,2.2,0xb8b99c);box(f.x,h+1.5,f.z+2.75,1.3,1.3,.1,0xeee9d8);box(f.x,h+1.5,f.z+2.82,.25,1,.08,0x9f493c);box(f.x,h+1.5,f.z+2.84,1,.25,.08,0x9f493c);}
      else if(f.kind==='emplacement'){for(let i=-2;i<=2;i++)box(f.x+i,h+.5,f.z-2.3,.9,1,.65,0x958965);box(f.x,h+.65,f.z,.25,1.3,.25,0x45473b);box(f.x,h+1.35,f.z-.7,.25,.2,1.6,0x37382e);}
      else for(let i=0;i<Math.min(12,Math.ceil(Object.values(f.stock).reduce((a,b)=>a+b,0)/20));i++)box(f.x+(i%3-1)*1.35,h+.45,f.z+(Math.floor(i/3)-1)*1.1,1,.9,.9,0x77794e);
    }
    for(const s of state.soldiers){if(hidden(s)||s.needs?.life!=='active'||s.duty?.kind!=='haul')continue;const n=Object.values(s.carried??{}).reduce((a,b)=>a+b,0);if(n>0)box(s.x+Math.sin(s.heading)*.45,this.terrain.heightAt(s.x,s.z)+1,s.z+Math.cos(s.heading)*.45,.5,.42,.42,0xa18b5b,s.heading);}
    for(const c of w.crates)if(Object.values(c.stock).some(n=>n>0)){
      const supplyPoint=this.getState().operation?.objectives.some(o=>o.cacheId===c.id);
      // Older saves did not record the dropper; an exact casualty-position match
      // gives those packs the same visibility treatment without rewriting saves.
      const owner=state.soldiers.find(s=>c.droppedBy!==undefined?s.id===c.droppedBy:!supplyPoint&&s.needs?.life!=='active'&&Math.hypot(s.x-c.x,s.z-c.z)<.05);
      if(owner){
        if(hidden(owner))continue;
        const x=c.x+Math.cos(owner.heading)*.65,z=c.z-Math.sin(owner.heading)*.65;
        box(x,this.terrain.heightAt(x,z)+.14,z,.4,.28,.45,0x756c46,owner.heading);continue;
      }
      const count=supplyPoint?Math.min(10,Math.ceil(Object.values(c.stock).reduce((a,b)=>a+b,0)/32)):1;
      for(let i=0;i<count;i++){const x=c.x+(supplyPoint?2+i%3*1.05:0),z=c.z+Math.floor(i/3)*.95;box(x,this.terrain.heightAt(x,z)+.4,z,.9,.8,.85,i%2?0x897e55:0x9d8e65);}
    }
    this.boxes.count=count;this.boxes.instanceMatrix.needsUpdate=true;if(this.boxes.instanceColor)this.boxes.instanceColor.needsUpdate=true;
    if(showRoutes){
      const lines:number[]=[];const segment=(a:Vec2,b:Vec2)=>lines.push(a.x,this.terrain.heightAt(a.x,a.z)+.4,a.z,b.x,this.terrain.heightAt(b.x,b.z)+.4,b.z);
      for(const t of trucks.filter(t=>t.faction!=='enemy')){let previous:Vec2=t;for(const p of t.route.slice(t.routeIndex)){segment(previous,p);previous=p;}}
      for(const s of state.soldiers){if(enemies.has(s.squadId)||s.duty?.kind!=='haul')continue;let previous:Vec2=s;for(const p of s.duty.route.slice(s.duty.routeIndex)){segment(previous,p);previous=p;}}
      this.routes.geometry.dispose();this.routes.geometry=new THREE.BufferGeometry();this.routes.geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    }
  }
}
