import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {treeCleared} from '../terrain/WorldFeatures';
import { TerrainSystem } from '../terrain/TerrainSystem';

const treeCrown = new THREE.IcosahedronGeometry(1, 1);
const trunkGeometry = new THREE.CylinderGeometry(.22, .4, 1, 5);
const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3c2b, roughness: 1 });

export function createVegetation(terrain: TerrainSystem, x0: number, z0: number): THREE.Group {
  const group = new THREE.Group();
  const trees=terrain.objects.trees(x0,z0);
  const crowns = new THREE.InstancedMesh(treeCrown, foliageMaterial, trees.length * 3);
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, trees.length);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const color = new THREE.Color();
  trees.forEach((tree, i) => {
    const h = terrain.heightAt(tree.x, tree.z);
    position.set(tree.x, h + tree.size * .9, tree.z);
    scale.set(1, tree.size * 1.8, 1);
    matrix.compose(position, rotation, scale); trunks.setMatrixAt(i, matrix);
    for (let layer = 0; layer < 3; layer++) {
      const angle = layer * 2.4 + i;
      position.set(tree.x + Math.cos(angle) * tree.size * .45, h + tree.size * (1.8 + layer * .25), tree.z + Math.sin(angle) * tree.size * .45);
      scale.set(tree.size * (.85 - layer * .1), tree.size * (1.05 - layer * .13), tree.size * (.85 - layer * .1));
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      matrix.compose(position, rotation, scale); crowns.setMatrixAt(i * 3 + layer, matrix);
      color.setHex([0x465838, 0x536442, 0x3b5037, 0x6a7045, 0x67734d][i % 5]);
      crowns.setColorAt(i * 3 + layer, color);
    }
  });
  crowns.castShadow = crowns.receiveShadow = true;
  trunks.castShadow = true;
  group.add(crowns, trunks);
  group.userData.trees=trees;group.userData.crowns=crowns.instanceMatrix.array.slice();group.userData.trunks=trunks.instanceMatrix.array.slice();group.userData.cleared=new Set<number>();
  refreshVegetationClearance(group,terrain);
  return group;
}

export function refreshVegetationClearance(group:THREE.Group,terrain:TerrainSystem):void {
  const trees=group.userData.trees as {x:number;z:number}[]|undefined;if(!trees)return;
  const cleared=group.userData.cleared as Set<number>,crowns=group.children[0] as THREE.InstancedMesh,trunks=group.children[1] as THREE.InstancedMesh;
  const matrix=new THREE.Matrix4();let changed=false;
  trees.forEach((tree,i)=>{
    const cut=treeCleared(terrain,tree);if(cut===cleared.has(i))return;changed=true;
    if(cut){cleared.add(i);matrix.makeScale(0,0,0);trunks.setMatrixAt(i,matrix);for(let j=0;j<3;j++)crowns.setMatrixAt(i*3+j,matrix);}
    else{cleared.delete(i);matrix.fromArray(group.userData.trunks,i*16);trunks.setMatrixAt(i,matrix);for(let j=0;j<3;j++){matrix.fromArray(group.userData.crowns,(i*3+j)*16);crowns.setMatrixAt(i*3+j,matrix);}}
  });
  if(changed){crowns.instanceMatrix.needsUpdate=true;trunks.instanceMatrix.needsUpdate=true;}
}

export function createInfrastructure(terrain: TerrainSystem): THREE.Group {
  const group = new THREE.Group();
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x9e9276, roughness: 1, side: THREE.DoubleSide });
  const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x547772, roughness: .32, metalness: .18, side: THREE.DoubleSide });
  const paths = [
    { path: (t: number) => ({ x: t, z: terrain.roadCenterZ(t) }), width: 6 },
    { path: (t: number) => ({ x: -1340 + Math.sin(t / 870) * 190, z: t }), width: 7 },
    { path: (t: number) => ({ x: t, z: -1330 + Math.sin(t / 530) * 30 }), width: 6 },
  ];
  for (const { path, width } of paths) group.add(ribbon(terrain, path, width, roadMaterial, false));
  group.add(ribbon(terrain, t => ({ x: t, z: terrain.riverCenter(t) }), 27, waterMaterial, true));
  group.add(createBuildingMeshes(terrain));
  return group;
}

function ribbon(terrain: TerrainSystem, path: (t: number) => {x:number;z:number}, width: number, material: THREE.Material, water: boolean): THREE.Mesh {
  const vertices: number[] = [], indices: number[] = [];
  const steps = 2000;
  for (let i=0; i<=steps; i++) {
    const t = -4000 + i / steps * 8000, p = path(t), q = path(t + 1);
    const length = Math.hypot(q.x-p.x,q.z-p.z), nx = -(q.z-p.z)/length, nz = (q.x-p.x)/length;
    for (const side of [-1,1]) {
      const x = p.x + nx * width / 2 * side, z = p.z + nz * width / 2 * side;
      vertices.push(x, water ? terrain.baseHeightAt(p.x,p.z)+2.4 : terrain.baseHeightAt(x,z)+.4, z);
    }
    if (i<steps) {const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;
  if(!water){mesh.userData.road=true;mesh.userData.hiddenRoadQuads=new Set<number>();}
  return mesh;
}

/** Cut road surfacing where excavation intersects it; do not leave a floating lid over a trench. */
export function refreshRoadCuts(group:THREE.Group,terrain:TerrainSystem,x:number,z:number):void {
  for(const mesh of group.children){
    if(!(mesh instanceof THREE.Mesh)||!mesh.userData.road)continue;
    const positions=mesh.geometry.attributes.position,hidden=mesh.userData.hiddenRoadQuads as Set<number>;let changed=false;
    for(let i=0;i<positions.count/2-1;i++){
      const a=i*2,b=a+2;
      if(Math.max(positions.getX(a),positions.getX(b))+8<x||Math.min(positions.getX(a),positions.getX(b))-8>x+500||Math.max(positions.getZ(a),positions.getZ(b))+8<z||Math.min(positions.getZ(a),positions.getZ(b))-8>z+500)continue;
      let cut=false;
      for(let along=0;along<=4&&!cut;along++)for(let across=0;across<=4&&!cut;across++){
        const t=along/4,u=across/4;
        const ax=positions.getX(a)*(1-u)+positions.getX(a+1)*u,az=positions.getZ(a)*(1-u)+positions.getZ(a+1)*u;
        const bx=positions.getX(b)*(1-u)+positions.getX(b+1)*u,bz=positions.getZ(b)*(1-u)+positions.getZ(b+1)*u;
        cut=terrain.deformationAt(ax*(1-t)+bx*t,az*(1-t)+bz*t)<-.1;
      }
      if(cut!==hidden.has(i)){changed=true;if(cut)hidden.add(i);else hidden.delete(i);}
    }
    if(changed){const indices:number[]=[];for(let i=0;i<positions.count/2-1;i++)if(!hidden.has(i)){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}mesh.geometry.setIndex(indices);}
  }
}

function createBuildingMeshes(terrain:TerrainSystem):THREE.Group {
  const group=new THREE.Group();group.name='buildings';group.userData.key=JSON.stringify(terrain.snapshot.buildingChanges);
  const plaster=[0xc0b99d,0xaaa58d,0xcec5a6,0x9b9b88].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  const wood=new THREE.MeshStandardMaterial({color:0x867358,roughness:1}),roof=new THREE.MeshStandardMaterial({color:0x675b50,roughness:1});
  terrain.buildings.forEach((b,id)=>{
    const root=new THREE.Group();root.userData.buildingId=id;const floor=terrain.baseHeightAt(b.x,b.z);
    const parts=new Map<string,{material:THREE.Material;layer:number;geometries:THREE.BufferGeometry[]}>();
    for(const box of terrain.structure(id)){
      const material=box.role==='roof'?roof:box.material==='timber'?wood:plaster[id%4];
      const key=box.layer+':'+box.material+':'+(box.role==='roof'?'roof':'body');
      const row=parts.get(key)??{material,layer:box.layer,geometries:[]};
      const geometry=new THREE.BoxGeometry(box.rx*2,box.ry*2,box.rz*2);geometry.translate(box.x,floor+box.y,box.z);row.geometries.push(geometry);parts.set(key,row);
    }
    for(const row of parts.values()){const geometry=mergeGeometries(row.geometries);row.geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,row.material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.layer=row.layer;root.add(mesh);}
    group.add(root);
  });
  return group;
}
export function refreshBuildingMeshes(infrastructure:THREE.Group,terrain:TerrainSystem,cutaways:Map<number,number>):void {
  let group=infrastructure.getObjectByName('buildings') as THREE.Group|undefined;
  if(group?.userData.key!==JSON.stringify(terrain.snapshot.buildingChanges)){
    if(group){const materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});materials.forEach(m=>m.dispose());infrastructure.remove(group);}
    group=createBuildingMeshes(terrain);infrastructure.add(group);
  }
  for(const building of group!.children){const level=cutaways.get(building.userData.buildingId);for(const mesh of building.children)mesh.visible=level===undefined||mesh.userData.layer<=level;}
}
