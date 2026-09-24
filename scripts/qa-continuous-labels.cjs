async(page)=>{
  await page.bringToFront();
  const before=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),save:localStorage.getItem('frontlines-battlefield-v2')}));
  const measure=duration=>page.evaluate(duration=>new Promise(resolve=>{
    const state=window.__FRONTLINES__.getState(),rows=[],start=performance.now();
    const anchors=state.squads.filter(q=>q.faction!=='enemy').map(q=>({selector:'.squad-marker',name:'Select '+q.name,x:q.x,z:q.z,height:3,dy:-18,kind:'squad'}));
    for(const o of state.operation?.objectives??[])anchors.push({selector:'.objective-world-label',text:o.name,x:o.x,z:o.z,height:9,dy:0,kind:'objective'});
    anchors.push({selector:'.place-name',text:'SAINT-MARTIN',x:-1070,z:-1370,height:25,dy:0,kind:'place'});
    for(const t of state.trenches){
      const lengths=t.points.slice(1).map((p,i)=>Math.hypot(p.x-t.points[i].x,p.z-t.points[i].z)),length=lengths.reduce((a,b)=>a+b,0);
      let along=t.excavation?(t.excavation.start+t.excavation.end)/2:length*t.progress/2;
      for(let i=0;i<lengths.length;i++){if(along<=lengths[i]){const u=along/lengths[i],a=t.points[i],b=t.points[i+1];anchors.push({selector:'.trench-capacity',index:state.trenches.indexOf(t),x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,height:1,dy:20,top:true,kind:'trench'});break;}along-=lengths[i];}
    }
    const frame=now=>{
      const layer=document.querySelector('.tactical-overlay'),style=getComputedStyle(layer),checks=[];
      for(const a of anchors){
        const candidates=[...document.querySelectorAll(a.selector)],el=a.name?candidates.find(e=>e.getAttribute('aria-label')===a.name):a.text?candidates.find(e=>e.textContent.includes(a.text)):candidates[a.index];
        const p=window.__FRONTLINES__.projectWorld(a.x,a.z,a.height);
        if(!el)continue;const shown=getComputedStyle(el).display!=='none';
        if(!shown){if(a.kind==='squad'&&p.visible)checks.push({kind:a.kind,missing:true,error:999});continue;}
        const rect=el.getBoundingClientRect();checks.push({kind:a.kind,x:rect.left+rect.width/2,y:a.top?rect.top:rect.bottom,error:Math.hypot(rect.left+rect.width/2-p.x,(a.top?rect.top:rect.bottom)-(p.y+a.dy))});
      }
      rows.push({ms:now-start,visible:style.visibility==='visible'&&Number(style.opacity)===1&&!layer.inert,checks});
      if(now-start>=duration)resolve(rows);else requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
  }),duration);
  const phases=[];
  const phase=async(name,action)=>{const sampling=measure(600);await action();phases.push({name,frames:await sampling});};
  await phase('pan',async()=>{await page.keyboard.down('KeyD');await page.waitForTimeout(220);await page.screenshot({path:'output/playwright/continuous-labels-pan-r1.png'});await page.keyboard.up('KeyD');});
  await phase('middle-rotate',async()=>{await page.mouse.move(800,430);await page.mouse.down({button:'middle'});await page.mouse.move(885,450,{steps:18});await page.mouse.up({button:'middle'});});
  await phase('wheel-zoom',async()=>{await page.mouse.move(800,430);await page.mouse.wheel(0,-240);});
  await phase('keyboard-rotate',async()=>{await page.keyboard.press('KeyQ');});
  await phase('focus',async()=>{await page.getByRole('button',{name:'× Able 8',exact:true}).dblclick();});
  await page.waitForTimeout(700);
  // Ordinary world-label selection remains enabled throughout camera movement.
  await page.keyboard.press('KeyQ');
  const point=await page.getByRole('button',{name:'Select Able',exact:true}).boundingBox();
  if(point)await page.mouse.click(point.x+point.width/2,point.y+point.height/2);
  const selected=await page.evaluate(()=>window.__FRONTLINES__.getSummary().selected);
  await page.screenshot({path:'output/playwright/continuous-labels-focused-r1.png'});
  await page.setViewportSize({width:1024,height:768});await page.emulateMedia({reducedMotion:'reduce'});
  await phase('small-reduced-motion',async()=>{await page.keyboard.down('KeyA');await page.waitForTimeout(220);await page.keyboard.up('KeyA');});
  await page.screenshot({path:'output/playwright/continuous-labels-small-r1.png'});
  const after=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),save:localStorage.getItem('frontlines-battlefield-v2'),bundle:[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src'))}));
  const frames=phases.flatMap(p=>p.frames),checks=frames.flatMap(f=>f.checks),maxError=Math.max(...checks.map(c=>c.error));
  return {checks:{frames:frames.length,allVisible:frames.every(f=>f.visible),maxAnchorErrorPixels:maxError,positionsChecked:checks.length,selected,simulationUnchanged:JSON.stringify(before.state)===JSON.stringify(after.state),saveUnchanged:before.save===after.save,bundle:after.bundle},phases,before,after};
}
