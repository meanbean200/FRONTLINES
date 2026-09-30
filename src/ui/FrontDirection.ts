/** World headings use +Z for south, not the camera's current screen direction. */
export const FRONT_DIRECTIONS=[
  {id:'north',label:'North',angle:Math.PI},
  {id:'east',label:'East',angle:Math.PI/2},
  {id:'south',label:'South',angle:0},
  {id:'west',label:'West',angle:-Math.PI/2},
] as const;

export function sameFacing(a:number,b:number):boolean {
  return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<.001;
}

/** Saved/authored headings may use either signed or positive full-turn angles.
 * Never display an unmatched/custom heading as the first cardinal direction. */
export function frontDirection(fronts:readonly number[]):{label:string;selected?:string} {
  if(!fronts.length)return {label:'Unassigned'};
  if(fronts.some(front=>!sameFacing(front,fronts[0])))return {label:'Mixed'};
  const direction=FRONT_DIRECTIONS.find(d=>sameFacing(d.angle,fronts[0]));
  if(direction)return {label:direction.label,selected:direction.id};
  const bearing=((Math.round(180-fronts[0]*180/Math.PI)%360)+360)%360;
  return {label:`Custom · ${String(bearing).padStart(3,'0')}°`};
}
