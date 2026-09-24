async(page)=>{
  const loaded=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const stored=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  const expected=JSON.parse(stored),diffs=[];
  const compare=(a,b,path)=>{
    if(a&&b&&typeof a==='object'&&typeof b==='object'){
      for(const key of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[key],b[key],path+'.'+key);
    }else if(a!==b)diffs.push({path,expected:a,actual:b});
  };
  compare(expected,loaded,'state');
  await page.screenshot({path:'output/playwright/engineer-depth-restore-inspect-r1.png'});
  return {checks:{diffs,storedElapsed:expected.elapsed,loadedElapsed:loaded.elapsed},stored,loaded};
}
