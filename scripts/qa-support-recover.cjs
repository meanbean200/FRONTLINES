async(page)=>{
 const state=await page.evaluate(()=>window.__FRONTLINES__.getState()),missions=state.operation.supportMissions;
 await page.screenshot({path:'output/playwright/combat-v3-support-recovered.png'});
 return {scope:'Recover final state of actual-control support probe after the CLI returned early on a friendly-risk confirm dialog. The first warning was observed in CLI output; the probe dismissed it and completed three later missions.',state,checks:{onlyThreeMissions:missions.length===3,firstUnsafeTargetNotLaunched:missions.every(m=>Math.abs(m.target.z+1317.1319628871795)>1),HE:state.living.ledger.consumed.mortarHE===1,mortarSmoke:state.living.ledger.consumed.mortarSmoke===1,grenade:state.living.ledger.consumed.smokeGrenades===1,clouds:state.operation.smokeFields.length===2,allComplete:missions.every(m=>m.stage==='complete')}};
}
