import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { releaseLostContextResources } from './ContextRecovery';

describe('graphics-context recovery',()=>{
  it('releases shared GPU resources once without deleting CPU geometry or instances',()=>{
    const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),texture=new THREE.Texture(),material=new THREE.MeshBasicMaterial({map:texture});
    const instances=new THREE.InstancedMesh(geometry,material,4);
    scene.add(instances,new THREE.Mesh(geometry,material));
    const positions=geometry.attributes.position.array,matrix=instances.instanceMatrix.array;
    const geometries=vi.spyOn(geometry,'dispose'),materials=vi.spyOn(material,'dispose'),textures=vi.spyOn(texture,'dispose'),buffers=vi.spyOn(instances,'dispose');
    releaseLostContextResources(scene);
    expect(geometries).toHaveBeenCalledTimes(1);expect(materials).toHaveBeenCalledTimes(1);expect(textures).toHaveBeenCalledTimes(1);expect(buffers).toHaveBeenCalledTimes(1);
    expect(geometry.attributes.position.array).toBe(positions);expect(instances.instanceMatrix.array).toBe(matrix);expect(scene.children).toHaveLength(2);
  });
});
