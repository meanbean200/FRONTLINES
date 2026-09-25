import * as THREE from 'three';
import { WORLD_HALF,WORLD_SIZE, clamp, type Vec2 } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import { blocksGameplayKey } from '../input/GameplayKeys';

export class StrategyCamera {
  readonly camera = new THREE.PerspectiveCamera(46, 1, 1, WORLD_SIZE*2.2);
  readonly target = new THREE.Vector3(-1270, 0, -1300);
  private readonly desiredTarget = this.target.clone();
  private azimuth = Math.PI * 0.1;
  private desiredAzimuth = this.azimuth;
  private polar = 0.92;
  private desiredPolar = this.polar;
  private distance = 490;
  private desiredDistance = this.distance;
  private readonly keys = new Set<string>();
  private rotating = false;
  private previousPointer = { x: 0, y: 0 };
  private viewport={left:0,top:0,width:1,height:1};

  constructor(private readonly canvas: HTMLCanvasElement, private readonly terrain: TerrainSystem) {
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('blur',()=>{this.keys.clear();this.rotating=false;});
    window.addEventListener('frontlines-menu',()=>{this.keys.clear();this.rotating=false;});
  }

  update(dt: number): void {
    dt=Number.isFinite(dt)?clamp(dt,0,.1):0;
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const strafe = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    if (forward !== 0 || strafe !== 0) {
      const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 2.8 : 1;
      const speed = (12 + this.distance * 0.5) * sprint * dt;
      const sin = Math.sin(this.azimuth);
      const cos = Math.cos(this.azimuth);
      this.desiredTarget.x += (-forward * sin + strafe * cos) * speed;
      this.desiredTarget.z += (-forward * cos - strafe * sin) * speed;
    }
    this.desiredTarget.x = clamp(this.desiredTarget.x, -WORLD_HALF+20, WORLD_HALF-20);
    this.desiredTarget.z = clamp(this.desiredTarget.z, -WORLD_HALF+20, WORLD_HALF-20);
    this.desiredTarget.y = this.terrain.heightAt(this.desiredTarget.x, this.desiredTarget.z);
    const damping = 1 - Math.exp(-dt * 9);
    this.target.lerp(this.desiredTarget, damping);
    this.azimuth += shortestAngle(this.azimuth, this.desiredAzimuth) * damping;
    this.polar += (this.desiredPolar - this.polar) * damping;
    this.distance += (this.desiredDistance - this.distance) * damping;
    const horizontal = Math.sin(this.polar) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.azimuth) * horizontal,
      this.target.y + Math.cos(this.polar) * this.distance,
      this.target.z + Math.cos(this.azimuth) * horizontal,
    );
    this.camera.position.y=Math.max(this.camera.position.y,this.terrain.heightAt(this.camera.position.x,this.camera.position.z)+3);
    this.camera.lookAt(this.target);
    // DOM labels and picking run before renderer.render(), which otherwise updates this too late.
    this.camera.updateMatrixWorld();
  }

  resize(width: number, height: number): void {
    const rect=this.canvas.getBoundingClientRect();this.viewport={left:rect.left,top:rect.top,width,height};
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  focus(point: Vec2, distance = this.desiredDistance): void {
    const x=clamp(point.x,-WORLD_HALF+20,WORLD_HALF-20),z=clamp(point.z,-WORLD_HALF+20,WORLD_HALF-20);
    this.desiredTarget.set(x, this.terrain.heightAt(x,z),z);
    this.desiredDistance = clamp(distance, 25, WORLD_SIZE*1.15);
  }

  get zoomDistance():number {return this.distance;}
  project(point:Vec2,offset=0):{x:number;y:number;visible:boolean;inFront:boolean} {
    const rect=this.viewport;
    const world=new THREE.Vector3(point.x,this.terrain.heightAt(point.x,point.z)+offset,point.z),inFront=world.clone().applyMatrix4(this.camera.matrixWorldInverse).z< -this.camera.near;
    const v=world.project(this.camera);
    return {x:rect.left+(v.x+1)*.5*rect.width,y:rect.top+(1-v.y)*.5*rect.height,inFront,visible:inFront&&v.z>0&&v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1};
  }

  groundPoint(clientX: number, clientY: number): Vec2 | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const ray = raycaster.ray;
    if (ray.direction.y >= -0.001) return undefined;
    let low = 0;
    let high = Math.min(WORLD_SIZE*2.5, (ray.origin.y + 180) / -ray.direction.y);
    for (let i = 0; i < 24; i += 1) {
      const mid = (low + high) * 0.5;
      const point = ray.at(mid, new THREE.Vector3());
      const above = point.y - this.terrain.heightAt(point.x, point.z);
      if (above > 0) low = mid;
      else high = mid;
    }
    const hit = ray.at(high, new THREE.Vector3());
    if (Math.abs(hit.x) > WORLD_HALF + 100 || Math.abs(hit.z) > WORLD_HALF + 100) return undefined;
    return { x: clamp(hit.x, -WORLD_HALF, WORLD_HALF), z: clamp(hit.z, -WORLD_HALF, WORLD_HALF) };
  }

  dispose(): void {
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if(document.documentElement.dataset.menu||document.documentElement.dataset.help||document.documentElement.dataset.fieldMap)return;
    this.desiredDistance = clamp(this.desiredDistance * Math.exp(event.deltaY * 0.0011), 25, WORLD_SIZE*1.15);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if(document.documentElement.dataset.menu||document.documentElement.dataset.help||document.documentElement.dataset.fieldMap)return;
    if (event.button !== 1) return;
    this.rotating = true;
    this.previousPointer = { x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.rotating) return;
    const dx = event.clientX - this.previousPointer.x;
    const dy = event.clientY - this.previousPointer.y;
    this.previousPointer = { x: event.clientX, y: event.clientY };
    this.desiredAzimuth -= dx * 0.006;
    this.desiredPolar = clamp(this.desiredPolar + dy * 0.004, 0.18, 1.32);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 1) this.rotating = false;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if(document.documentElement.dataset.menu||document.documentElement.dataset.help||document.documentElement.dataset.fieldMap)return;
    if (blocksGameplayKey(event)) return;
    this.keys.add(event.code);
    if(event.code==='KeyQ')this.desiredAzimuth+=.15;
    if(event.code==='KeyE')this.desiredAzimuth-=.15;
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
}

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
