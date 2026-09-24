async(page)=>{
  await page.bringToFront();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  await page.getByRole('button',{name:'MENU',exact:true}).click();
  await page.getByRole('button',{name:'DEFENSIVE OPERATION 15 MIN Hold the crossroads'}).click();
  await page.getByRole('button',{name:'Begin operation →'}).click();
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  for(const [i,name] of ['Able','Baker','Charlie','Dog','Easy'].entries())await page.getByRole('button',{name:new RegExp('^× '+name+' ')}).click(i?{modifiers:['Shift']}:{});
  await page.getByRole('button',{name:/Defend trench/}).click();
  await page.getByRole('combobox',{name:'Front',exact:true}).selectOption({label:'East'});
  await page.getByText('TRENCH COMMAND',{exact:true}).click();
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(before.squads.filter(q=>q.faction==='player'&&q.kind==='rifle').some(q=>q.order.type!=='occupy-trench'))throw Error('Defensive garrison order rejected');
  await page.getByRole('button',{name:'5×',exact:true}).click();const samples=[];
  for(let i=0;i<30;i++){
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {at:s.elapsed,operation:s.operation,alarm:document.querySelector('#garrison-summary').textContent};}));
    if(samples.at(-1).operation.status!=='active')break;
  }
  if(samples.at(-1).operation.status==='active')await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.waitForTimeout(150);await page.screenshot({path:'output/playwright/engineer-edge-defense-contact-r1.png'});
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  return {checks:{mode:after.operation.mode,status:after.operation.status,at:after.elapsed,saveUnchanged:saved===await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'))},before,samples,after};
}
