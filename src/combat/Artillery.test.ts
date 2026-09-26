import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance,transfer} from '../garrison/Inventory';
import {artilleryLayout} from '../construction/ArtilleryLayout';
import {fieldGunGeometry} from '../render/FieldGunVisual';
import {installPositionWeapons,positionReadiness} from './WeaponPositions';
import {preparedPosition} from './testing/PositionFixture';
import {requestPositionSupport,stepSupport} from './SupportWeapons';
import {bombardGround,MAX_BOMBARDMENT_CRATERS} from '../terrain/Bombardment';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {distance} from '../core/types';

describe('independently owned field artillery',()=>{
  it.each([0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI/4])('rotates the complete four-gun footprint with spacing intact (%s)',facing=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],center={x:0,z:0},layout=artilleryLayout(center,facing,sim.garrisons.network,sim.garrisons.network.component(g.trenchId),4);
    expect(layout.reduce((n,p)=>n+p.position.x,0)/4).toBeCloseTo(center.x);expect(layout.reduce((n,p)=>n+p.position.z,0)/4).toBeCloseTo(center.z);
    for(let i=1;i<4;i++)expect(distance(layout[i-1].position,layout[i].position)).toBeCloseTo(12);
    for(const p of layout)expect((p.position.x-center.x)*Math.sin(facing)+(p.position.z-center.z)*Math.cos(facing)).toBeCloseTo(0);
  });
  it('cancels a battery blueprint member without corrupting surviving gun identity on save',()=>{
    const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0],t=s.trenches[0],center={x:t.points[0].x+65,z:t.points[0].z-14};
    const layout=artilleryLayout(center,0,sim.garrisons.network,sim.garrisons.network.component(g.trenchId),4);
    const id=sim.requestConstruction({kind:'facility',facilityKind:'mortar',garrisonId:g.id,position:center,origin:layout[0].origin!,guns:4,facing:0})!;
    const before=balance(s);expect(sim.garrisons.cancelWork(id).accepted).toBe(true);
    const left=s.living!.facilities.filter(f=>f.artillery);expect(left).toHaveLength(3);expect(left.every(f=>f.artillery!.size===3&&f.artillery!.batteryId===left[0].id)).toBe(true);
    expect(new SaveSystem().parse(JSON.stringify(s))).toEqual(s);expect(balance(s)).toEqual(before);
  });
  it('places four physical work orders transactionally, with delivered cost and persistent group identity',()=>{
    const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0],root=s.trenches[0],center={x:root.points[0].x+65,z:root.points[0].z-14};
    const layout=artilleryLayout(center,0,sim.garrisons.network,sim.garrisons.network.component(g.trenchId),4);
    expect(layout).toHaveLength(4);for(let i=1;i<4;i++)expect(distance(layout[i].position,layout[i-1].position)).toBe(12);
    const initial=s.living!.facilities.length,before=balance(s),id=sim.requestConstruction({kind:'facility',facilityKind:'mortar',garrisonId:g.id,position:center,origin:layout[0].origin!,guns:4,facing:0});
    expect(id).toBeDefined();const guns=s.living!.facilities.filter(f=>f.artillery?.batteryId===id);expect(guns).toHaveLength(4);expect(s.living!.facilities).toHaveLength(initial+4);
    expect(guns.reduce((sum,f)=>sum+f.materialCost,0)).toBe(128);expect(new Set(guns.map(f=>f.connectorId)).size).toBe(4);
    expect(guns.every(f=>f.progress===0&&!f.installation&&f.stock.mortarHE===0&&f.workOrder?.autoWorkers)).toBe(true);expect(balance(s)).toEqual(before);
    expect(new SaveSystem().parse(JSON.stringify(s))).toEqual(s);
    const count=s.trenches.length,next=s.nextEntityId;expect(sim.requestConstruction({kind:'facility',facilityKind:'mortar',garrisonId:g.id,position:center,origin:layout[0].origin!,guns:4,facing:0})).toBeUndefined();expect(s.trenches.length).toBe(count);expect(s.nextEntityId).toBe(next);
  });
  it('single gun physically builds, owns its weapon when empty, and uses ordinary replacement crew',()=>{
    const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0];g.nextSupport=1e9;
    const id=sim.garrisons.requestFacility(g.id,'mortar',undefined,undefined,undefined,true)!,f=s.living!.facilities.find(f=>f.id===id)!;
    expect(id).toBeDefined();for(let i=0;i<20000&&f.progress<1;i++)sim.step(.05);
    expect(f.progress).toBe(1);expect(f.installation?.kind).toBe('field-gun');expect(f.stock.mortarHE).toBe(0);
    expect(sim.garrisons.autoCrew(id).accepted).toBe(true);const ids=f.weaponCrewIds!.slice();expect(ids.every(id=>!s.soldiers.find(p=>p.id===id)!.equipment!.mortar)).toBe(true);
    const stock={...f.stock},positions=s.soldiers.filter(p=>ids.includes(p.id)).map(p=>({x:p.x,z:p.z}));
    expect(sim.garrisons.setArtilleryFacing(id,Math.PI/2).accepted).toBe(true);expect(f.facing).toBe(Math.PI/2);
    expect(f.stock).toEqual(stock);expect(f.weaponCrewIds).toEqual(ids);expect(s.soldiers.filter(p=>ids.includes(p.id)).map(p=>({x:p.x,z:p.z}))).toEqual(positions);
    sim.garrisons.removeCrew(id);expect(f.installation?.kind).toBe('field-gun');expect(positionReadiness(s,f)).toContain('NO CREW');
    expect(new SaveSystem().parse(JSON.stringify(s))).toEqual(s);for(const n of Object.values(balance(s)))expect(Math.abs(n)).toBeLessThan(1e-6);
  },20000);
  it('legacy mortar loads unchanged; field-gun flight consumes one real round and makes persistent ground damage',()=>{
    const s=createOperation('advance'),sim=new BattlefieldSimulation(s),q=s.squads[0],p=s.soldiers.find(p=>p.squadId===q.id)!;
    p.equipment!.mortar=true;const f=preparedPosition(s,q.id,'mortar');
    expect(new SaveSystem().parse(JSON.stringify(s)).living!.facilities.find(p=>p.id===f.id)!.installation?.kind).toBe('mortar');
    // Isolated combat fixture: paid field gun with the same two ordinary operators.
    f.includesWeapon=true;f.artillery={batteryId:f.id,index:0,size:1};delete f.installation;installPositionWeapons(s);
    s.living!.rearStock.mortarHE+=2;s.living!.ledger.initial.mortarHE+=2;transfer(s.living!.rearStock,f.stock,'mortarHE',2);sim.terrain.syncModifications();
    f.facing=Math.PI;const target={x:f.x-130,z:f.z-200},before=balance(s),r=requestPositionSupport(s,'mortarHE',f.id,target,true,sim.terrain);expect(r.accepted,r.reason).toBe(true);
    const m=s.operation!.supportMissions!.at(-1)!;expect(m.weapon).toBe('field-gun');s.elapsed=m.launchAt;stepSupport(s,sim.terrain);expect(m.stage).toBe('flight');expect(f.stock.mortarHE).toBe(1);expect(new SaveSystem().parse(JSON.stringify(s))).toEqual(s);
    const height=sim.terrain.heightAt(m.impact.x,m.impact.z),craters=s.craters.length;s.elapsed=m.impactAt;stepSupport(s,sim.terrain);expect(m.stage).toBe('complete');expect(sim.terrain.heightAt(m.impact.x,m.impact.z)).toBeLessThan(height-.9);expect(s.craters).toHaveLength(craters+1);
    expect(balance(s)).toEqual(before);const loaded=new SaveSystem().parse(JSON.stringify(s));expect(new TerrainSystem(loaded).heightAt(m.impact.x,m.impact.z)).toBe(sim.terrain.heightAt(m.impact.x,m.impact.z));
  });
  it('bounded bombardment is deterministic and the physical gun silhouette is substantially larger than a person',()=>{
    const s=createOperation('advance'),copy=structuredClone(s);
    for(let i=0;i<560;i++){const p={x:-1750+(i%28)*21,z:-1750+Math.floor(i/28)*21};bombardGround(s,p);bombardGround(copy,p);}
    expect(s.craters).toEqual(copy.craters);expect(s.craters).toHaveLength(MAX_BOMBARDMENT_CRATERS);
    const terrain=new TerrainSystem(s),p=s.craters.at(-1)!;expect(terrain.deformationAt(p.x,p.z)).toBeLessThan(-.9);
    const geometry=fieldGunGeometry();geometry.computeBoundingBox();const box=geometry.boundingBox!;expect(box.max.z-box.min.z).toBeGreaterThan(6);expect(box.max.x-box.min.x).toBeGreaterThan(2.8);geometry.dispose();
  });
});
