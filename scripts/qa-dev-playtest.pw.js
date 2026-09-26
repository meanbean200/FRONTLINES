// Run against the reopened orchard-editor-review draft in DEV. No runtime injection.
async page=>{
 const read=()=>page.evaluate(()=>window.__FRONTLINES_DEV__.inspect());
 const source=JSON.stringify((await read()).source),result={sourceId:(await read()).source.id};
 const record=()=>page.evaluate(r=>{window.__DEV_PLAY_QA__=r;},result);
 await page.locator('#play').click();await page.locator('#test-speed').click();
 await page.waitForFunction(()=>window.__FRONTLINES_DEV__.inspect().runtime.elapsed>=15);
 await page.locator('#test-pause').click();let d=await read();
 result.running={elapsed:d.runtime.elapsed,shots:d.runtime.operation.shots,sourceUnchanged:JSON.stringify(d.source)===source,ownership:d.ownership,plans:d.runtime.operation.authored.memories,positions:d.runtime.squads.map(q=>({name:q.name,x:q.x,z:q.z,order:q.order.type}))};
 await record();
 await page.screenshot({path:'output/playwright/dev-production-test-paused.png'});
 await page.locator('.file-menu summary').click();await page.locator('#reset').click();
 d=await read();result.reset={elapsed:d.runtime.elapsed,sourceUnchanged:JSON.stringify(d.source)===source,ownership:d.ownership};
 await page.locator('#play').click();d=await read();result.stopped={sourceUnchanged:JSON.stringify(d.source)===source,ownership:d.ownership,metrics:d.metrics};
 await record();
 if(!result.running.sourceUnchanged||!result.reset.sourceUnchanged||!result.stopped.sourceUnchanged||d.ownership.active!==0)throw new Error('Source or session isolation failed');
 // Explicit map assignment; source identity remains unchanged after undo.
 await page.locator('[data-select=formation-6]').click();await page.locator('#pick-target').click();
 const flag=await page.locator('[data-entity=objective-3] rect').boundingBox();await page.mouse.click(flag.x+16,flag.y+13);
 await page.locator('#deselect').click();await page.locator('[data-select=facility-17]').click();
 const post=await page.locator('[data-entity=facility-17] rect').boundingBox();
 await page.mouse.move(post.x+16,post.y+13);await page.mouse.down();await page.mouse.move(post.x+16,post.y+74,{steps:10});await page.mouse.up();
 await page.locator('#validate').click();result.offFloor=await page.locator('.validation').innerText();await page.locator('#close-validation').click();
 if(!result.offFloor.includes('Off the parent trench floor'))throw Error('Off-floor defect was not exercised');
 await page.locator('#snap-post').click();await page.locator('#validate').click();result.snapped=await page.locator('.validation').innerText();await page.locator('#close-validation').click();
 if(result.snapped.includes('Off the parent trench floor'))throw Error('Explicit Snap did not repair the post');
 await page.locator('#undo').click();await page.locator('#undo').click();
 result.afterUndo=JSON.stringify((await read()).source)===source;
 await record();
}
