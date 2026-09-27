async page => {
  await page.getByRole('button',{name:'Map',exact:true}).click();
  await page.getByRole('button',{name:'Full sector',exact:true}).click();
  const map=page.getByLabel('Terrain, roads, settlements, trenches and known formations'),box=await map.boundingBox();
  const world=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const pixel=p=>({x:box.x+(p.x/4000+.5)*box.width,y:box.y+(p.z/4000+.5)*box.height});
  const squads=world.squads.filter(q=>q.faction!=='enemy'&&['Baker','Easy'].includes(q.name));
  for(const [i,q] of squads.entries()){const p=pixel(q);if(i)await page.keyboard.down('Shift');await page.mouse.click(p.x,p.y);if(i)await page.keyboard.up('Shift');}
  const destination=pixel({x:-100,z:-150});await page.mouse.click(destination.x,destination.y,{button:'right'});
  await page.mouse.dblclick(destination.x,destination.y);
  await page.getByRole('button',{name:'5×',exact:true}).click();
  await page.screenshot({path:'output/playwright/delta/town-approach.png'});
  return await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {elapsed:s.elapsed,speed:s.simSpeed,selected:window.__FRONTLINES__.getSummary().selected,squads:s.squads.filter(q=>['Baker','Easy'].includes(q.name)).map(q=>({name:q.name,order:q.order,route:q.route})),town:s.operation.objectives[0]};});
}
