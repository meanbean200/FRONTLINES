import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';

const [session,probe,target]=process.argv.slice(2);
if(!session||!probe||!target||existsSync(target))throw Error('Pass session, probe file and an unused evidence path.');
if(session==='frontlines-player'&&readFileSync(probe,'utf8').includes('setViewportSize'))throw Error('Do not pin the player window to a test viewport. Use a separate test session or native window resizing.');
const cli=join(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js');
const result=execFileSync(process.execPath,[cli,'--yes','--package','@playwright/cli','playwright-cli','-s='+session,'run-code','--filename',probe],{encoding:'utf8',timeout:55000,maxBuffer:16*1024*1024});
const match=result.match(/### Result\s*\n([\s\S]*?)\n### Ran Playwright code/);
if(!match)throw Error('No structured probe result: '+result);
const evidence=JSON.parse(match[1]);
writeFileSync(target,JSON.stringify({capturedAt:new Date().toISOString(),probe,evidence},null,2),{flag:'wx'});
console.log(JSON.stringify({target,bytes:Buffer.byteLength(match[1]),checks:evidence.checks??evidence.scope}));
