import {mkdirSync,writeFileSync} from 'node:fs';
import {calibrateRifles} from '../src/combat/Calibration';
const report={description:'Geometric shot intersections; ordinary rifle gameplay calibration, not historical data',stationary:calibrateRifles(),movingTarget:calibrateRifles(20000,1.8),movingShooter:calibrateRifles(20000,3.2),suppressed:calibrateRifles(20000,3)};
mkdirSync('output',{recursive:true});writeFileSync('output/rifle-calibration-2026-09-23.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
