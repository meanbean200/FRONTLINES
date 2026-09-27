async page => {
 await page.goto('http://127.0.0.1:4176/dev.html');
 await page.setViewportSize({width:1654,height:910});
 await page.getByText('Document / folder',{exact:true}).click();
 await page.locator('#project-folder').click();
 await page.locator('#import').setInputFiles('content/scenarios/road-cut-redoubts.json');
 await page.waitForFunction(()=>window.__FRONTLINES_DEV__.inspect().source.id==='road-cut-redoubts');
 await page.locator('[data-select="west"]').click();
 await page.getByLabel('Defensive front (degrees)').fill('80');
 await page.getByLabel('Defensive front (degrees)').press('Tab');
 await page.waitForFunction(()=>window.__FRONTLINES_DEV__.inspect().source.entities.find(e=>e.id==='west').front===80);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.getByRole('button',{name:'Go to opening view'}).click();
 await page.screenshot({path:'output/road-cut/author-front.png'});
 await page.getByRole('button',{name:'Play Test',exact:true}).click();
 await page.waitForFunction(()=>window.__FRONTLINES_DEV__.inspect().runtime.elapsed>=20,{},{timeout:60000});
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.screenshot({path:'output/road-cut/play-20s.png'});
 const d=await page.evaluate(()=>window.__FRONTLINES_DEV__.inspect());
 await page.evaluate(d=>{window.__ROAD_CUT_QA__={source:d.source.id,dirty:d.dirty,elapsed:d.runtime.elapsed,shots:d.runtime.operation.shots,fronts:d.runtime.living.garrisons.map(g=>({name:g.name,front:g.front,readiness:g.readiness})),guns:d.runtime.living.facilities.filter(f=>f.installation).map(f=>({kind:f.installation.kind,loaded:f.installation.weapon?.loaded,stock:f.stock.ammo})),ownership:d.ownership};},d);
}
