async (page) => {
  await page.bringToFront();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  await page.getByRole('button',{name:'5×',exact:true}).click();
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().operation.status!=='active',{}, {timeout:45000});
  await page.getByRole('heading',{name:/Sector secured|Operation ended/}).waitFor();
  await page.screenshot({path:'output/playwright/combat-offensive-result-r1.png'});
  const result=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),perf:window.__FRONTLINES__.getPerf(),saved:localStorage.getItem('frontlines-battlefield-v2')}));
  if(result.saved!==saved)throw Error('Operation overwrote the isolated mid-combat save');
  return {scope:'Ordinary UI offensive with drawn routes, no synthetic positioning',checks:{finished:result.state.operation.status,elapsed:result.state.elapsed,savedUnchanged:true,shots:result.state.operation.shots,hits:result.state.operation.hits},result};
}
