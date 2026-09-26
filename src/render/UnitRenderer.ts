import * as THREE from 'three';
import type { BattlefieldState } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {bodyFloor,playerVisibleEnemies} from '../operations/Visibility';
import {isWalkingAction} from '../core/SoldierActions';
import {soldierGeometry,legGeometry,weaponGeometry,shovelGeometry,UNIFORMS,type WeaponVisualKind} from './SoldierVisual';
import {muzzlePoint} from '../combat/Ballistics';
import {VISUAL_QUALITY,type VisualQuality} from './VisualQuality';
import {armyFor} from '../operations/BattleSetup';
import {postureOf} from '../combat/Posture';
import {operatedPosition} from '../combat/WeaponPositions';

export class UnitRenderer {
  spectator=false;
  readonly group=new THREE.Group();
  private body?:THREE.InstancedMesh;
  private engineers?:THREE.InstancedMesh;
  private enemies?:THREE.InstancedMesh;
  private legs?:THREE.InstancedMesh;
  private rings?:THREE.InstancedMesh;
  private weapons?:THREE.InstancedMesh;
  private flashes?:THREE.InstancedMesh;
  private arms?:THREE.InstancedMesh;
  private hands?:THREE.InstancedMesh;
  private tools?:THREE.InstancedMesh;
  private readonly variants=new Map<WeaponVisualKind,THREE.InstancedMesh>();
  private quality:VisualQuality='balanced';
  private count=-1;
  private readonly rifleGeometry=soldierGeometry(false);
  private readonly engineerGeometry=soldierGeometry(true);
  private readonly enemyGeometry=soldierGeometry(false,true);
  private readonly lodBodies=[soldierGeometry(false,false,false),soldierGeometry(true,false,false),soldierGeometry(false,true,false)];
  private readonly legGeometry=legGeometry();
  private readonly armGeometry=new THREE.CapsuleGeometry(.065,.15,3,7);
  private readonly handGeometry=new THREE.SphereGeometry(.062,7,5).scale(.85,1,.8);
  private readonly toolGeometry=shovelGeometry();
  private readonly bodyMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,emissive:0x080b07,transparent:true});
  private readonly legMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,transparent:true});
  private readonly armMaterial=new THREE.MeshStandardMaterial({roughness:1,transparent:true});
  private readonly handMaterial=new THREE.MeshStandardMaterial({color:0xb49a7b,roughness:1});
  private readonly toolMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9});
  private readonly ringMaterial=new THREE.MeshBasicMaterial({color:0xdbca96,transparent:true,opacity:.65,depthTest:false,depthWrite:false});
  private readonly ringGeometry=new THREE.RingGeometry(.58,.69,20).rotateX(-Math.PI/2);
  private readonly weaponGeometry=weaponGeometry('rifle');
  private readonly variantGeometries={smg:weaponGeometry('smg'),automatic:weaponGeometry('automatic'),machinegun:weaponGeometry('machinegun')};
  private readonly weaponMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,transparent:true});
  private readonly flashGeometry=new THREE.OctahedronGeometry(.17);
  private readonly flashMaterial=new THREE.MeshBasicMaterial({color:0xffdfa1});
  private readonly carriedWeaponTilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-1.15);
  private displayed=new Map<number,THREE.Vector3>();
  constructor(private state:BattlefieldState,private readonly terrain:TerrainSystem){}
  setQuality(quality:VisualQuality):void{this.quality=quality;}
  get visibleCount():number{return this.group.visible?(this.body?.count??0)+(this.engineers?.count??0)+(this.enemies?.count??0):0;}
  replaceState(state:BattlefieldState):void {this.state=state;this.count=-1;this.displayed.clear();}
  update(selected:Set<number>,dt=1/60,zoomDistance=0):void {
    const detail=Math.max(0,Math.min(1,(1500-zoomDistance)/450));
    this.group.visible=detail>0;
    if(!this.group.visible)return;
    this.bodyMaterial.opacity=this.legMaterial.opacity=this.weaponMaterial.opacity=this.armMaterial.opacity=detail;
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
      this.arms=new THREE.InstancedMesh(this.armGeometry,this.armMaterial,this.count*4);
      this.hands=new THREE.InstancedMesh(this.handGeometry,this.handMaterial,this.count*2);
      this.tools=new THREE.InstancedMesh(this.toolGeometry,this.toolMaterial,this.count);
      for(const mesh of [this.body,this.engineers,this.enemies,this.legs,this.rings,this.weapons,this.flashes]){mesh.frustumCulled=false;this.group.add(mesh);}
      this.body.castShadow=this.engineers.castShadow=this.enemies.castShadow=this.legs.castShadow=true;
      this.rings.renderOrder=4;
      this.group.add(this.arms,this.hands,this.tools);this.arms.castShadow=true;
      this.variants.clear();for(const [kind,geometry]of Object.entries(this.variantGeometries)){const mesh=new THREE.InstancedMesh(geometry,this.weaponMaterial,this.count);mesh.frustumCulled=false;mesh.castShadow=true;this.variants.set(kind as WeaponVisualKind,mesh);this.group.add(mesh);}
    }
    const close=zoomDistance<VISUAL_QUALITY[this.quality].soldierDetail;
    this.body!.geometry=close?this.rifleGeometry:this.lodBodies[0];this.engineers!.geometry=close?this.engineerGeometry:this.lodBodies[1];this.enemies!.geometry=close?this.enemyGeometry:this.lodBodies[2];
    const engineerIds=new Set(this.state.squads.filter(s=>s.kind==='engineer').map(s=>s.id));
    const enemyIds=new Set(this.state.squads.filter(s=>s.faction==='enemy').map(s=>s.id));
    const germanIds=new Set(this.state.squads.filter(s=>armyFor(this.state,s.faction??'player')==='german').map(s=>s.id));
    const visibleEnemies=playerVisibleEnemies(this.state);
    const freshShots=new Map((this.state.operation?.shotEvents??[]).filter(s=>this.state.elapsed-s.at<.065).map(s=>[s.shooterId,s]));
    const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1),p=new THREE.Vector3();
    const weaponRotation=new THREE.Quaternion(),weaponPosition=new THREE.Vector3(),local=new THREE.Vector3(),tint=new THREE.Color();
    const bodyMatrix=new THREE.Matrix4(),a=new THREE.Vector3(),b=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0),jointRotation=new THREE.Quaternion();
    let rifles=0,engineers=0,enemies=0,ringCount=0,legs=0,weapons=0,flashes=0,arms=0,hands=0,tools=0;
    const variantCounts={smg:0,automatic:0,machinegun:0};
    this.state.soldiers.forEach((soldier,i)=>{
      if(soldier.combat?.wound?.care==='evacuated'||soldier.combat?.wound?.care==='transport'){this.displayed.delete(soldier.id);return;}
      if(!this.spectator&&this.state.operation&&enemyIds.has(soldier.squadId)&&!visibleEnemies.has(soldier.id)){this.displayed.delete(soldier.id);return;}
      const position=this.displayed.get(soldier.id)??new THREE.Vector3(soldier.x,0,soldier.z);
      const target=new THREE.Vector3(soldier.x,position.y,soldier.z);
      if(position.distanceTo(target)>30)position.copy(target);else position.lerp(target,1-Math.exp(-dt*18));
      // Smooth travel, not floor contact: interpolating height across a cut
      // leaves feet floating over the trench or sunk into its bank.
      position.y=bodyFloor(this.terrain,{...soldier,x:position.x,z:position.z});
      this.displayed.set(soldier.id,position);
      rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),soldier.heading);
      const lying=postureOf(soldier)==='prone';
      const sleeping=soldier.action==='sleeping'&&soldier.needs?.life==='active',dead=soldier.needs?.life==='dead';
      const seated=postureOf(soldier)==='crouched'||['eating','resting','treating','treating at aid post'].includes(soldier.action);
      scale.setScalar(1);p.copy(position);if(seated&&!lying)p.y-=.43;
      if(lying){rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));p.x-=Math.sin(soldier.heading)*.9;p.z-=Math.cos(soldier.heading)*.9;p.y+=.38;}
      if(sleeping)rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),1.15));
      if(soldier.action==='being carried')p.y+=1;
      matrix.compose(p,rotation,scale);bodyMatrix.copy(matrix);
      const german=germanIds.has(soldier.squadId);
      const body=german?this.enemies!:engineerIds.has(soldier.squadId)?this.engineers!:this.body!;
      const bodyIndex=german?enemies++:engineerIds.has(soldier.squadId)?engineers++:rifles++;
      body.setMatrixAt(bodyIndex,matrix);
      tint.setHex(soldier.lastHitAt!==undefined&&this.state.elapsed-soldier.lastHitAt<.2?0xff8068:soldier.needs?.life==='dead'?0x888888:0xffffff);body.setColorAt(bodyIndex,tint);
      const moving=isWalkingAction(soldier.action);
      const shot=freshShots.get(soldier.id);
      const firing=Boolean(shot);
      const aiming=!moving&&soldier.needs?.life==='active'&&soldier.aimTargetId!==undefined&&(!soldier.duty||soldier.duty.kind==='watch');
      weaponRotation.copy(rotation);
      if(!aiming&&!firing)weaponRotation.multiply(this.carriedWeaponTilt);
      local.set(.16,(aiming||firing?1.24:1.05)-(seated?.43:0),.24).applyQuaternion(rotation);
      weaponPosition.copy(position).add(local);
      if(lying){weaponRotation.setFromAxisAngle(axis,soldier.heading);local.set(.14,.33,.53).applyQuaternion(weaponRotation);weaponPosition.copy(position).add(local);}
      const mount=operatedPosition(this.state,soldier,'emplacement'),weapon=mount?.installation?.kind??soldier.equipment?.weapon??soldier.combat?.weapon?.id,kind=weapon==='crew-mg'||weapon==='mg42'?'machinegun':weapon==='bar'?'automatic':weapon==='smg'?'smg':'rifle';
      if(aiming||firing){
        const muzzle=shot?.from??muzzlePoint(this.terrain,soldier,this.state),to=shot?.to??soldier.combat?.aim?.point;
        const direction=to?new THREE.Vector3(to.x-muzzle.x,to.y-muzzle.y,to.z-muzzle.z).normalize():new THREE.Vector3(Math.sin(soldier.heading),0,Math.cos(soldier.heading));
        weaponRotation.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
        weaponPosition.set(muzzle.x,muzzle.y,muzzle.z).addScaledVector(direction,kind==='smg'?-.29:-.60);
      }
      scale.setScalar(1);matrix.compose(weaponPosition,weaponRotation,scale);
      const digging=soldier.action==='digging'||soldier.action==='clearing spoil',care=soldier.action.startsWith('treating')||soldier.action==='carrying casualty';
      if(!mount&&weapon!=='unarmed'&&!care&&!digging&&soldier.action!=='being carried'){if(kind==='rifle')this.weapons!.setMatrixAt(weapons++,matrix);else this.variants.get(kind)!.setMatrixAt(variantCounts[kind]++,matrix);}
      if(shot){p.set(shot.from.x,shot.from.y,shot.from.z);matrix.compose(p,weaponRotation,scale);this.flashes!.setMatrixAt(flashes++,matrix);}
      for(let leg=0;leg<2;leg++) {
        const phase=moving?Math.sin(this.state.elapsed*8+i*.37+leg*Math.PI)*.2:0;
        const localX=leg===0?-.12:.12;
        p.set(position.x+Math.cos(soldier.heading)*localX+Math.sin(soldier.heading)*phase,position.y+.35,position.z-Math.sin(soldier.heading)*localX+Math.cos(soldier.heading)*phase);
        if(lying){p.set(localX,.35,phase*.2).applyQuaternion(rotation).add(position);p.x-=Math.sin(soldier.heading)*.9;p.z-=Math.cos(soldier.heading)*.9;p.y+=.38;scale.setScalar(1);}else{scale.set(1,seated?.58:1,1);if(seated){p.y=position.y+.20;p.z+=Math.cos(soldier.heading)*.12;p.x+=Math.sin(soldier.heading)*.12;}}
        jointRotation.copy(rotation);if(moving&&!lying)jointRotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),phase*1.4));
        matrix.compose(p,jointRotation,scale);this.legs!.setMatrixAt(legs,matrix);this.legs!.setColorAt(legs++,tint.setHex(german?0x646a60:0x65654b));
      }
      const cloth=german?UNIFORMS.enemy:engineerIds.has(soldier.squadId)?UNIFORMS.engineer:UNIFORMS.rifle;
      for(const side of [-1,1]){
        const swing=moving?Math.sin(this.state.elapsed*8+i*.37)*side*.17:0;
        let elbow=[side*.255,1.10,swing],hand=[side*.24,.9,-swing];
        if(mount&&!moving&&!lying){elbow=[side*.27,1.24,.15];hand=[side*.10,1.44,.42];}
        else if(aiming||firing){elbow=side>0?[.32,1.22,-.02]:[-.20,1.18,.25];const grip=new THREE.Vector3(0,-.04,side>0?-.1:.22).applyQuaternion(weaponRotation).add(weaponPosition).applyMatrix4(bodyMatrix.clone().invert());hand=[grip.x,grip.y,grip.z];}
        if(lying&&!aiming&&!firing){elbow=[side*.30,1.12,.03];hand=[side*.14,1.45,.05];}
        if(sleeping){elbow=[side*.18,1.15,.17];hand=[side*.07,1.5,.19];}
        if(dead){elbow=[side*.40,1.02,.03];hand=[side*.52,.83,side*.12];}
        if(digging){const reach=Math.sin(this.state.elapsed*4+i)*.17;elbow=[side*.23,1.10,.18];hand=[side*.08,1.0+reach,.46];}
        if(care||soldier.action==='eating'){elbow=[side*.22,1.02,.22];hand=[side*.12,care?.89:1.40,.37];}
        const points=[[side*.23,1.33,0],elbow,hand];
        for(let n=0;n<2;n++){a.fromArray(points[n]).applyMatrix4(bodyMatrix);b.fromArray(points[n+1]).applyMatrix4(bodyMatrix);p.copy(a).add(b).multiplyScalar(.5);b.sub(a);const length=b.length();jointRotation.setFromUnitVectors(axis,b.normalize());scale.set(1,length/.28,1);matrix.compose(p,jointRotation,scale);this.arms!.setMatrixAt(arms,matrix);this.arms!.setColorAt(arms++,tint.setHex(cloth));}
        if(close){p.fromArray(hand).applyMatrix4(bodyMatrix);scale.setScalar(1);matrix.compose(p,rotation,scale);this.hands!.setMatrixAt(hands++,matrix);}
      }
      if(soldier.action==='digging'&&close){p.set(.03,.70,.48).applyMatrix4(bodyMatrix);jointRotation.copy(rotation).multiply(new THREE.Quaternion().setFromAxisAngle(axis,.15));scale.setScalar(1);matrix.compose(p,jointRotation,scale);this.tools!.setMatrixAt(tools++,matrix);}
      scale.setScalar(1);
      if(selected.has(soldier.squadId)&&soldier.needs?.life==='active'&&soldier.cover!=='trench') {p.copy(position);p.y+=.1;matrix.compose(p,new THREE.Quaternion(),scale);this.rings!.setMatrixAt(ringCount++,matrix);}
    });
    this.body!.count=rifles;this.engineers!.count=engineers;this.enemies!.count=enemies;this.legs!.count=legs;this.rings!.count=ringCount;this.weapons!.count=weapons;this.flashes!.count=flashes;
    this.arms!.count=arms;this.hands!.count=hands;this.tools!.count=tools;
    for(const [kind,mesh]of this.variants){mesh.count=variantCounts[kind as keyof typeof variantCounts];mesh.instanceMatrix.needsUpdate=true;}
    for(const mesh of [this.body!,this.engineers!,this.enemies!,this.legs!,this.rings!,this.weapons!,this.flashes!])mesh.instanceMatrix.needsUpdate=true;
    for(const mesh of [this.body!,this.engineers!,this.enemies!])if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    for(const mesh of [this.arms!,this.hands!,this.tools!]){mesh.frustumCulled=false;mesh.instanceMatrix.needsUpdate=true;}
    if(this.arms!.instanceColor)this.arms!.instanceColor.needsUpdate=true;if(this.legs!.instanceColor)this.legs!.instanceColor.needsUpdate=true;
  }
}
