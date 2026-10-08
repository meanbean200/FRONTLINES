import * as THREE from 'three';

// Hand-authored landmarks for the user's A-pose mesh, in metres, +Z forward.
export const JOINTS = [
  ['Root',-1,0,0,0], ['Pelvis',0,0,.86,-.035], ['Spine',1,0,1.09,-.03],
  ['Chest',2,0,1.35,-.03], ['Head',3,0,1.54,-.025],
  ['ArmL',3,-.205,1.375,-.025], ['ForearmL',5,-.36,1.10,-.005], ['HandL',6,-.475,.865,.015],
  ['ArmR',3,.205,1.375,-.025], ['ForearmR',8,.36,1.10,-.005], ['HandR',9,.475,.865,.015],
  ['ThighL',1,-.13,.845,-.045], ['ShinL',11,-.20,.47,-.06], ['FootL',12,-.225,.115,.005],
  ['ThighR',1,.13,.845,-.045], ['ShinR',14,.20,.47,-.06], ['FootR',15,.225,.115,.005],
] as const;
export const CLIPS = {
  idle:2, unarmed:2, walk:1, aim:2, crouch:2, crouchWalk:1.2, crouchAim:2,
  dig:1.6, rest:3, eat:2.4, treat:2.2, carry:1.2,
  prone:2, crawl:1.8, sleep:3, wounded:3, dead:1,
} as const;
export type SoldierClip=keyof typeof CLIPS;

export function createRig(){
  const bones=JOINTS.map(([name])=>{const b=new THREE.Bone();b.name=name;return b;});
  JOINTS.forEach(([,parent,x,y,z],i)=>{
    const p=parent>=0?JOINTS[parent]:undefined;
    bones[i].position.set(x-(p?.[2]??0),y-(p?.[3]??0),z-(p?.[4]??0));
    if(parent>=0)bones[parent].add(bones[i]);
  });
  bones[0].updateMatrixWorld(true);
  return {bones,skeleton:new THREE.Skeleton(bones)};
}

function globalRotation(bone:THREE.Bone,rotation:THREE.Quaternion){
  const parent=new THREE.Quaternion();bone.parent?.getWorldQuaternion(parent);
  bone.quaternion.copy(parent.invert().multiply(rotation));bone.updateMatrixWorld(true);
}

/** Two-bone reach with stable bend plane; no stretch or disconnected limbs. */
function limb(bones:THREE.Bone[],upper:number,lower:number,end:number,target:THREE.Vector3,pole:THREE.Vector3,foot=false){
  const a=bones[upper].getWorldPosition(new THREE.Vector3()),ab=bones[lower].position.clone(),bc=bones[end].position.clone();
  const l1=ab.length(),l2=bc.length(),axis=target.clone().sub(a),d=THREE.MathUtils.clamp(axis.length(),.06,l1+l2-.003);axis.normalize();
  const across=pole.clone().sub(a);across.addScaledVector(axis,-across.dot(axis)).normalize();
  const along=(l1*l1+d*d-l2*l2)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const b=a.clone().addScaledVector(axis,along).addScaledVector(across,height),c=a.clone().addScaledVector(axis,d);
  globalRotation(bones[upper],new THREE.Quaternion().setFromUnitVectors(ab.normalize(),b.clone().sub(a).normalize()));
  globalRotation(bones[lower],new THREE.Quaternion().setFromUnitVectors(bc.normalize(),c.clone().sub(b).normalize()));
  if(foot)globalRotation(bones[end],new THREE.Quaternion());
}

export function poseRig(bones:THREE.Bone[],clip:SoldierClip,time:number){
  JOINTS.forEach(([,parent,x,y,z],i)=>{
    const p=parent>=0?JOINTS[parent]:undefined;
    bones[i].position.set(x-(p?.[2]??0),y-(p?.[3]??0),z-(p?.[4]??0));bones[i].quaternion.identity();
  });
  const cycle=clip==='dead'?0:time/CLIPS[clip]*Math.PI*2,swing=Math.sin(cycle),breath=Math.sin(cycle)*.006;
  const crouched=['crouch','crouchWalk','crouchAim','rest','eat','treat'].includes(clip);
  const walking=['walk','crouchWalk','carry','crawl'].includes(clip);
  const prone=['prone','crawl','sleep','wounded','dead'].includes(clip);
  bones[1].position.y-=crouched?.37:.028;
  if(clip==='dig')bones[1].position.y-=.25+.02*Math.cos(cycle);
  if(walking&&!crouched)bones[1].position.y+=Math.abs(Math.cos(cycle))*.018;
  bones[2].rotation.x=crouched?.16:clip==='dig'?.35+.10*swing:.025;
  bones[3].rotation.x=-.03+breath;
  if(clip==='rest')bones[2].rotation.x=.27;
  if(clip==='treat')bones[2].rotation.x=.43;
  bones[0].updateMatrixWorld(true);
  for(const [side,leg] of [[-1,11],[1,14]] as const){
    const step=walking?swing*side*(crouched?.11:.23):0;
    const lift=walking?Math.max(0,Math.cos(cycle)*side)*.085:0;
    limb(bones,leg,leg+1,leg+2,new THREE.Vector3(side*(crouched?.24:.205),.115+lift,step+(crouched?.11:0)),new THREE.Vector3(side*.23,.55,1),true);
  }
  let left=[.11,1.21,.33],right=[.16,.97,.20];
  if(clip==='unarmed'){left=[-.29,.90,.045];right=[.29,.90,.045];}
  if(clip==='walk'){left=[.11,1.21+breath,.33];right=[.16,.97+breath,.20];}
  if(clip==='aim'||clip==='crouchAim'){left=[.13,1.43,.42];right=[.16,1.43,.10];}
  if(clip==='dig'){left=[-.005,.56+swing*.15,.50];right=[.06,.88+swing*.15,.40];}
  if(crouched){left=left.map((v,i)=>i===1?v-.37:v);right=right.map((v,i)=>i===1?v-.37:v);}
  if(clip==='rest'){left=[-.2,.49,.31];right=[.2,.49,.31];}
  if(clip==='eat'){left=[-.13,.68,.25];right=[.05,1.03+swing*.06,.22];}
  if(clip==='treat'){left=[-.15,.36,.5];right=[.12,.36+swing*.06,.48];}
  if(clip==='carry'){left=[-.30,1.53,.04];right=[.32,1.55,.06];}
  if(prone){left=[-.24,1.31,.12];right=[.22,1.34,.10];}
  if(clip==='crawl'){left[1]+=swing*.12;right[1]-=swing*.12;}
  if(clip==='sleep'){left=[-.08,1.4,.15];right=[.09,1.42,.14];}
  if(clip==='wounded'){left=[-.12,1.05,.22];right=[.1,1.1,.23];}
  if(clip==='dead'){left=[-.39,.98,.05];right=[.4,1.02,-.07];}
  limb(bones,5,6,7,new THREE.Vector3(...left),new THREE.Vector3(-.65,1.1,-.02));
  limb(bones,8,9,10,new THREE.Vector3(...right),new THREE.Vector3(.65,1.1,-.02));
  if(prone){
    bones[0].rotation.x=Math.PI/2;bones[0].position.set(0,.28,-.90);
    if(clip==='sleep')bones[0].rotation.y=1.05;
    if(clip==='dead')bones[0].rotation.z=.12;
  }
  bones[0].updateMatrixWorld(true);
}
