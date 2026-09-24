async (page) => {
  await page.bringToFront();
  await page.waitForFunction(() => !document.querySelector('.tactical-overlay').classList.contains('camera-moving'));
  await page.getByRole('button', {name:/^× Able /}).click();
  await page.getByRole('button', {name:/^× Baker /}).click({modifiers:['Shift']});
  const draw = async (points) => {
    const screen = await page.evaluate(points => points.map(p => window.__FRONTLINES__.projectWorld(p.x,p.z)),points);
    if(screen.some(p=>!p.visible)) throw Error('Route outside camera');
    await page.mouse.move(screen[0].x,screen[0].y);
    await page.mouse.down({button:'right'});
    for(const p of screen.slice(1)) await page.mouse.move(p.x,p.y,{steps:12});
    await page.mouse.up({button:'right'});
  };
  await draw([{x:-1280,z:-1450},{x:-1245,z:-1420},{x:-1210,z:-1400}]);
  await page.getByRole('button', {name:/^× Charlie /}).click();
  await page.getByRole('button', {name:/^× Dog /}).click({modifiers:['Shift']});
  await page.getByRole('button', {name:/^× Easy /}).click({modifiers:['Shift']});
  await draw([{x:-1240,z:-1460},{x:-1230,z:-1320},{x:-1100,z:-1310},{x:-1070,z:-1332}]);
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().squads.filter(s=>s.faction==='player'&&s.kind==='rifle').every(s=>s.order.type==='move'&&s.route.length>0));
  const initial=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),saved:localStorage.getItem('frontlines-battlefield-v2')}));
  await page.screenshot({path:'output/playwright/combat-orders-r1.png'});
  await page.getByRole('button',{name:'5×',exact:true}).click();
  return {scope:'Ordinary UI roster selection and two right-drawn routes; no state fixtures',initial};
}
