async page => {
 const inspect=()=>page.evaluate(()=>window.__FRONTLINES_DEV__.inspect());
 const circle=async(last=false)=>{await page.waitForFunction(()=>document.querySelector('.editor-ink circle'));return page.locator('.editor-ink').evaluate((svg,last)=>{const all=svg.querySelectorAll('circle'),r=all[last?all.length-1:0].getBoundingClientRect();return {x:r.x,y:r.y};},last);};
 const initial=JSON.stringify((await inspect()).source);
 const select=async(name)=>{if(await page.locator('#deselect').count())await page.locator('#deselect').click();await page.locator('[data-select]').filter({hasText:name}).click();};
 await select('South orchard line');
 const count=(await inspect()).source.entities.length;
 await page.locator('#branch').click();
 const node=await circle();
 if(!node)throw new Error('Missing visual trench controls');
 await page.mouse.move(node.x+5,node.y+5);await page.mouse.down();await page.mouse.move(node.x-45,node.y+80,{steps:8});await page.mouse.up();
 if((await inspect()).source.entities.length!==count+1)throw new Error('Branch not authored');
 await page.locator('#undo').click();if(JSON.stringify((await inspect()).source)!==initial)throw new Error('Undo did not restore exact document');
 await page.locator('#redo').click();
 const branched=(await inspect()).source,branch=branched.entities.at(-1),branchName=branch.name;
 await select(branchName);await page.locator('#extend').click();
 const end=await circle(true);
 await page.mouse.move(end.x+5,end.y+5);await page.mouse.down();await page.mouse.move(end.x+45,end.y+40,{steps:6});await page.mouse.up();
 if((await inspect()).source.entities.at(-1).points.length<=branch.points.length)throw new Error('Extend failed');
 await page.locator('[data-tool="select"]').click();
 const last=await circle(true);
 const beforeShape=JSON.stringify((await inspect()).source);
 await page.mouse.move(last.x+5,last.y+5);await page.mouse.down();await page.mouse.move(last.x+22,last.y+18,{steps:5});await page.mouse.up();
 if(JSON.stringify((await inspect()).source)===beforeShape)throw new Error('Visual reshape did not change source');
 await page.locator('#duplicate-item').click();if((await inspect()).source.entities.length!==count+2)throw new Error('Item duplication failed');
 await page.locator('#delete-item').click();if((await inspect()).source.entities.length!==count+1)throw new Error('Item delete failed');
 await page.screenshot({path:'output/playwright/dev-menu-20260926/06-editor-branch-reshape.png'});
 await page.route('**/__frontlines_dev/folder',async route=>{const request=route.request();if(request.method()==='POST'&&request.postDataJSON().action==='save')return route.fulfill({status:507,contentType:'application/json',body:JSON.stringify({error:'Test: destination is full'})});return route.continue();});
 await page.locator('#save').click();await page.getByText('Test: destination is full · document retained',{exact:true}).waitFor();
 if(!(await inspect()).dirty)throw new Error('Failed save incorrectly cleared dirty state');
 await page.screenshot({path:'output/playwright/dev-menu-20260926/07-save-failure-document-retained.png'});
 await page.unroute('**/__frontlines_dev/folder');await page.locator('#save').click();
 await page.waitForFunction(()=>!window.__FRONTLINES_DEV__.inspect().dirty);
 const source=JSON.stringify((await inspect()).source);
 await page.locator('#play').click();
 if(!(await inspect()).playing)throw new Error('Authored branches do not pass production validation: '+await page.locator('#dev-status').innerText());
 const resets=[];
 for(let n=0;n<10;n++){
  await page.waitForFunction(()=>window.__FRONTLINES_DEV__.inspect().runtime.elapsed>.15);
  await page.locator('#reset').click();const now=await inspect();
  if(JSON.stringify(now.source)!==source||now.runtime.soldiers.length!==64||now.ownership.active!==1||now.ownership.planners!==1)throw new Error('Reset leaked source or ownership');
  resets.push({n:n+1,elapsed:now.runtime.elapsed,people:now.runtime.soldiers.length,owners:now.ownership.active,planners:now.ownership.planners,gpu:now.gpu});
 }
 await page.locator('#play').click();if(JSON.stringify((await inspect()).source)!==source)throw new Error('Stop overwrote source');
 return {branch:true,extend:true,reshape:true,itemDuplicateDelete:true,undoRedoExact:true,failedSaveDirty:true,sourcePreserved:true,resets};
}
