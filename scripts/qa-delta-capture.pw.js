async page => {
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.getByRole('button',{name:'Map',exact:true}).click();
  await page.getByRole('button',{name:'Full sector',exact:true}).click();
  const map=page.getByLabel('Terrain, roads, settlements, trenches and known formations'),b=await map.boundingBox();
  await page.mouse.dblclick(b.x+b.width*.5,b.y+b.height*(.5-80/4000));
  await page.waitForFunction(()=>{const p=window.__FRONTLINES__.getVisualStats().cameraTarget;return Math.hypot(p.x,p.z+80)<10;});
  const p=await page.evaluate(()=>window.__FRONTLINES__.projectWorld(0,-80,7));await page.mouse.click(p.x,p.y);
  await page.getByRole('heading',{name:'SAINT-MARTIN',exact:true}).waitFor();
  await page.screenshot({path:'output/playwright/delta/saint-martin-secured.png'});
  return await page.locator('#trench-panel').innerText();
}
