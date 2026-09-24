async(page)=>{
 const prefix='output/playwright/world-rebase/geography-r2',errors=[];
 await page.reload();await page.setViewportSize({width:1920,height:1080});page.on('pageerror',e=>errors.push(e.message));
 await page.locator('[data-mode-choice="campaign"]').click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();
 await page.waitForFunction(()=>{const a=window.__FRONTLINES__,c=a.getVisualStats().cameraTarget,p=a.getState().operation.objectives[0];return Math.hypot(c.x-p.x,c.z-p.z)<1;});await page.waitForTimeout(700);
 await page.screenshot({path:prefix+'-campaign.png'});
 await page.locator('#map-expand').click();await page.locator('button[data-scale="theater"]').click();await page.screenshot({path:prefix+'-theater.png'});
 // The east road's river intersection. Use the actual map click to reach it.
 let z=-720,x=0;for(let i=0;i<20;i++){x=1330+Math.sin(z/650)*100;z=-720+Math.sin((x+600)/760)*310+Math.sin(x/240)*55;}
 const box=await page.locator('.field-map canvas').boundingBox();await page.mouse.click(box.x+box.width*(x/4000+.5),box.y+box.height*(z/4000+.5));
 await page.waitForFunction(p=>{const c=window.__FRONTLINES__.getVisualStats().cameraTarget;return Math.hypot(c.x-p.x,c.z-p.z)<1;},{x,z});
 await page.mouse.move(960,600);await page.mouse.wheel(0,-1500);await page.waitForFunction(p=>{const t=window.__FRONTLINES__.terrainProbe(p.x,p.z);return Math.abs(t.rendered-t.sampled)<.1;},{x,z});await page.waitForTimeout(500);await page.screenshot({path:prefix+'-crossing.png'});
 const crossing=await page.evaluate(p=>window.__FRONTLINES__.terrainProbe(p.x,p.z),{x,z});
 await page.locator('[data-objective="1"]').click();await page.waitForFunction(()=>{const a=window.__FRONTLINES__,c=a.getVisualStats().cameraTarget,p=a.getState().operation.objectives[1];return Math.hypot(c.x-p.x,c.z-p.z)<1;});await page.waitForTimeout(700);await page.screenshot({path:prefix+'-saint-martin.png'});
 return {scope:'Actual Edge map, zoom and objective controls; terrain ray readback only, no world edits',crossing,errors};
}
