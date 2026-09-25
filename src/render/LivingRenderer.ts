import * as THREE from 'three';
import type {BattlefieldState,Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {playerVisibleEnemies,playerCanSeePoint} from '../operations/Visibility';
import {supportAppearance} from './SupportAppearance';
import {truckGeometry,truckWheelGeometry} from './VehicleVisual';
import {crewOperator} from '../combat/WeaponPositions';
import {mortarGeometry} from './WeaponPositionVisual';
import {weaponCrewPoint} from '../construction/PositionDefinitions';
import {mountedGeometry} from '../combat/MountedGeometry';
import {fieldGunGeometry} from './FieldGunVisual';
export class LivingRenderer {
  readonly group=new THREE.Group();
  private readonly boxes=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:1}),8192);
  private readonly routes=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xd9b56b,transparent:true,opacity:.55}));
  private last=-1;
  private readonly vehicles=new THREE.InstancedMesh(truckGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,side:THREE.DoubleSide}),64);
  private readonly wheels=new THREE.InstancedMesh(truckWheelGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}),384);
  private readonly lastTrucks=new Map<number,{x:number;z:number;angle:number;roll:number}>();
  private readonly mortars=new THREE.InstancedMesh(mortarGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72}),128);
  private readonly fieldGuns=new THREE.InstancedMesh(fieldGunGeometry('carriage'),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88}),256);
  private readonly fieldTubes=new THREE.InstancedMesh(fieldGunGeometry('upper'),this.fieldGuns.material,256);
  private identity?:object;
  constructor(private getState:()=>BattlefieldState,private terrain:TerrainSystem){this.boxes.frustumCulled=false;this.boxes.castShadow=true;this.boxes.receiveShadow=true;this.group.add(this.boxes,this.routes,this.vehicles,this.wheels,this.mortars,this.fieldGuns,this.fieldTubes);for(const mesh of [this.vehicles,this.wheels,this.mortars,this.fieldGuns,this.fieldTubes]){mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;mesh.count=0;}}
  update(now:number,showRoutes:boolean,view?:Vec2&{zoom:number}):void {
    this.routes.visible=showRoutes;if(now-this.last<80)return;this.last=now;
    const state=this.getState(),w=state.living;if(!w){this.boxes.count=this.vehicles.count=this.wheels.count=this.mortars.count=this.fieldGuns.count=this.fieldTubes.count=0;return;}
    if(this.identity!==w){this.identity=w;this.lastTrucks.clear();}
    const visible=playerVisibleEnemies(state),enemies=new Set(state.squads.filter(q=>q.faction==='enemy').map(q=>q.id));
    const hidden=(s:BattlefieldState['soldiers'][number])=>Boolean(state.operation&&enemies.has(s.squadId)&&!visible.has(s.id));
    const seen=(p:Vec2)=>playerCanSeePoint(state,this.terrain,p);
    const garrisons=w.garrisons.filter(g=>g.faction!=='enemy'||seen(g.entrance));
    const trucks=w.trucks.filter(t=>t.faction!=='enemy'||seen(t));
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),color=new THREE.Color(),position=new THREE.Vector3(),scale=new THREE.Vector3();let count=0;
    const box=(x:number,y:number,z:number,sx:number,sy:number,sz:number,tint:number,angle=0,pitch=0)=>{if(count>=8192)return;position.set(x,y,z);scale.set(sx,sy,sz);q.setFromEuler(new THREE.Euler(pitch,angle,0,'YXZ'));matrix.compose(position,q,scale);this.boxes.setMatrixAt(count,matrix);this.boxes.setColorAt(count++,color.setHex(tint));};
    let vehicleCount=0,wheelCount=0;const axis=new THREE.Vector3(0,1,0),wheelAxis=new THREE.Vector3(1,0,0),wheelRotation=new THREE.Quaternion();
    for(const t of trucks.slice(0,64)){
      const next=t.route[t.routeIndex],last=this.lastTrucks.get(t.id),angle=next&&Math.hypot(next.x-t.x,next.z-t.z)>.1?Math.atan2(next.x-t.x,next.z-t.z):last?.angle??Math.PI/2,h=this.terrain.heightAt(t.x,t.z);
      const roll=(last?.roll??0)+(last?Math.min(4,Math.hypot(t.x-last.x,t.z-last.z))/.5:0);this.lastTrucks.set(t.id,{x:t.x,z:t.z,angle,roll});
      q.setFromAxisAngle(axis,angle);matrix.compose(position.set(t.x,h,t.z),q,scale.setScalar(1));this.vehicles.setMatrixAt(vehicleCount++,matrix);
      wheelRotation.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(wheelAxis,roll));
      for(const side of [-1,1])for(const z of [-2.23,-1.28,1.9]){position.set(side*1.04,.52,z).applyQuaternion(q).add(new THREE.Vector3(t.x,h,t.z));matrix.compose(position,wheelRotation,scale);this.wheels.setMatrixAt(wheelCount++,matrix);}
      const passengers=state.operation?.campaign?.replacements?.manifests.filter(m=>m.truckId===t.id&&['convoy','shuttle'].includes(m.stage)).length??0;
      for(let i=0;i<passengers;i++){const x=(i%2?1:-1)*.72,z=-.6-Math.floor(i/2)*.52,px=t.x+x*Math.cos(angle)+z*Math.sin(angle),pz=t.z-x*Math.sin(angle)+z*Math.cos(angle);box(px,h+1.85,pz,.4,.65,.4,0x616744,angle);box(px,h+2.27,pz,.3,.19,.3,0x4c543b,angle);}
    }
    this.vehicles.count=vehicleCount;this.wheels.count=wheelCount;this.vehicles.instanceMatrix.needsUpdate=this.wheels.instanceMatrix.needsUpdate=true;
    const piles=[{point:w.rear,stock:w.rearStock},...garrisons.flatMap(g=>[{point:g.entrance,stock:g.cache},...(g.faction!=='enemy'||seen(g.forward)?[{point:g.forward,stock:g.forwardStock}]:[])]),...(w.enemySupply&&seen(w.enemySupply.rear)?[{point:w.enemySupply.rear,stock:w.enemySupply.stock}]:[])];
    for(const {point:p,stock} of piles){const crates=Math.min(12,Math.ceil((stock.food+stock.water+stock.materials)/20));for(let i=0;i<crates;i++){const x=p.x+2+(i%4)*1.15,z=p.z+Math.floor(i/4)*1.1;box(x,this.terrain.heightAt(x,z)+.35,z,.9,.65,.8,i%2?0x80734c:0x686e49);}}
    let mortarCount=0,gunCount=0;
    for(const f of w.facilities){
      if(w.garrisons.find(g=>g.id===f.garrisonId)?.faction==='enemy'&&!seen(f))continue;
      const h=this.terrain.heightAt(f.x,f.z);
      const detail=!view||Math.hypot(f.x-view.x,f.z-view.z,view.zoom*.6)<230;
      for(const p of supportAppearance(f,state.trenches.find(t=>t.id===f.connectorId),(x,z)=>this.terrain.heightAt(x,z),detail))box(p.x,p.y,p.z,p.sx,p.sy,p.sz,p.color,p.angle,p.pitch??0);
      if((f.kind==='emplacement'||f.kind==='mortar')&&f.progress===1){
        const operator=crewOperator(state,f);
        // Empty ammunition or a reload must not make the physical weapon vanish.
        if(f.installation){
          const present=operator&&Math.hypot(operator.x-f.x,operator.z-f.z)<4&&operator.duty?.facilityId===f.id&&operator.duty.arrivedAt!==undefined;
          const angle=present?operator.heading:f.facing??0,at=present?operator:weaponCrewPoint(state,f,0);
          const x=at.x+Math.sin(angle)*.55,z=at.z+Math.cos(angle)*.55;
          if(f.artillery){
            const mission=state.operation?.supportMissions?.find(m=>m.positionId===f.id&&['preparing','flight'].includes(m.stage)),aim=mission?Math.atan2(mission.target.x-f.x,mission.target.z-f.z):f.facing??0;
            if(gunCount<256){q.setFromAxisAngle(axis,f.facing??0);matrix.compose(position.set(f.x,h,f.z),q,scale.setScalar(1));this.fieldGuns.setMatrixAt(gunCount,matrix);q.setFromAxisAngle(axis,aim);matrix.compose(position,q,scale);this.fieldTubes.setMatrixAt(gunCount++,matrix);}
            if(f.stock.mortarHE>0)box(f.x+2,h+.24,f.z-.8,.65,.45,1.4,0x756b4b,f.facing??0);
          }else if(f.kind==='mortar'){
            if(mortarCount<128){q.setFromAxisAngle(axis,angle);matrix.compose(position.set(x,this.terrain.heightAt(x,z)+.02,z),q,scale.setScalar(1));this.mortars.setMatrixAt(mortarCount++,matrix);}
            const shells=f.stock.mortarHE;
            if(shells>0)box(f.x+1.15,h+.17,f.z-.5,.7,.3,1,0x817758,angle);
          }else{
            const {muzzle,pivot}=mountedGeometry(state,this.terrain,f,angle),bx=pivot.x,bz=pivot.z,base=this.terrain.heightAt(bx,bz),height=Math.max(.3,muzzle.y-base);
            box(bx,base+height/2,bz,.13,height,.13,0x414739,angle);box(bx,base+.12,bz,.8,.13,.65,0x454b3c,angle);
            box(bx,muzzle.y-.035,bz,.19,.18,.45,0x343a35,angle);box(muzzle.x-Math.sin(angle)*.30,muzzle.y,muzzle.z-Math.cos(angle)*.30,.065,.065,.60,0x292e2b,angle);
          }
        }
        continue;
      }
    }
    this.mortars.count=mortarCount;this.mortars.instanceMatrix.needsUpdate=true;
    this.fieldGuns.count=this.fieldTubes.count=gunCount;this.fieldGuns.instanceMatrix.needsUpdate=this.fieldTubes.instanceMatrix.needsUpdate=true;
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
