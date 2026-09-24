import {dispersedEndpoint,rifleSpread,shotError} from './Ballistics';
import {boxIntersection} from '../terrain/WorldOcclusion';

export function calibrateRifles(samples=20000,multiplier=1){
  return [50,100,200,300,350].map(range=>{
    let hits=0;
    for(let i=0;i<samples;i++){
      const a={x:0,y:1.48,z:0},b=dispersedEndpoint(a,{x:range,y:.86,z:0},rifleSpread(range)*multiplier,shotError(1944+(i%7),11,i),range+15);
      if(boxIntersection(a,b,{x:range,y:.86,z:0,rx:.23,ry:.86,rz:.23}))hits++;
    }
    const p=hits/samples,z=1.96,denom=1+z*z/samples,center=(p+z*z/(2*samples))/denom;
    const margin=z*Math.sqrt(p*(1-p)/samples+z*z/(4*samples*samples))/denom;
    return {range,samples,hits,rate:p,confidence95:[center-margin,center+margin]};
  });
}
