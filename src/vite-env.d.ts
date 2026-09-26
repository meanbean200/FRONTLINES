/// <reference types="vite/client" />

import type { BattlefieldState, TrenchState, Vec2 } from './core/types';
import type { PerfSnapshot } from './ui/BattlefieldUI';

declare global {
  interface Window {
    __FRONTLINES_VIEWPORT__?:()=>ReturnType<typeof import('./diagnostics/ViewportDiagnostic').readViewportDiagnostic>;
    __FRONTLINES__: {
      ready: boolean;
      getSummary: () => {
        soldiers: number;
        squads: number;
        trenches: TrenchState[];
        craters: BattlefieldState['craters'];
        elapsed: number;
        selected: number[];
        perf: PerfSnapshot;
      };
      selectSquads: (ids: number[]) => void;
      issueMove: (x: number, z: number) => void;
      issueDrawnPath:(points:Vec2[],append?:boolean)=>boolean;
      hold:()=>void;
      resumeConstruction:()=>number;
      occupyTrench:(id:number)=>number|undefined;
      setQuality:(level:string)=>void;
      createTrench: (points: Vec2[], engineerSquadId?: number) => number | undefined;
      occupyNearestTrench: () => number | undefined;
      createCrater: (x: number, z: number, radius?: number, depth?: number) => number;
      setSpeed: (speed: number) => void;
      save: () => string;
      load: () => boolean;
      spawnStressTest: (count?: number) => number;
      focus: (x: number, z: number, distance?: number) => void;
      getPerf: () => PerfSnapshot;
      getFrameCosts:()=>{simulation:number;terrain:number;units:number;tactical:number;positions:number;webgl:number;hud:number;total:number};
      getSimulationCosts:()=>{actions:number;movement:number;earthworks:number;garrison:number;combat:number;terrainIntel:number;support:number;total:number};
      getVisualStats:()=>{triangles:number;drawCalls:number;particles:number;submittedSoldiers:number;residentTrees:number;visibleTrees:number;generatedChunks:number;detailedChunks:number;visibleChunks:number;coarseGenerationMs:number;workerGenerationMs:number;workerJobs:number;cameraTarget:{x:number;z:number};zoomDistance:number};
      getState: () => BattlefieldState;
      getSessionStats:()=>{kind:string;generation:number;resets:number;created:number;disposed:number;active:number;planners:number;gpu:{geometries:number;textures:number};entities:number;renderHosts:number;terrainWorkers:number};
      getCombatDiagnostics:()=>ReturnType<typeof import('./combat/Diagnostics').combatDiagnostics>;
      getPolicyPerf:()=>{inferenceMs:number};
      setReadiness:(id:number,value:'routine'|'alert'|'stand-to')=>void;
      resolveEmergency:(id:number,choice:'hold'|'recover'|'withdraw')=>void;
      advance:(seconds:number)=>void;
      restoreState:(state:BattlefieldState)=>void;
      projectWorld:(x:number,z:number,height?:number)=>{x:number;y:number;visible:boolean};
      terrainProbe:(x:number,z:number)=>{base:number;sampled:number;rendered?:number;cover:string};
    };
  }
}

export {};
