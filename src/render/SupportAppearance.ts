import type {Facility} from '../garrison/types';
import type {TrenchState} from '../core/types';
import {facilityFrame,facilityPoint,emplacementBoxes} from '../terrain/SupportGeometry';

export interface SupportPart {x:number;y:number;z:number;sx:number;sy:number;sz:number;color:number;angle:number;pitch?:number}
/** Small construction details only; no fake weapons, supplies or cover bonuses. */
export function supportAppearance(f:Facility,connector:TrenchState|undefined,height:(x:number,z:number)=>number,detail=true):SupportPart[]{
  const out:SupportPart[]=[],frame=facilityFrame(f,connector),progress=Math.max(0,Math.min(1,f.progress));
  const wood=0x75634c,darkWood=0x4f4737,canvas=0x77785b,steel=0x484d43;
  const add=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number,angle=frame.angle)=>out.push({x,y,z,sx,sy,sz,color,angle});
  const at=(x:number,z:number)=>{const p=facilityPoint(frame,x,z);return {...p,h:height(p.x,p.z)};};
  const grounded=(x:number,z:number,sx:number,sy:number,sz:number,color:number,offset=0)=>{const p=at(x,z);add(p.x,p.h+offset+sy/2,p.z,sx,sy,sz,color);};
  // Survey pegs and available material stacks precede structural work.
  if(progress===0){for(const x of [-2.65,2.65])for(const z of [-2.65,2.65])grounded(x,z,.12,.8,.12,0xc1af78);return out;}
  const gun=f.kind==='emplacement'||f.kind==='mortar';
  if(gun&&progress===1){
    for(const b of emplacementBoxes(f)){
      const base=height(f.x,f.z),c=Math.cos(b.angle),s=Math.sin(b.angle);
      add(b.x,base+b.y,b.z,b.rx*2,b.ry*2,b.rz*2,0x716a4e,b.angle);
      if(!detail)continue;
      const alongX=b.rx>b.rz,length=(alongX?b.rx:b.rz)*2,n=Math.ceil(length/.8),step=length/n;
      for(let row=0;row<3;row++)for(let i=0;i<n;i++){
        const offset=-length/2+(i+.5)*step,xx=alongX?offset:0,zz=alongX?0:offset;
        // Bags sit within the authoritative earth volume, not outside its cover boundary.
        add(b.x+xx*c+zz*s,base+.17+row*.32,b.z-xx*s+zz*c,alongX?step*.96:b.rx*2,.29,alongX?b.rz*2:step*.96,((i+row+f.id)%3)?0xaaa080:0x92886c,b.angle);
      }
    }
    // Open gun pits get a small slatted platform, not a roof over a mortar.
    for(let i=0;i<(detail?7:1);i++)grounded(-.8+i*(detail?.26:0),-.8,detail?.22:1.8,.07,1.8,darkWood,.015);
    return out;
  }
  // Short revetment panels conform to the earth at every support. Entrance faces the connector.
  const rows=detail?8:3,panel=5.2/rows,wallHeight=.35+1.15*progress;
  for(const side of [-1,1])for(let i=0;i<rows;i++){
    const z=-2.6+(i+.5)*panel;grounded(side*2.65,z,.15,wallHeight,panel*.96,i%2?wood:darkWood);
  }
  for(let i=0;i<rows;i++)grounded(-2.6+(i+.5)*panel,2.65,panel*.96,wallHeight,.15,i%2?wood:darkWood);
  for(const side of [-1,1])for(const z of [-2.55,0,2.55])grounded(side*2.48,z,.19,wallHeight+.15,.19,0x514937);
  // Timber headers over the access lane distinguish an engineered bay from a box.
  if(progress>.5){const p=at(0,-2.35),left=at(-2.45,-2.35),right=at(2.45,-2.35),top=Math.max(left.h,right.h)+1.75;
    for(const v of [left,right])add(v.x,(top+v.h)/2,v.z,.21,top-v.h,.21,wood);
    add(p.x,top,p.z,5.1,.2,.23,wood);
  }
  if(progress<1)return out;
  const cot=(x:number,z:number,medical=false)=>{
    const p=at(x,z),top=Math.max(...[-.38,.38].flatMap(dx=>[-.65,.65].map(dz=>at(x+dx,z+dz).h)))+.28;
    add(p.x,top,p.z,.76,.16,1.35,medical?0xaaa991:canvas);if(!detail)return;
    for(const dx of [-.31,.31])for(const dz of [-.52,.52]){const leg=at(x+dx,z+dz);add(leg.x,(leg.h+top)/2,leg.z,.065,Math.max(.06,top-leg.h),.065,darkWood);}
    const pillow=at(x,z+.44);add(pillow.x,top+.13,pillow.z,.58,.13,.28,medical?0xc2c1aa:0x959880);
  };
  if(f.kind==='rest'){
    for(let i=0;i<9;i++)if(i!==4)cot((i%3-1)*1.8,(Math.floor(i/3)-1)*1.8);
    // An open inspection model: transverse roof timbers, no opaque pretend shelter.
    for(const z of [-1.5,1.5]){const a=at(-2.45,z),b=at(2.45,z),p=at(0,z);add(p.x,Math.max(a.h,b.h)+1.7,p.z,5,.18,.22,darkWood);}
  }else if(f.kind==='aid'){
    for(const x of [-1.35,1.35])for(const z of [-1.15,1.15])cot(x,z,true);
    const sign=at(0,2.73);add(sign.x,sign.h+1.15,sign.z,1,.9,.06,0xe2dfcb);
    const face=facilityPoint(frame,0,2.78);add(face.x,sign.h+1.15,face.z,.19,.66,.025,0x913f35);add(face.x,sign.h+1.15,face.z,.65,.19,.025,0x913f35);
  }else if(f.kind==='meal'){
    const p=at(0,0),top=Math.max(at(-1.8,0).h,at(1.8,0).h)+.8;
    add(p.x,top,p.z,3.7,.12,1,wood);
    for(const x of [-1.45,1.45]){const leg=at(x,0);add(leg.x,(leg.h+top)/2,leg.z,.18,top-leg.h,.6,darkWood);}
    for(const z of [-1.15,1.15])grounded(0,z,3.7,.35,.35,darkWood);
    if(detail)for(const x of [-1,0,1]){const cup=at(x,0);add(cup.x,top+.14,cup.z,.17,.18,.17,steel);}
  }else{
    // Empty shelves remain empty. Visible boxes represent real stored inventory.
    for(const x of [-1.65,1.65]){
      for(const z of [-1.7,1.7])grounded(x,z,.16,1.5,.16,darkWood);
      for(const y of [.2,.85])grounded(x,0,.95,.13,3.6,wood,y);
    }
    const stock=Object.values(f.stock).reduce((a,b)=>a+b,0),crates=Math.min(10,Math.ceil(stock/20));
    for(let i=0;i<crates;i++){const x=(i%2?1:-1)*1.65,z=(Math.floor(i/2)%3-1)*1.08,p=at(x,z),y=p.h+.6+(i>5?.65:0);add(p.x,y,p.z,.78,.5,.8,f.kind==='ammo'?0x686c45:0x8d805d);
      if(detail)for(const dx of [-.23,.23]){const strap=at(x+dx,z);add(strap.x,y,strap.z,.045,.52,.82,0x454c3b);}
    }
  }
  return out;
}
