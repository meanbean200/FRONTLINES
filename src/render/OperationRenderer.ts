import * as THREE from 'three';
import type { BattlefieldState } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {playerVisibleEnemies,playerCanSeePoint,observedEnemySquad} from '../operations/Visibility';

/** Small reusable meshes, no per-frame text textures, lights, or allocations per shot. */
export class OperationRenderer {
  readonly group = new THREE.Group();
  private identity?: object;
  private markers: { ring: THREE.Mesh; flag: THREE.Mesh }[] = [];
  private readonly traces: THREE.LineSegments;
  private readonly positions = new Float32Array(600 * 6);
  private readonly smoke=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,7),new THREE.MeshBasicMaterial({color:0xaab3ab,transparent:true,opacity:.48,depthWrite:false}),128);
  private readonly blasts=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,5),new THREE.MeshBasicMaterial({color:0xdfa270,transparent:true,opacity:.65,depthWrite:false}),32);
  private readonly danger=new THREE.InstancedMesh(new THREE.RingGeometry(.96,1,64).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe8a16f,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}),32);
  private readonly uncertainty=new THREE.InstancedMesh(new THREE.RingGeometry(.98,1,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xd6be7f,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}),64);
  constructor(private readonly getState: () => BattlefieldState, private readonly terrain: TerrainSystem) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3)); geometry.setDrawRange(0, 0);
    this.traces = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffd28b, transparent: true, opacity: .65 }));
    this.traces.frustumCulled = false;
  }
  update(): void {
    const state = this.getState(), op = state.operation;
    if (this.identity !== op) {
      for (const child of [...this.group.children]) if (![this.traces,this.smoke,this.blasts,this.danger,this.uncertainty].some(o=>o===child)) child.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
      this.group.clear(); this.markers = []; this.identity = op; this.group.add(this.traces,this.smoke,this.blasts,this.danger,this.uncertainty);
      for (const objective of op?.objectives ?? []) {
        const marker = new THREE.Group(), ground = this.terrain.baseHeightAt(objective.x, objective.z);
        const ring = new THREE.Mesh(new THREE.RingGeometry(objective.radius - .45, objective.radius, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe6c784, transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }));
        // Drape objective boundary over terrain rather than hiding half the circle in hills.
        const a = ring.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) a.setY(i, this.terrain.heightAt(objective.x + a.getX(i), objective.z + a.getZ(i)) - ground + .18);
        marker.add(ring);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4d4840, roughness: .8 })); pole.position.y = 4; pole.castShadow = true;
        const flag = new THREE.Mesh(new THREE.BoxGeometry(4, 2.1, .08), new THREE.MeshStandardMaterial({ color: 0xe6c784, roughness: .9 })); flag.position.set(2, 6.5, 0); flag.castShadow = true;
        marker.add(pole, flag); marker.position.set(objective.x, ground, objective.z); this.group.add(marker); this.markers.push({ ring, flag });
      }
    }
    op?.objectives.forEach((o, i) => {
      const color = o.contested ? 0xc5a568 : o.owner === 'player' ? 0x9bacb2 : o.owner === 'enemy' ? 0xb8796b : 0xdbca96;
      for (const mesh of [this.markers[i].ring, this.markers[i].flag]) (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    });
    let count = 0;
    const seen=playerVisibleEnemies(state),enemySquads=new Set(state.squads.filter(s=>s.faction==='enemy').map(s=>s.id));
    const friendlies=state.soldiers.filter(s=>!enemySquads.has(s.squadId)&&s.needs?.life==='active');
    if (op) for (const shot of op.shotEvents??[]) {
      if (state.elapsed-shot.at>.16 || count >= 600) continue;
      if(enemySquads.has(shot.squadId)&&!seen.has(shot.shooterId)&&!friendlies.some(s=>Math.hypot(s.x-shot.to.x,s.z-shot.to.z)<50))continue;
      const k = count++ * 6;
      // Incoming fire may be noticed without revealing an unseen shooter's exact position.
      const hidden=enemySquads.has(shot.squadId)&&!seen.has(shot.shooterId),d=Math.hypot(shot.from.x-shot.to.x,shot.from.z-shot.to.z)||1,t=hidden?Math.min(1,8/d):1;
      this.positions[k] = shot.to.x+(shot.from.x-shot.to.x)*t; this.positions[k + 1] = shot.to.y+(shot.from.y-shot.to.y)*t; this.positions[k + 2] = shot.to.z+(shot.from.z-shot.to.z)*t;
      this.positions[k + 3] = shot.to.x; this.positions[k + 4] = shot.to.y; this.positions[k + 5] = shot.to.z;
    }
    this.traces.geometry.setDrawRange(0, count * 2); this.traces.geometry.attributes.position.needsUpdate = true;
    const matrix=new THREE.Matrix4();let clouds=0,blasts=0,dangers=0;
    for(const cloud of op?.smokeFields??[]){if(!friendlies.some(s=>Math.hypot(s.x-cloud.x,s.z-cloud.z)<80)&&!playerCanSeePoint(state,this.terrain,cloud))continue;const growth=Math.min(1,(state.elapsed-cloud.born+1)/4,(cloud.until-state.elapsed)/10);if(growth<=0)continue;for(let n=0;n<3&&clouds<128;n++){matrix.makeScale(cloud.radius*.7*growth,4*growth,cloud.radius*.7*growth);matrix.setPosition(cloud.x+Math.sin(n*2.1)*cloud.radius*.35,this.terrain.heightAt(cloud.x,cloud.z)+3+n,cloud.z+Math.cos(n*2.1)*cloud.radius*.35);this.smoke.setMatrixAt(clouds++,matrix);}}
    for(const blast of op?.blastEvents??[]){if(blasts>=32)break;if(!friendlies.some(s=>Math.hypot(s.x-blast.x,s.z-blast.z)<80)&&!playerCanSeePoint(state,this.terrain,blast))continue;const age=state.elapsed-blast.at;matrix.makeScale((1+age*8),Math.max(.1,1-age)*4,1+age*8);matrix.setPosition(blast.x,this.terrain.heightAt(blast.x,blast.z)+1,blast.z);this.blasts.setMatrixAt(blasts++,matrix);}
    for(const mission of op?.supportMissions??[]){if(dangers>=32||!['preparing','flight'].includes(mission.stage)||enemySquads.has(mission.squadId)||!mission.dangerRadius)continue;matrix.makeScale(mission.dangerRadius,1,mission.dangerRadius);matrix.setPosition(mission.target.x,this.terrain.heightAt(mission.target.x,mission.target.z)+1,mission.target.z);this.danger.setMatrixAt(dangers++,matrix);}
    this.smoke.count=clouds;this.blasts.count=blasts;this.danger.count=dangers;
    const reports=(op?.intelligence?.sounds??[]).filter(s=>s.side==='player').map(s=>({x:s.x,z:s.z,radius:s.radius}));
    for(const id of enemySquads){const c=observedEnemySquad(state,id);if(c&&!c.visible)reports.push({...c,radius:Math.max(3,Math.min(60,(state.elapsed-c.lastSeen)*2))});}
    let rings=0;for(const p of reports.slice(-64)){matrix.makeScale(p.radius,1,p.radius);matrix.setPosition(p.x,this.terrain.heightAt(p.x,p.z)+.7,p.z);this.uncertainty.setMatrixAt(rings++,matrix);}this.uncertainty.count=rings;
    for(const mesh of [this.smoke,this.blasts,this.danger,this.uncertainty]){mesh.frustumCulled=false;mesh.instanceMatrix.needsUpdate=true;}
  }
}
