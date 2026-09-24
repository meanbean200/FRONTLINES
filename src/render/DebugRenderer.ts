import * as THREE from 'three';
import type { BattlefieldState, DebugFlags, Vec2 } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import type { TrenchSystem } from '../construction/TrenchSystem';
import {excavatedPoints} from '../core/TrenchGeometry';

export class DebugRenderer {
  readonly group = new THREE.Group();
  private elapsed = 0;

  constructor(
    private state: BattlefieldState,
    private readonly terrain: TerrainSystem,
    private readonly trenchSystem: TrenchSystem,
  ) {
    this.group.name = 'debug-overlays';
  }

  replaceState(state: BattlefieldState): void {
    this.state = state;
    this.clear();
  }

  update(dt: number, flags: DebugFlags, selectedSquads: Set<number>): void {
    this.elapsed += dt;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    this.clear();
    const selected = this.state.squads.filter((squad) => selectedSquads.has(squad.id));
    for (const squad of selected) if(flags.paths)this.addLine(squad.order.drawnPath??[squad,...squad.route.slice(squad.routeIndex)],0x9bacb2,.5);
    if (flags.destinations) {
      for (const squad of selected) {
        const target = squad.order.target;
        if (!target) continue;
        const geometry = new THREE.RingGeometry(3, 3.5, 4);
        geometry.rotateX(-Math.PI / 2);
        const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xd5dbc0, depthWrite: false,depthTest:false }));
        marker.position.set(target.x, this.terrain.heightAt(target.x, target.z) + 1.2, target.z);
        this.group.add(marker);
      }
    }
    if (flags.trenchGraph) {
      for (const trench of this.state.trenches) this.addLine(trench.points, 0xff8f4b, 2.6);
    }
    if (flags.trenchSlots) {
      for (const trench of this.state.trenches) {
        if(this.trenchSystem.capacity(trench)>0)this.addLine(excavatedPoints(trench),0x83ef9c,.25);
      }
    }
  }

  private addLine(points: Vec2[], color: number, yOffset: number): void {
    if (points.length < 2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((point) => new THREE.Vector3(point.x, this.terrain.heightAt(point.x, point.z) + yOffset, point.z)),
    );
    const line=new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9,depthTest:false,depthWrite:false }));line.renderOrder=6;this.group.add(line);
  }
  private clear():void {
    this.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});
    this.group.clear();
  }
}
