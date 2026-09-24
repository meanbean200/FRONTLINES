interface FloorCell {owner:number;area:number;owners?:Map<number,number>}

/** Half-metre floor-cell ownership; iteration order is part of the area sum. */
export class CapacityCells {
  private readonly cells=new Map<string,FloorCell>();
  add(x:number,z:number,owner:number,area:number):void {
    const key=`${x},${z}`,cell=this.cells.get(key);
    // Almost all floor cells have one component. Allocate the owner map only
    // for a real overlap between disconnected components, retaining first-seen
    // cell/owner order and max-per-owner union semantics.
    if(!cell){this.cells.set(key,{owner,area:Math.max(0,area)});return;}
    if(cell.owners){cell.owners.set(owner,Math.max(cell.owners.get(owner)??0,area));return;}
    if(cell.owner===owner){cell.area=Math.max(cell.area,area);return;}
    cell.owners=new Map([[cell.owner,cell.area],[owner,Math.max(0,area)]]);
  }
  areas():Map<number,number> {
    const areas=new Map<number,number>();
    for(const cell of this.cells.values()){
      if(!cell.owners){
        // Retain the original arithmetic even for a single owner: replacing
        // area*area/area with area can change floating-point rounding.
        areas.set(cell.owner,(areas.get(cell.owner)??0)+cell.area*cell.area/Math.max(1e-9,cell.area));continue;
      }
      const owners=cell.owners;let total=0,union=-Infinity;
      for(const area of owners.values()){total+=area;union=Math.max(union,area);}
      for(const [id,area] of owners)areas.set(id,(areas.get(id)??0)+union*area/Math.max(1e-9,total));
    }
    return areas;
  }
}
