import * as THREE from 'three';
import type {BattlefieldState,Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {playerVisibleEnemies} from '../operations/Visibility';
import {supportAppearance} from './SupportAppearance';
import {truckGeometry,truckWheelGeometry} from './VehicleVisual';
import {loadTruckAssets,type TruckAssets} from './TruckAssets';
import {crewOperator} from '../combat/WeaponPositions';
import {mortarGeometry} from './WeaponPositionVisual';
import {weaponCrewPoint} from '../construction/PositionDefinitions';
import {mountedGeometry} from '../combat/MountedGeometry';
import {fieldGunGeometry} from './FieldGunVisual';
import {loadWeaponAssets,type WeaponAssets} from './WeaponAssets';
import {fieldGunPresentation} from './FieldGunPresentation';
import {weaponGeometry} from './SoldierVisual';
import type {Facility,Truck} from '../garrison/types';
import {playerCanSeeObject} from '../operations/ObjectSight';
import {crateVisible,stockPiles,stockPileAnchors} from '../garrison/SupplyAccess';
export class LivingRenderer {
  spectator=false;
  readonly group=new THREE.Group();
  private readonly boxes=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:1}),8192);
  private readonly routes=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xd9b56b,transparent:true,opacity:.55}));
  private last=-1;
  private readonly vehicles=new THREE.InstancedMesh(truckGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,side:THREE.DoubleSide}),64);
  private readonly wheels=new THREE.InstancedMesh(truckWheelGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}),384);
  private readonly distantTruckBody=this.vehicles.geometry;
  private truckAssets?:TruckAssets;
  private detailedWheels:THREE.InstancedMesh[]=[];
  private activeTrucks:Truck[]=[];
  private detailedTrucks=false;
  private readonly lastTrucks=new Map<number,{x:number;z:number;angle:number;roll:number}>();
  private readonly mortars=new THREE.InstancedMesh(mortarGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72}),128);
  private readonly fieldGuns=new THREE.InstancedMesh(fieldGunGeometry('carriage'),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88}),256);
  private readonly fieldTubes=new THREE.InstancedMesh(fieldGunGeometry('upper'),this.fieldGuns.material,256);
  private readonly mountedGuns=new THREE.InstancedMesh(weaponGeometry('machinegun'),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.18}),256);
  private equipment?:WeaponAssets;
  private activeGuns:{facility:Facility;height:number}[]=[];
  private activeMounts:Facility[]=[];
  private identity?:object;
  private readonly frustum=new THREE.Frustum();
  private readonly projection=new THREE.Matrix4();
  private readonly sphere=new THREE.Sphere(new THREE.Vector3(),25);
  constructor(private getState:()=>BattlefieldState,private terrain:TerrainSystem,equipment?:WeaponAssets|null,trucks?:TruckAssets|null){
    this.boxes.frustumCulled=false;this.boxes.castShadow=true;this.boxes.receiveShadow=true;this.group.add(this.boxes,this.routes,this.vehicles,this.wheels,this.mortars,this.fieldGuns,this.fieldTubes,this.mountedGuns);
    this.fieldGuns.name='Field gun carriages';this.fieldTubes.name='Field gun barrels';this.mountedGuns.name='Mounted machine guns';
    this.vehicles.name='Logistics truck bodies';this.wheels.name='Distant truck wheels';
    for(const mesh of [this.vehicles,this.wheels,this.mortars,this.fieldGuns,this.fieldTubes,this.mountedGuns]){mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;mesh.count=0;}
    const install=(a:WeaponAssets)=>{this.equipment=a;this.fieldGuns.geometry.dispose();this.fieldTubes.geometry.dispose();this.mountedGuns.geometry.dispose();this.fieldGuns.geometry=a.cannonCarriage;this.fieldTubes.geometry=a.cannonBarrel;this.mountedGuns.geometry=a.machinegun;this.last=-Infinity;};
    if(equipment)install(equipment);else if(equipment!==null&&typeof window!=='undefined')void loadWeaponAssets().then(install).catch(e=>console.warn('Support models unavailable; using procedural weapons.',e));
    const installTrucks=(a:TruckAssets)=>{this.truckAssets=a;this.detailedWheels=a.wheels.map((w,i)=>{const mesh=new THREE.InstancedMesh(w.geometry,this.wheels.material,64);mesh.name=`Logistics truck wheel ${i}`;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.count=0;this.group.add(mesh);return mesh;});this.last=-Infinity;};
    if(trucks)installTrucks(trucks);else if(trucks!==null&&typeof window!=='undefined')void loadTruckAssets().then(installTrucks).catch(e=>console.warn('Truck model unavailable; using procedural lorries.',e));
  }
  /** Presentation follows physical displacement, including between facility-detail updates. */
  private animateTrucks():void{
    if(!this.activeTrucks.length){this.vehicles.count=this.wheels.count=0;for(const mesh of this.detailedWheels)mesh.count=0;return;}
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),wheelRotation=new THREE.Quaternion(),spin=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1),axis=new THREE.Vector3(0,1,0),wheelAxis=new THREE.Vector3(1,0,0);
    const asset=this.detailedTrucks?this.truckAssets:undefined;
    this.vehicles.geometry=asset?.body??this.distantTruckBody;let wheelCount=0;
    for(const [i,t] of this.activeTrucks.entries()){
      const next=t.route[t.routeIndex],last=this.lastTrucks.get(t.id),angle=next&&Math.hypot(next.x-t.x,next.z-t.z)>.1?Math.atan2(next.x-t.x,next.z-t.z):last?.angle??Math.PI/2,h=this.terrain.heightAt(t.x,t.z);
      // Keep phase in metres, so an LOD swap cannot change wheel direction or speed.
      const roll=(last?.roll??0)+(last?Math.min(4,Math.hypot(t.x-last.x,t.z-last.z)):0);this.lastTrucks.set(t.id,{x:t.x,z:t.z,angle,roll});
      q.setFromAxisAngle(axis,angle);matrix.compose(position.set(t.x,h,t.z),q,scale);this.vehicles.setMatrixAt(i,matrix);
      wheelRotation.copy(q).multiply(spin.setFromAxisAngle(wheelAxis,roll/(asset?.wheelRadius??.5)));
      if(asset){
        for(const [j,w] of asset.wheels.entries()){position.copy(w.pivot).applyQuaternion(q);position.x+=t.x;position.y+=h;position.z+=t.z;this.detailedWheels[j].setMatrixAt(i,matrix.compose(position,wheelRotation,scale));}
      }else{
        for(const side of [-1,1])for(const z of [-2.23,-1.28,1.9]){position.set(side*1.04,.52,z).applyQuaternion(q);position.x+=t.x;position.y+=h;position.z+=t.z;this.wheels.setMatrixAt(wheelCount++,matrix.compose(position,wheelRotation,scale));}
      }
    }
    this.vehicles.count=this.activeTrucks.length;this.wheels.count=wheelCount;
    this.vehicles.instanceMatrix.needsUpdate=this.wheels.instanceMatrix.needsUpdate=true;
    for(const mesh of this.detailedWheels){mesh.count=asset?this.activeTrucks.length:0;mesh.instanceMatrix.needsUpdate=true;}
  }
  private animateGuns(state:BattlefieldState):void{
    if(!this.activeGuns.length&&!this.activeMounts.length)return;
    this.activeGuns.forEach(({facility,height},i)=>this.fieldTubes.setMatrixAt(i,fieldGunPresentation(state,facility,height,this.equipment).barrel));
    this.fieldTubes.instanceMatrix.needsUpdate=true;
    if(!this.activeMounts.length)return;
    const shots=new Map((state.operation?.shotEvents??[]).filter(s=>state.elapsed-s.at>=0&&state.elapsed-s.at<.065).map(s=>[s.shooterId,s]));
    const q=new THREE.Quaternion(),p=new THREE.Vector3(),direction=new THREE.Vector3(),matrix=new THREE.Matrix4(),scale=new THREE.Vector3(1,1,1),forward=new THREE.Vector3(0,0,1);
    this.activeMounts.forEach((f,i)=>{
      const shot=shots.get(crewOperator(state,f)?.id??-1),geometry=mountedGeometry(state,this.terrain,f,f.traverse?.yaw??f.facing??0);
      const muzzle=shot?.from??geometry.muzzle;
      if(shot)direction.set(shot.to.x-muzzle.x,shot.to.y-muzzle.y,shot.to.z-muzzle.z).normalize();
      else direction.set(muzzle.x-geometry.pivot.x,muzzle.y-geometry.pivot.y,muzzle.z-geometry.pivot.z).normalize();
      q.setFromUnitVectors(forward,direction);p.set(muzzle.x,muzzle.y,muzzle.z).addScaledVector(direction,-.6);
      this.mountedGuns.setMatrixAt(i,matrix.compose(p,q,scale));
    });this.mountedGuns.instanceMatrix.needsUpdate=true;
  }
  update(now:number,showRoutes:boolean,view?:Vec2&{zoom:number},camera?:THREE.Camera):void {
    const state=this.getState(),w=state.living;
    if(this.identity!==w){this.identity=w;this.lastTrucks.clear();this.activeTrucks=[];this.activeGuns=[];this.activeMounts=[];this.last=-Infinity;}
    this.detailedTrucks=Boolean(this.truckAssets&&(!view||view.zoom<(this.detailedTrucks?235:205)));
    this.routes.visible=showRoutes;if(now-this.last<80){this.animateGuns(state);this.animateTrucks();return;}this.last=now;
    if(!w){this.activeGuns=[];this.activeTrucks=[];this.boxes.count=this.vehicles.count=this.wheels.count=this.mortars.count=this.fieldGuns.count=this.fieldTubes.count=this.mountedGuns.count=0;for(const mesh of this.detailedWheels)mesh.count=0;return;}
    if(camera)this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    // Reject only presentation outside the real camera frustum, with a generous
    // bound for structures and their cast shadow. Knowledge still uses full LOS.
    const inView=(p:Vec2)=>{if(!camera)return true;this.sphere.center.set(p.x,this.terrain.heightAt(p.x,p.z)+2,p.z);return this.frustum.intersectsSphere(this.sphere);};
    const visible=playerVisibleEnemies(state),enemies=new Set(state.squads.filter(q=>q.faction==='enemy').map(q=>q.id));
    const hidden=(s:BattlefieldState['soldiers'][number])=>Boolean(!this.spectator&&state.operation&&enemies.has(s.squadId)&&!visible.has(s.id));
    const trucks=w.trucks.filter(t=>inView(t)&&(this.spectator||t.faction!=='enemy'||playerCanSeeObject(state,this.terrain,t,'truck')));
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),color=new THREE.Color(),position=new THREE.Vector3(),scale=new THREE.Vector3();let count=0;
    const box=(x:number,y:number,z:number,sx:number,sy:number,sz:number,tint:number,angle=0,pitch=0)=>{if(count>=8192)return;position.set(x,y,z);scale.set(sx,sy,sz);q.setFromEuler(new THREE.Euler(pitch,angle,0,'YXZ'));matrix.compose(position,q,scale);this.boxes.setMatrixAt(count,matrix);this.boxes.setColorAt(count++,color.setHex(tint));};
    const axis=new THREE.Vector3(0,1,0);this.activeTrucks=trucks.slice(0,64);this.animateTrucks();
    const existing=new Set(w.trucks.map(t=>t.id));for(const id of this.lastTrucks.keys())if(!existing.has(id))this.lastTrucks.delete(id);
    for(const t of this.activeTrucks){
      // The supplied canvas body is closed; do not place proxy heads through it.
      if(this.detailedTrucks)continue;
      const angle=this.lastTrucks.get(t.id)!.angle,h=this.terrain.heightAt(t.x,t.z);
      const passengers=state.operation?.campaign?.replacements?.manifests.filter(m=>m.truckId===t.id&&['convoy','shuttle'].includes(m.stage)).length??0;
      for(let i=0;i<passengers;i++){const x=(i%2?1:-1)*.72,z=-.6-Math.floor(i/2)*.52,px=t.x+x*Math.cos(angle)+z*Math.sin(angle),pz=t.z-x*Math.sin(angle)+z*Math.cos(angle);box(px,h+1.85,pz,.4,.65,.4,0x616744,angle);box(px,h+2.27,pz,.3,.19,.3,0x4c543b,angle);}
    }
    for(const pile of stockPiles(state,this.terrain,this.spectator,inView))for(const [i,p] of stockPileAnchors(pile).entries())box(p.x,this.terrain.heightAt(p.x,p.z)+.35,p.z,.9,.65,.8,i%2?0x80734c:0x686e49);
    let mortarCount=0,gunCount=0,mountedCount=0;this.activeGuns=[];this.activeMounts=[];
    for(const f of w.facilities){
      if(!inView(f))continue;
      if(!this.spectator&&w.garrisons.find(g=>g.id===f.garrisonId)?.faction==='enemy'&&!playerCanSeeObject(state,this.terrain,f,f.artillery&&f.progress===1?'field-gun':'position'))continue;
      const h=this.terrain.heightAt(f.x,f.z);
      const detail=!view||Math.hypot(f.x-view.x,f.z-view.z,view.zoom*.6)<230;
      for(const p of supportAppearance(f,state.trenches.find(t=>t.id===f.connectorId),(x,z)=>this.terrain.heightAt(x,z),detail))box(p.x,p.y,p.z,p.sx,p.sy,p.sz,p.color,p.angle,p.pitch??0);
      if((f.kind==='emplacement'||f.kind==='mortar')&&f.progress===1){
        const operator=crewOperator(state,f);
        // Empty ammunition or a reload must not make the physical weapon vanish.
        if(f.installation){
          const present=operator&&Math.hypot(operator.x-f.x,operator.z-f.z)<4&&operator.duty?.facilityId===f.id&&operator.duty.arrivedAt!==undefined;
          const angle=f.kind==='emplacement'?(f.traverse?.yaw??f.facing??0):present?operator.heading:f.facing??0,at=present?operator:weaponCrewPoint(state,f,0);
          const x=at.x+Math.sin(angle)*.55,z=at.z+Math.cos(angle)*.55;
          if(f.artillery){
            if(gunCount<256){q.setFromAxisAngle(axis,f.facing??0);matrix.compose(position.set(f.x,h,f.z),q,scale.setScalar(1));this.fieldGuns.setMatrixAt(gunCount++,matrix);this.activeGuns.push({facility:f,height:h});}
            if(f.stock.mortarHE>0)box(f.x+2,h+.24,f.z-.8,.65,.45,1.4,0x756b4b,f.facing??0);
          }else if(f.kind==='mortar'){
            if(mortarCount<128){q.setFromAxisAngle(axis,angle);matrix.compose(position.set(x,this.terrain.heightAt(x,z)+.02,z),q,scale.setScalar(1));this.mortars.setMatrixAt(mortarCount++,matrix);}
            const shells=f.stock.mortarHE;
            if(shells>0)box(f.x+1.15,h+.17,f.z-.5,.7,.3,1,0x817758,angle);
          }else{
            const {pivot}=mountedGeometry(state,this.terrain,f,angle),bx=pivot.x,bz=pivot.z,base=this.terrain.heightAt(bx,bz),height=Math.max(.3,pivot.y-base);
            box(bx,base+height/2,bz,.13,height,.13,0x414739,angle);box(bx,base+.12,bz,.8,.13,.65,0x454b3c,angle);
            if(mountedCount<256){this.activeMounts.push(f);mountedCount++;}
          }
        }
        continue;
      }
    }
    this.mortars.count=mortarCount;this.mortars.instanceMatrix.needsUpdate=true;
    this.fieldGuns.count=this.fieldTubes.count=gunCount;this.fieldGuns.instanceMatrix.needsUpdate=this.fieldTubes.instanceMatrix.needsUpdate=true;
    this.mountedGuns.count=mountedCount;this.mountedGuns.instanceMatrix.needsUpdate=true;this.animateGuns(state);
    for(const s of state.soldiers){if(s.needs?.life!=='active'||s.duty?.kind!=='haul'||!inView(s)||hidden(s))continue;const n=Object.values(s.carried??{}).reduce((a,b)=>a+b,0);if(n>0)box(s.x+Math.sin(s.heading)*.45,this.terrain.heightAt(s.x,s.z)+1,s.z+Math.cos(s.heading)*.45,.5,.42,.42,0xa18b5b,s.heading);}
    for(const c of w.crates)if(Object.values(c.stock).some(n=>n>0)){
      if(!inView(c))continue;
      if(!this.spectator&&!crateVisible(state,this.terrain,c))continue;
      const supplyPoint=this.getState().operation?.objectives.some(o=>o.cacheId===c.id);
      // Older saves did not record the dropper; an exact casualty-position match
      // gives those packs the same visibility treatment without rewriting saves.
      const owner=state.soldiers.find(s=>c.droppedBy!==undefined?s.id===c.droppedBy:!supplyPoint&&s.needs?.life!=='active'&&Math.hypot(s.x-c.x,s.z-c.z)<.05);
      if(owner){
        const x=c.x+Math.cos(owner.heading)*.65,z=c.z-Math.sin(owner.heading)*.65;
        box(x,this.terrain.heightAt(x,z)+.14,z,.4,.28,.45,0x756c46,owner.heading);continue;
      }
      const count=supplyPoint?Math.min(10,Math.ceil(Object.values(c.stock).reduce((a,b)=>a+b,0)/32)):1;
      for(let i=0;i<count;i++){const x=c.x+(supplyPoint?2+i%3*1.05:0),z=c.z+Math.floor(i/3)*.95;box(x,this.terrain.heightAt(x,z)+.4,z,.9,.8,.85,i%2?0x897e55:0x9d8e65);}
    }
    this.boxes.count=count;this.boxes.instanceMatrix.needsUpdate=true;if(this.boxes.instanceColor)this.boxes.instanceColor.needsUpdate=true;
    if(showRoutes){
      const lines:number[]=[];const segment=(a:Vec2,b:Vec2)=>lines.push(a.x,this.terrain.heightAt(a.x,a.z)+.4,a.z,b.x,this.terrain.heightAt(b.x,b.z)+.4,b.z);
      for(const t of w.trucks.filter(t=>t.faction!=='enemy')){let previous:Vec2=t;for(const p of t.route.slice(t.routeIndex)){segment(previous,p);previous=p;}}
      for(const s of state.soldiers){if(enemies.has(s.squadId)||s.duty?.kind!=='haul')continue;let previous:Vec2=s;for(const p of s.duty.route.slice(s.duty.routeIndex)){segment(previous,p);previous=p;}}
      this.routes.geometry.dispose();this.routes.geometry=new THREE.BufferGeometry();this.routes.geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    }
  }
}
