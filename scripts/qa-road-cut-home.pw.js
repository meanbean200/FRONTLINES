async page => {
 await page.goto('http://127.0.0.1:4175/?viewportDebug=1');
 await page.locator('#choose-operation').waitFor();
 await page.waitForFunction(()=>window.__FRONTLINES__.getSummary().elapsed>=20,{},{timeout:60000});
 const read=()=>page.evaluate(()=>({session:window.__FRONTLINES__.getSessionStats(),viewport:window.__FRONTLINES_VIEWPORT__(),state:window.__FRONTLINES__.getState()}));
 const before=await read();
 if(before.state.operation.authored.presetId!=='road-cut-redoubts'||before.state.operation.shots<30)throw Error('Title battle did not engage');
 const sizes=[];
 for(const [width,height] of [[1920,1080],[1366,768],[900,600]]){
  await page.setViewportSize({width,height});await page.reload();await page.locator('#choose-operation').waitFor();
  // Coarse chunks exist immediately; wait for both actual trench floors,
  // not merely the first few unrelated terrain-worker completions.
  await page.waitForFunction(()=>[-1565,-1490].every(x=>[-1480,-1520].every(z=>{const p=window.__FRONTLINES__.terrainProbe(x,z);return p.rendered!==undefined&&Math.abs(p.rendered-p.sampled)<.25;})));
  const d=await read();if(d.viewport.canvas.width!==width||d.viewport.canvas.height!==height||d.viewport.overflow)throw Error('Viewport mismatch');
  sizes.push({width,height,viewport:d.viewport});
  await page.screenshot({path:`output/road-cut/home-${width}.png`});
 }
 await page.setViewportSize({width:1654,height:910});
 await page.locator('#sandbox-session').click();
 await page.keyboard.press('Escape');await page.locator('#return-main').click();await page.locator('#discard-return').click();
 await page.waitForFunction(()=>window.__FRONTLINES__.getState().operation?.authored?.presetId==='road-cut-redoubts');
 const after=await read();if(after.session.active!==1||after.session.kind!=='attract')throw Error('Title session ownership mismatch');
 await page.evaluate(result=>window.__ROAD_CUT_HOME__=result,{before:{shots:before.state.operation.shots,time:before.state.elapsed,session:before.session},sizes,after:{session:after.session,time:after.state.elapsed,preset:after.state.operation.authored.presetId}});
 await page.screenshot({path:'output/road-cut/home-final.png'});
}
