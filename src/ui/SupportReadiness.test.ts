import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from '../operations/createOperationalBattle';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {supportReadiness,requestSupport} from '../combat/SupportWeapons';
import {selectionReadout} from './FieldReadout';

describe('terrain-aware support presentation',()=>{
  it('matches authoritative roof readiness, then updates outside without changing target rules',()=>{
    const state=createOperationalBattle('meeting'),terrain=new TerrainSystem(state);
    const q=state.squads.find(q=>q.faction!=='enemy'&&state.soldiers.some(s=>s.squadId===q.id&&s.equipment?.mortar))!,building=terrain.buildings[0];
    const crew=state.soldiers.filter(s=>s.squadId===q.id),ids=new Set([q.id]);
    q.order={type:'hold',issuedAt:state.elapsed};
    crew.forEach((s,i)=>Object.assign(s,{x:building.x+i*.2,z:building.z,action:'holding',suppression:0}));
    for(const kind of ['mortarHE','mortarSmoke'] as const){
      const ready=supportReadiness(state,kind,q.id,terrain);
      expect(ready.ammo).toBeGreaterThan(0);expect(ready.crew).toBeGreaterThanOrEqual(2);
      expect(ready.reason).toContain('open-air');
    }
    const before=JSON.stringify(state),underRoof=selectionReadout(state,ids,terrain)!.support!;
    expect(underRoof.he.reason).toContain('roofs');expect(underRoof.smoke.reason).toContain('roofs');
    expect(JSON.stringify(state)).toBe(before);
    crew.forEach(s=>s.z=building.z+building.depth/2+6);
    expect(crew.every(s=>terrain.buildingAt(s)===undefined)).toBe(true);
    const outside=selectionReadout(state,ids,terrain)!.support!;
    expect(outside.he.reason).toBe('');expect(outside.smoke.reason).toBe('');
    expect(requestSupport(state,'mortarHE',q.id,{x:crew[0].x+10,z:crew[0].z},false,terrain).reason).toContain('50–900m');
    expect(requestSupport(state,'mortarHE',q.id,{x:crew[0].x+100,z:crew[0].z},false,terrain).accepted).toBe(true);
  });
});
