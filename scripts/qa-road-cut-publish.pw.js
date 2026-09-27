async page => {
 await page.getByRole('button',{name:'Stop test',exact:true}).click();
 await page.locator('#deselect').click();
 await page.mouse.move(900,500);
 await page.mouse.wheel(0,-180);
 await page.keyboard.down('KeyA');
 await page.waitForTimeout(300);
 await page.keyboard.up('KeyA');
 await page.waitForTimeout(650);
 await page.getByRole('button',{name:'Set opening view',exact:true}).click();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByText('More ▾',{exact:true}).click();
 await page.getByRole('button',{name:'Use for title screen',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#dev-status').textContent.startsWith('Published The Road Cut'));
 await page.evaluate(()=>{const d=window.__FRONTLINES_DEV__.inspect();window.__ROAD_CUT_PUBLISH__={source:d.source,dirty:d.dirty,playing:d.playing,ownership:d.ownership};});
 await page.screenshot({path:'output/road-cut/published.png'});
}
