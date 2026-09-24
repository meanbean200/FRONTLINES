export type VisualQuality='low'|'balanced'|'high';
export const VISUAL_QUALITY={
  low:{pixelRatio:1,shadowSize:0,shadowInterval:160,foliageDetail:300,soldierDetail:95,particles:160,groundDetail:.45},
  balanced:{pixelRatio:1.25,shadowSize:2048,shadowInterval:70,foliageDetail:600,soldierDetail:180,particles:480,groundDetail:1},
  high:{pixelRatio:1.65,shadowSize:3072,shadowInterval:40,foliageDetail:950,soldierDetail:280,particles:900,groundDetail:1.3},
} as const;
