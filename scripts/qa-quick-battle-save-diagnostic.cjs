async(page)=>{return page.evaluate(async()=>{
  const state=JSON.parse(localStorage.getItem('frontlines-battlefield-v3-world2-4km'));
  const {placeOperation}=await import('http://127.0.0.1:4173/src/operations/OperationPlacement.ts');
  const {SaveSystem}=await import('http://127.0.0.1:4173/src/persistence/SaveSystem.ts');
  const {validOperationalRuntime}=await import('http://127.0.0.1:4173/src/operations/OperationalValidation.ts');
  const expected=placeOperation(state.operation.mode,state.seed,state.operation.setup),r=state.operation.runtime,differences=[];
  function compare(a,b,path){if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[key],b[key],path+'.'+key);}else differences.push({path,a,b});}
  for(const key of ['front','zones','locations','routes','reinforcements','objectives','victory'])compare(r[key],expected[key],key);
  let parsed;try{new SaveSystem().parse(JSON.stringify(state));parsed=true;}catch(e){parsed=String(e);}
  return {parsed,operational:validOperationalRuntime(state),differences:differences.slice(0,20)};
});}
