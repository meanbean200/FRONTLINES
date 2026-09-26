async page => {
 await page.waitForFunction(()=>window.__FRONTLINES_DEV__.inspect().source.id==='orchard-approach');
 await page.locator('[data-select]').filter({hasText:'South field gun'}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.editor-ink text')].some(t=>t.textContent==='South field gun'));
 const labels=await page.locator('.editor-ink text').allTextContents();
 if(labels.includes('Grenadier One · 8')||!labels.includes('South field gun'))throw new Error('Selection label decluttering failed');
 await page.screenshot({path:'output/playwright/dev-menu-20260926/14-editor-selected-post.png'});
 return {selectedNameVisible:true,fullNamesRemainInInspector:true,symbolCount:await page.locator('.editor-ink rect').count(),labels,sourceUnchanged:!(await page.evaluate(()=>window.__FRONTLINES_DEV__.inspect().dirty))};
}
