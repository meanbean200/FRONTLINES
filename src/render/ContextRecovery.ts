import * as THREE from 'three';

/** Drop old-context handles while it is lost; keep CPU geometry for re-upload. */
export function releaseLostContextResources(root:THREE.Object3D):void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{
    if(object instanceof THREE.InstancedMesh)object.dispose();
    if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){
      geometries.add(object.geometry);
      for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
      if(object instanceof THREE.Mesh){if(object.customDepthMaterial)materials.add(object.customDepthMaterial);if(object.customDistanceMaterial)materials.add(object.customDistanceMaterial);}
    }
  });
  for(const material of materials){
    for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
    material.dispose();
  }
  for(const geometry of geometries)geometry.dispose();
  for(const texture of textures)texture.dispose();
}
