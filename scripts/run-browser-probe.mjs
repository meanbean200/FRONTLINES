import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';

const [session,probe,target]=process.argv.slice(2);
if(!session||!probe||!target||existsSync(target))throw Error('Pass session, probe file and an unused evidence path.');
const source=readFileSync(probe,'utf8').trim();
const changesViewport=source.includes('setViewportSize');
if(session.startsWith('frontlines-player')&&changesViewport)throw Error('Do not pin the player window to a test viewport. Use a separate test session or native window resizing.');
const cli=join(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js');
// Fixed-viewport QA stays in disposable, emulated sessions. Restore the original
// positive viewport on success or failure; zero dimensions are NOT a reset to
// native sizing (Chromium reapplies that invalid override after navigation).
// Native player contexts must be created with viewport:null and never emulated.
const wrapped=changesViewport?`async(page)=>{
  const viewport=page.viewportSize();
  if(!viewport||viewport.width<=0||viewport.height<=0)throw Error('Fixed-viewport probes require a disposable QA session with a positive viewport. Native player sessions must remain viewport:null.');
  try {return await (${source})(page);}
  finally {await page.setViewportSize(viewport);}
}`:source;
// Pass generated code by file so Windows command-line quoting cannot rewrite
// embedded strings. Keep it beside the evidence, including failed probes.
const wrappedPath=target+'.probe.cjs';
writeFileSync(wrappedPath,wrapped,{flag:'wx'});
let result;
try {
  result=execFileSync(process.execPath,[cli,'--yes','--package','@playwright/cli','playwright-cli','-s='+session,'run-code','--filename',wrappedPath],{encoding:'utf8',timeout:55000,maxBuffer:16*1024*1024});
} catch(error) {
  writeFileSync(target+'.failure.txt',String(error.stdout??'')+String(error.stderr??'')+String(error),{flag:'wx'});
  throw error;
}
const match=result.match(/### Result\s*\n([\s\S]*?)\n### Ran Playwright code/);
if(!match){
  writeFileSync(target+'.failure.txt',result,{flag:'wx'});
  throw Error('No structured probe result. See '+target+'.failure.txt');
}
const evidence=JSON.parse(match[1]);
if(evidence.nativeScreenshot?.data){
  const screenshot=target.replace(/\.json$/,'.png');
  writeFileSync(screenshot,Buffer.from(evidence.nativeScreenshot.data,'base64'),{flag:'wx'});
  evidence.nativeScreenshot=screenshot;
}
writeFileSync(target,JSON.stringify({capturedAt:new Date().toISOString(),probe,evidence},null,2),{flag:'wx'});
console.log(JSON.stringify({target,bytes:Buffer.byteLength(match[1]),checks:evidence.checks??evidence.scope}));
