async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.reload();await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
 await page.waitForFunction(()=>window.__FRONTLINES__.getPerf().drawCalls>20);await page.waitForTimeout(2000);
 await page.locator('.roster-row').filter({hasText:'Able'}).dblclick();
 await page.locator('[data-speed="5"]').click();await page.waitForTimeout(30000);await page.locator('[data-speed="0"]').click();
 const state=await page.evaluate(()=>window.__FRONTLINES__.getState());
 await page.locator('.support-controls>summary').click();await page.screenshot({path:'output/playwright/combat-v3-rescue-r3.png'});
 return {scope:'Actual Edge load saved mid-treatment campaign, focus patient squad, run 5x, inspect rescue',errors,state,patient:state.soldiers.find(p=>p.id===254),tasks:state.soldiers.filter(p=>p.combat?.careTask).map(p=>({id:p.id,task:p.combat.careTask})),checks:{noPageErrors:!errors.length,stabilized:state.soldiers.find(p=>p.id===254)?.combat?.wound?.stabilized}};
}
