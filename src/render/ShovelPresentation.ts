import * as THREE from 'three';

/** +Y shaft through the sampled hands, with blade twist following body facing.
 * Only a rigid visual transform: never stretches the model or drives work. */
export function shovelPresentation(lower:THREE.Vector3,upper:THREE.Vector3,heading:number,grip=new THREE.Vector3(0,.1,0)):THREE.Matrix4{
  const y=upper.clone().sub(lower);if(y.lengthSq()<1e-8)y.set(0,1,0);else y.normalize();
  const z=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));z.addScaledVector(y,-z.dot(y));
  if(z.lengthSq()<1e-8)z.set(Math.cos(heading),0,-Math.sin(heading)).cross(y);
  z.normalize();const x=new THREE.Vector3().crossVectors(y,z).normalize();z.crossVectors(x,y).normalize();
  const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
  return new THREE.Matrix4().compose(lower.clone().sub(grip.clone().applyQuaternion(rotation)),rotation,new THREE.Vector3(1,1,1));
}
