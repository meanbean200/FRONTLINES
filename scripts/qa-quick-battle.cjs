async (page) => {
  const out=`output/playwright/quick-battle/flow-${Date.now()}-`,errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1920,height:1080});await page.reload();
  await page.locator('#launch-operation').waitFor();
  const initialStorage=await page.evaluate(()=>Object.keys(localStorage));
  await page.screenshot({path:out+'01-quick-battle.png'});
  const began=Date.now();await page.locator('#launch-operation').click();
  const briefing=await page.locator('.battle-briefing').innerText();
  const briefingContrast=await page.evaluate(()=>{const lum=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const ink=lum(getComputedStyle(document.querySelector('.battle-briefing dd')).color),paper=lum(getComputedStyle(document.querySelector('.menu-content')).backgroundColor);return (Math.max(ink,paper)+.05)/(Math.min(ink,paper)+.05);});
  await page.screenshot({path:out+'02-briefing.png'});await page.locator('#begin-operation').click();
  await page.locator('.operation-menu').waitFor({state:'hidden'});const clickFlowMs=Date.now()-began;
  await page.locator('[data-speed="0"]').click();
  const identity=()=>page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {setup:s.operation.setup,front:s.operation.runtime.front,locations:s.operation.runtime.locations,personnel:s.soldiers.length,elapsed:s.elapsed};});
  const initial=await identity();await page.screenshot({path:out+'03-battle.png'});
  await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();
  const save=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v3-world2-4km'));
  await page.locator('#rematch-operation').click();await page.locator('#begin-operation').click();
  await page.locator('[data-speed="0"]').click();const rematch=await identity();
  await page.locator('.operation-menu-button').click();await page.locator('#change-settings').click();
  const restored=await page.locator('#sector-seed').inputValue();
  await page.locator('[data-mode-choice="open-front"]').click();await page.locator('#battle-size').selectOption('small');
  await page.locator('#battle-side').selectOption('german');await page.locator('#sector-seed').fill('1945');await page.locator('#sector-seed').press('Tab');
  await page.locator('.advanced-setup>summary').click();
  await page.locator('#setup-preset').selectOption('low-supply');await page.locator('#setup-time').selectOption('night');
  await page.locator('#setup-direction').selectOption('east');await page.locator('#setup-engineers').selectOption('2');
  await page.locator('#setup-reserves').selectOption('24');await page.locator('#setup-mortars').uncheck();await page.locator('#setup-smoke').uncheck();
  const presetName=`Night defense QA ${Date.now()}`;await page.locator('#preset-name').fill(presetName);await page.locator('#save-setup').click();
  const presetNotice=await page.locator('.menu-status').innerText();
  await page.screenshot({path:out+'04-advanced.png'});
  await page.locator('#setup-preset').selectOption('standard');await page.locator('#local-preset').selectOption({label:presetName});
  const recalled=await page.locator('#setup-time').inputValue();
  await page.locator('#launch-operation').click();const customBriefing=await page.locator('.battle-briefing').innerText();
  await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  const custom=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {setup:s.operation.setup,population:s.soldiers.length,hours:s.living.campaignHours,stock:s.living.rearStock,loadedShuttleAmmo:s.living.trucks.filter(t=>t.faction!=='enemy'&&t.role==='shuttle').reduce((n,t)=>n+t.cargo.ammo,0),manifest:s.living.logistics.manifest,reserve:s.operation.campaign.replacements.reserve,mortars:s.squads.filter(q=>q.kind==='mortar').length,engineers:s.squads.filter(q=>q.kind==='engineer').length,weapon:s.soldiers.find(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player')?.combat?.weapon?.id};});
  await page.screenshot({path:out+'05-night-battle.png'});
  const preserved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v3-world2-4km'))===save;
  await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();
  const savedCustom=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v3-world2-4km')));
  await page.reload();await page.locator('#continue-save').click();await page.locator('.operation-menu').waitFor({state:'hidden'});
  const loaded=await identity();await page.locator('.operation-menu-button').click();await page.locator('#choose-operation').click();
  const defaults=await page.evaluate(()=>({size:document.querySelector('#battle-size').value,side:document.querySelector('#battle-side').value,map:document.querySelector('#battle-map').value,advanced:document.querySelector('.advanced-setup').open}));
  const modes=[];
  for(const mode of ['line-defense','meeting']){
    await page.locator(`[data-mode-choice="${mode}"]`).click();await page.locator('#battle-size').selectOption('large');await page.locator('#battle-side').selectOption('random');
    await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
    modes.push(await identity());await page.locator('.operation-menu-button').click();await page.locator('#choose-operation').click();
  }
  const layouts=[];
  for(const size of [{width:2560,height:1440},{width:1280,height:720},{width:960,height:600}]){
    await page.setViewportSize(size);await page.screenshot({path:`${out}06-setup-${size.width}.png`});
    layouts.push(await page.evaluate(()=>{const d=document.querySelector('.operation-menu'),b=d.getBoundingClientRect();return {width:innerWidth,height:innerHeight,centered:Math.abs(b.x+b.width/2-innerWidth/2)<2,fits:b.right<=innerWidth&&b.bottom<=innerHeight,noHorizontalOverflow:d.scrollWidth<=d.clientWidth};}));
  }
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('0');await page.locator('#launch-operation').click();
  const invalidBlocked=await page.locator('#sector-seed').evaluate(el=>!el.validity.valid)&&await page.locator('#begin-operation').count()===0;
  await page.locator('#sector-seed').fill('1944');await page.locator('#sector-seed').press('Tab');
  await page.locator('#launch-operation').click();await page.screenshot({path:out+'07-briefing-960.png'});
  await page.keyboard.press('Escape');const escapeBack=await page.locator('#launch-operation').isVisible();
  return {scope:'Actual Edge controls; diagnostic state reads only; isolated QA storage',screenshots:out,bundle:await page.locator('script[type="module"]').getAttribute('src'),briefingContrast,initialStorage,briefing,clickFlowMs,initial,rematch,restored,presetNotice,recalled,customBriefing,custom,preserved,loaded,defaults,modes,layouts,errors,
    checks:{defaultFlow:initial.setup.operation==='breakthrough'&&initial.setup.size==='medium'&&clickFlowMs<20000,briefingReadable:briefingContrast>=4.5,rematch:JSON.stringify(initial.setup)===JSON.stringify(rematch.setup)&&JSON.stringify(initial.front)===JSON.stringify(rematch.front)&&JSON.stringify(initial.locations)===JSON.stringify(rematch.locations),previousSettings:restored===String(initial.setup.seed),presets:recalled==='night'&&presetNotice.includes('Saved'),customApplied:custom.setup.side==='german'&&custom.population===74&&custom.engineers===4&&custom.mortars===0&&custom.reserve.player===24&&custom.manifest.smokeGrenades===0&&custom.stock.ammo+custom.loadedShuttleAmmo===500,savePreserved:preserved,loadExact:loaded.elapsed===savedCustom.elapsed&&JSON.stringify(loaded.setup)===JSON.stringify(savedCustom.operation.setup),newBattleDefaults:defaults.size==='medium'&&defaults.side==='us'&&defaults.map==='random'&&!defaults.advanced,allModes:modes.map(m=>m.setup.operation).join(',')==='line-defense,meeting',responsive:layouts.every(l=>l.centered&&l.fits&&l.noHorizontalOverflow),invalidBlocked,escapeBack,noPageErrors:errors.length===0}};
}
