import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {readdir} from 'node:fs/promises';import {setTimeout as delay} from 'node:timers/promises';import {chromium} from 'playwright';
const origin='http://127.0.0.1:4175';const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4175','--strictPort'],{stdio:'ignore'});let browser;
try{for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break}catch{}await delay(250);}
 const asset=(await readdir('dist/assets')).find(n=>/^localTranslation-[\w-]+\.js$/.test(n));assert.ok(asset,'missing local translation asset');browser=await chromium.launch();const ctx=await browser.newContext();const page=await ctx.newPage();await page.goto(origin);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.evaluate(async url=>{const m=await import(url);await m.prepareLocalTranslation();if(!await m.localTranslationReady())throw Error('not cached');},'/assets/'+asset);
 await ctx.setOffline(true);
 const translated=await page.evaluate(async url=>{const m=await import(url);m.releaseLocalTranslator();return m.translateLocally('The teacher explains the lesson.');},'/assets/'+asset);
 assert.match(translated,/[\p{Script=Arabic}]/u);console.log('PASS actual cached local model offline translation: '+translated);
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.kill('SIGTERM');}
