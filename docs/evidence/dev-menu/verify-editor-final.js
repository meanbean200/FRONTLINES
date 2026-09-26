async page => {
 const inspect=()=>page.evaluate(()=>window.__FRONTLINES_DEV__.inspect());
 const initial=JSON.stringify((await inspect()).source),timeOrigin=await page.evaluate(()=>performance.timeOrigin);
 let release;
 const blocked=new Promise(resolve=>{release=resolve;});
 await page.route('**/__frontlines_dev/folder',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='save')await blocked;await route.continue();});
 await page.locator('#save').click();
 if(!await page.locator('.tool-rail').evaluate(el=>el.inert))throw new Error('Editing not locked while saving');
 await page.keyboard.press('Control+z');await page.mouse.click(700,400);
 if(JSON.stringify((await inspect()).source)!==initial)throw new Error('Pending save allowed source edits');
 release();await page.waitForFunction(()=>!document.querySelector('#save').disabled);
 await page.unroute('**/__frontlines_dev/folder');
 await page.locator('#play').click();await page.waitForFunction(()=>window.__FRONTLINES_DEV__.inspect().runtime.elapsed>2);
 if(!(await inspect()).playing)throw new Error('Play Test did not launch');
 await page.locator('#play').click();
 await page.locator('#publish').click();await page.getByText(/Published The Orchard Approach for the title screen/).waitFor();
 if(JSON.stringify((await inspect()).source)!==initial||(await inspect()).dirty)throw new Error('Source changed or remained dirty');
 if(await page.evaluate(()=>performance.timeOrigin)!==timeOrigin)throw new Error('Publication reloaded the editor');
 await page.screenshot({path:'output/playwright/dev-menu-20260926/12-final-editor.png'});
 return {reopened:true,saveLockedEdits:true,realPlayStop:true,published:true,sourceUnchanged:true,editorNotReloaded:true,workers:page.workers().length,owner:(await inspect()).ownership};
}
