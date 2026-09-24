async(page)=>{
  await page.bringToFront();const result=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.getByRole('button',{name:'Inspect battlefield Esc',exact:true}).click();
  await page.keyboard.press('Space');await page.keyboard.press('h');await page.waitForTimeout(500);
  const frozen=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(result)!==JSON.stringify(frozen))throw Error('Finished battle changed under commands');
  await page.screenshot({path:'output/playwright/engineer-edge-defense-frozen-r1.png'});
  await page.getByRole('button',{name:'MENU',exact:true}).click();
  await page.getByRole('button',{name:'New operation',exact:true}).click();
  await page.getByRole('button',{name:'QUICK OPERATION 10 MIN Village offensive'}).click();
  await page.getByRole('button',{name:'Begin operation →'}).click();
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();await page.waitForTimeout(600);
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  await page.getByRole('button',{name:/^× Able /}).click();
  await page.getByRole('button',{name:/^× Baker /}).click({modifiers:['Shift']});
  const draw=async(points)=>{
    const screen=await page.evaluate(points=>points.map(p=>window.__FRONTLINES__.projectWorld(p.x,p.z)),points);
    if(screen.some(p=>!p.visible))throw Error('Route outside camera');
    await page.mouse.move(screen[0].x,screen[0].y);await page.mouse.down({button:'right'});
    for(const p of screen.slice(1))await page.mouse.move(p.x,p.y,{steps:12});
    await page.mouse.up({button:'right'});
  };
  await draw([{x:-1280,z:-1450},{x:-1245,z:-1420},{x:-1210,z:-1400}]);
  await page.getByRole('button',{name:/^× Charlie /}).click();
  await page.getByRole('button',{name:/^× Dog /}).click({modifiers:['Shift']});
  await page.getByRole('button',{name:/^× Easy /}).click({modifiers:['Shift']});
  await draw([{x:-1240,z:-1460},{x:-1230,z:-1320},{x:-1100,z:-1310},{x:-1070,z:-1332}]);
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().squads.filter(q=>q.faction==='player'&&q.kind==='rifle').every(q=>q.order.type==='move'&&q.route.length));
  await page.screenshot({path:'output/playwright/engineer-edge-offense-orders-r1.png'});
  return {checks:{defenseFrozen:true,drawnOrders:5,saveUnchanged:saved===await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'))},result,frozen,state:await page.evaluate(()=>window.__FRONTLINES__.getState()),saved};
}
