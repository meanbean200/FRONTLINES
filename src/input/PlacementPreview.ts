export function boundedIndicator(a:{x:number;y:number},b:{x:number;y:number},maximum=80){
  const length=Math.hypot(b.x-a.x,b.y-a.y),scale=length>maximum?maximum/length:1;
  return {x:a.x+(b.x-a.x)*scale,y:a.y+(b.y-a.y)*scale};
}
export function materialPreview(available:number,required:number):string{
  const missing=Math.max(0,Math.ceil(required-available));
  return `Materials: ${Math.floor(available)} / ${required}${missing?` · ${missing} more required`:' · supplied'}`;
}
