import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BattlefieldState } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {bodyFloor,playerVisibleEnemies} from '../operations/Visibility';
import {isWalkingAction} from '../core/SoldierActions';

function soldierGeometry(engineer:boolean,enemy=false):THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];
  function part(geometry:THREE.BufferGeometry,color:number,x:number,y:number,z:number):void {
    geometry.translate(x,y,z);
    const c=new THREE.Color(color),array=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<array.length;i+=3){array[i]=c.r;array[i+1]=c.g;array[i+2]=c.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(array,3));parts.push(geometry);
  }
  const uniform=enemy?0x7d7770:engineer?0x94815d:0x58694a;
  part(new THREE.BoxGeometry(.43,.57,.26),uniform,0,1.16,0);
  part(new THREE.BoxGeometry(.32,.4,.19),0x69593e,0,1.15,-.2);
  part(new THREE.BoxGeometry(.13,.43,.15),uniform,-.28,1.12,.05);
  part(new THREE.BoxGeometry(.13,.43,.15),uniform,.28,1.12,.05);
  part(new THREE.BoxGeometry(.24,.24,.23),0xa18b6e,0,1.57,.02);
  part(new THREE.SphereGeometry(.185,8,5,0,Math.PI*2,0,Math.PI*.64),enemy?0x5e5e59:engineer?0x7f7050:0x46553e,0,1.72,.01);
  part(new THREE.BoxGeometry(.43,.06,.3),0x373b2d,0,.91,0);
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());return geometry;
}

export class UnitRenderer {
  readonly group=new THREE.Group();
  private body?:THREE.InstancedMesh;
  private engineers?:THREE.InstancedMesh;
  private enemies?:THREE.InstancedMesh;
  private legs?:THREE.InstancedMesh;
  private rings?:THREE.InstancedMesh;
  private weapons?:THREE.InstancedMesh;
  private flashes?:THREE.InstancedMesh;
  private count=-1;
  private readonly rifleGeometry=soldierGeometry(false);
  private readonly engineerGeometry=soldierGeometry(true);
  private readonly enemyGeometry=soldierGeometry(false,true);
  private readonly legGeometry=new THREE.BoxGeometry(.16,.67,.21);
  private readonly bodyMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,emissive:0x080b07,transparent:true});
  private readonly legMaterial=new THREE.MeshStandardMaterial({color:0x3b4934,roughness:1,transparent:true});
  private readonly ringMaterial=new THREE.MeshBasicMaterial({color:0xdbca96,transparent:true,opacity:.65,depthTest:false,depthWrite:false});
  private readonly ringGeometry=new THREE.RingGeometry(.58,.69,20).rotateX(-Math.PI/2);
  private readonly weaponGeometry=new THREE.BoxGeometry(.075,.09,.94);
  private readonly weaponMaterial=new THREE.MeshStandardMaterial({color:0x473b2d,roughness:.8,transparent:true});
  private readonly flashGeometry=new THREE.OctahedronGeometry(.17);
  private readonly flashMaterial=new THREE.MeshBasicMaterial({color:0xffdfa1});
  private readonly carriedWeaponTilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-1.15);
  private displayed=new Map<number,THREE.Vector3>();
  constructor(private state:BattlefieldState,private readonly terrain:TerrainSystem){}
  replaceState(state:BattlefieldState):void {this.state=state;this.count=-1;this.displayed.clear();}
  update(selected:Set<number>,dt=1/60,zoomDistance=0):void {
    const detail=Math.max(0,Math.min(1,(1500-zoomDistance)/450));
    this.group.visible=detail>0;
    if(!this.group.visible)return;
    this.bodyMaterial.opacity=this.legMaterial.opacity=this.weaponMaterial.opacity=detail;
    this.ringMaterial.opacity=detail*.65;
    if(this.count!==this.state.soldiers.length){
      this.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.group.clear();
      this.count=this.state.soldiers.length;
      this.body=new THREE.InstancedMesh(this.rifleGeometry,this.bodyMaterial,this.count);
      this.engineers=new THREE.InstancedMesh(this.engineerGeometry,this.bodyMaterial,this.count);
      this.enemies=new THREE.InstancedMesh(this.enemyGeometry,this.bodyMaterial,this.count);
      this.legs=new THREE.InstancedMesh(this.legGeometry,this.legMaterial,this.count*2);
      this.rings=new THREE.InstancedMesh(this.ringGeometry,this.ringMaterial,this.count);
      this.weapons=new THREE.InstancedMesh(this.weaponGeometry,this.weaponMaterial,this.count);
      this.flashes=new THREE.InstancedMesh(this.flashGeometry,this.flashMaterial,this.count);
      for(const mesh of [this.body,this.engineers,this.enemies,this.legs,this.rings,this.weapons,this.flashes]){mesh.frustumCulled=false;this.group.add(mesh);}
      this.body.castShadow=this.engineers.castShadow=this.enemies.castShadow=this.legs.castShadow=true;
      this.rings.renderOrder=4;
    }
    const engineerIds=new Set(this.state.squads.filter(s=>s.kind==='engineer').map(s=>s.id));
    const enemyIds=new Set(this.state.squads.filter(s=>s.faction==='enemy').map(s=>s.id));
    const visibleEnemies=playerVisibleEnemies(this.state);
    const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1),p=new THREE.Vector3();
    const weaponRotation=new THREE.Quaternion(),weaponPosition=new THREE.Vector3(),local=new THREE.Vector3(),tint=new THREE.Color();
    let rifles=0,engineers=0,enemies=0,ringCount=0,legs=0,weapons=0,flashes=0;
    this.state.soldiers.forEach((soldier,i)=>{
      if(soldier.combat?.wound?.care==='evacuated'||soldier.combat?.wound?.care==='transport'){this.displayed.delete(soldier.id);return;}
      if(this.state.operation&&enemyIds.has(soldier.squadId)&&!visibleEnemies.has(soldier.id)){this.displayed.delete(soldier.id);return;}
      const position=this.displayed.get(soldier.id)??new THREE.Vector3(soldier.x,0,soldier.z);
      const target=new THREE.Vector3(soldier.x,position.y,soldier.z);
      if(position.distanceTo(target)>30)position.copy(target);else position.lerp(target,1-Math.exp(-dt*18));
      // Smooth travel, not floor contact: interpolating height across a cut
      // leaves feet floating over the trench or sunk into its bank.
      position.y=bodyFloor(this.terrain,{...soldier,x:position.x,z:position.z});
      this.displayed.set(soldier.id,position);
      rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),soldier.heading);
      const lying=soldier.action==='sleeping'||soldier.needs?.life==='dead'||soldier.needs?.life==='incapacitated';
      const seated=['eating','resting','crouching','pinned','sheltering','treating','treating at aid post'].includes(soldier.action)||soldier.suppression>60;
      scale.set(1,seated?.65:1,1);p.copy(position);
      if(lying){rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));p.x-=Math.sin(soldier.heading)*.9;p.z-=Math.cos(soldier.heading)*.9;p.y+=.38;}
      if(soldier.action==='being carried')p.y+=1;
      matrix.compose(p,rotation,scale);
      const body=enemyIds.has(soldier.squadId)?this.enemies!:engineerIds.has(soldier.squadId)?this.engineers!:this.body!;
      const bodyIndex=enemyIds.has(soldier.squadId)?enemies++:engineerIds.has(soldier.squadId)?engineers++:rifles++;
      body.setMatrixAt(bodyIndex,matrix);
      tint.setHex(soldier.lastHitAt!==undefined&&this.state.elapsed-soldier.lastHitAt<.2?0xff8068:soldier.needs?.life==='dead'?0x888888:0xffffff);body.setColorAt(bodyIndex,tint);
      const moving=isWalkingAction(soldier.action);
      const firing=soldier.lastShotAt!==undefined&&this.state.elapsed-soldier.lastShotAt<.13;
      const aiming=!lying&&!moving&&soldier.aimTargetId!==undefined&&(!soldier.duty||soldier.duty.kind==='watch');
      weaponRotation.copy(rotation);
      if(!aiming&&!firing)weaponRotation.multiply(this.carriedWeaponTilt);
      local.set(.3,(aiming||firing?1.35:1.05)*(seated?.65:1),.28).applyQuaternion(rotation);
      weaponPosition.copy(position).add(local);
      if(lying){weaponPosition.x-=Math.sin(soldier.heading)*.9;weaponPosition.z-=Math.cos(soldier.heading)*.9;weaponPosition.y+=.38;}
      const weapon=soldier.combat?.weapon?.id;scale.set(weapon==='crew-mg'||weapon==='mg42'?1.9:weapon==='bar'?1.35:1,1,weapon==='smg'?.65:weapon==='crew-mg'?1.25:1);matrix.compose(weaponPosition,weaponRotation,scale);if(!soldier.action.startsWith('treating')&&soldier.action!=='being carried'&&soldier.action!=='carrying casualty')this.weapons!.setMatrixAt(weapons++,matrix);
      if(firing&&!lying){p.set(0,0,.6).applyQuaternion(weaponRotation).add(weaponPosition);matrix.compose(p,weaponRotation,scale);this.flashes!.setMatrixAt(flashes++,matrix);}
      for(let leg=0;leg<2;leg++) {
        const phase=moving?Math.sin(this.state.elapsed*8+i*.37+leg*Math.PI)*.2:0;
        const localX=leg===0?-.12:.12;
        p.set(position.x+Math.cos(soldier.heading)*localX+Math.sin(soldier.heading)*phase,position.y+.35,position.z-Math.sin(soldier.heading)*localX+Math.cos(soldier.heading)*phase);
        if(lying){p.set(localX,.35,0).applyQuaternion(rotation).add(position);p.x-=Math.sin(soldier.heading)*.9;p.z-=Math.cos(soldier.heading)*.9;p.y+=.38;scale.setScalar(1);}else scale.set(1,seated?.5:1,1);
        matrix.compose(p,rotation,scale);this.legs!.setMatrixAt(legs++,matrix);
      }
      scale.setScalar(1);
      if(selected.has(soldier.squadId)&&soldier.needs?.life==='active'&&soldier.cover!=='trench') {p.copy(position);p.y+=.1;matrix.compose(p,new THREE.Quaternion(),scale);this.rings!.setMatrixAt(ringCount++,matrix);}
    });
    this.body!.count=rifles;this.engineers!.count=engineers;this.enemies!.count=enemies;this.legs!.count=legs;this.rings!.count=ringCount;this.weapons!.count=weapons;this.flashes!.count=flashes;
    for(const mesh of [this.body!,this.engineers!,this.enemies!,this.legs!,this.rings!,this.weapons!,this.flashes!])mesh.instanceMatrix.needsUpdate=true;
    for(const mesh of [this.body!,this.engineers!,this.enemies!])if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  }
}
