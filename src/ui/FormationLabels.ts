export interface FormationAnchor {id:number;x:number;y:number}
const offsets:{x:number;y:number}[]=[];
for(let row=-5;row<=5;row++)for(let col=-5;col<=5;col++)offsets.push({x:col*66,y:row*58});
offsets.sort((a,b)=>a.x*a.x+a.y*a.y-b.x*b.x-b.y*b.y||a.y-b.y||a.x-b.x);
/** Small map-label displacements, never a simulation waypoint. Stable roster
 * order and current-frame anchors keep nearby symbols selectable while panning. */
export function formationLabels(anchors:FormationAnchor[],width:number,height:number,reserved:{x:number;y:number;width:number;height:number}[]=[]):FormationAnchor[]{
  const placed:FormationAnchor[]=[];
  for(const anchor of anchors){
    const fit=(p:FormationAnchor)=>p.x>=34&&p.x<=width-34&&p.y>=50&&p.y<=height-22&&!placed.some(o=>Math.abs(o.x-p.x)<64&&Math.abs(o.y-p.y)<56)&&!reserved.some(r=>p.x+34>r.x-r.width/2&&p.x-34<r.x+r.width/2&&p.y+18>r.y-r.height&&p.y-44<r.y);
    let candidate:FormationAnchor|undefined;
    for(const d of offsets){const p={...anchor,x:anchor.x+d.x,y:anchor.y+d.y};if(fit(p)){candidate=p;break;}}
    // Do not hide formations if an extreme stress scene exhausts label space.
    placed.push(candidate??anchor);
  }
  return placed;
}
