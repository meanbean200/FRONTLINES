export interface MapLabel {text:string;x:number;y:number;width:number;height:number;priority:number;font:string;color:string}
export interface PlacedMapLabel extends MapLabel {left:number;top:number}
/** Presentation-only deconfliction. Text stays near its map anchor; low-priority
 * labels may be omitted at full-sector scale instead of overlapping neighbors. */
export function placeMapLabels(labels:MapLabel[],width:number,height:number,gap=4):PlacedMapLabel[]{
  const placed:PlacedMapLabel[]=[];
  for(const label of [...labels].sort((a,b)=>b.priority-a.priority)){
    const h=label.height;
    for(const [dx,dy] of [[0,0],[0,-h-gap],[0,h+gap],[0,-2*(h+gap)],[0,2*(h+gap)]]){
      const candidate={...label,left:label.x+dx-label.width/2,top:label.y+dy-h};
      if(candidate.left<gap||candidate.top<gap||candidate.left+label.width>width-gap||candidate.top+h>height-gap)continue;
      if(placed.some(p=>candidate.left<p.left+p.width+gap&&candidate.left+candidate.width+gap>p.left&&candidate.top<p.top+p.height+gap&&candidate.top+h+gap>p.top))continue;
      placed.push(candidate);break;
    }
  }
  return placed;
}
