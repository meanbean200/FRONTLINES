import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const [session,source,target]=process.argv.slice(2);
if(!session||!source||!target||existsSync(target)||existsSync(target+'.cjs'))throw Error('Pass session, preserved data and an unused result path.');
const payload=JSON.parse(readFileSync(source,'utf8')).evidence.session;
if(!payload.menuOpen)throw Error('This transfer expects the preserved game to be at its command menu. Do not replace an active unsaved session.');
const code=`async(page)=>{
  const payload=${JSON.stringify(payload)};
  const result=await page.evaluate(p=>{
    for(const [key,value] of Object.entries(p.storage))localStorage.setItem(key,value);
    window.__FRONTLINES__.restoreState(p.state);
    return {statePreserved:JSON.stringify(window.__FRONTLINES__.getState())===JSON.stringify(p.state),savesPreserved:Object.entries(p.storage).every(([k,v])=>localStorage.getItem(k)===v)};
  },payload);
  if(payload.chosen)await page.locator('[data-mode-choice="'+payload.chosen+'"]').click();
  return {scope:'Carry the old Edge game and origin storage into the native-sized persistent player session',checks:result,storageKeys:Object.keys(payload.storage),viewport:page.viewportSize()};
}`;
writeFileSync(target+'.cjs',code,{flag:'wx'});
const result=execFileSync(process.execPath,['scripts/run-browser-probe.mjs',session,target+'.cjs',target],{encoding:'utf8',timeout:60000});
console.log(result);
