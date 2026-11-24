/**
 * Deep Chromium compatibility check for all 12 individual real Piper voices.
 * Separate ONNX model and speaker IDs (Hadra shares 1 weights file).
 * Uses the published voice catalog but no storage mutation or private data.
 * High bandwidth; CI is diagnostic because not all client devices support ONNX.
 */
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {OFFLINE_VOICE_PACKS} from '../src/lib/voiceManifest.js';

const origin='http://127.0.0.1:4175';
const files=await readdir('dist/assets');
const workerFile=files.find(x=>/^piperWorker-[\w-]+\.js$/.test(x));
assert.ok(workerFile,'Built neural inference worker missing');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
 '--host','127.0.0.1','--port','4175','--strictPort'],{stdio:'ignore'});
let browser,context;const results=[];
try{
 let live=false;
 for(let i=0;i<60;i++){
  try{const r=await fetch(origin,{signal:AbortSignal.timeout(1000)});
   if(r.ok){live=true;break}
  }catch{}
  await delay(250);
 }
 assert.ok(live,'Could not start local production site');
 browser=await chromium.launch({headless:true});
 context=await browser.newContext();
 const page=await context.newPage();
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:35000});
 await page.locator('main.page-content').waitFor({timeout:15000});
 await page.evaluate(async()=>{
  await navigator.serviceWorker.ready;
  const cache=await caches.open('hsa-tts-runtime-v1');
  const manifest=await fetch('/tts-runtime/manifest.json');
  if(!manifest.ok)throw Error('No runtime manifest');
  const info=await manifest.clone().json();
  await cache.put('/tts-runtime/manifest.json',manifest);
  for(const file of info.files){
   const response=await fetch(file);
   if(!response.ok)throw Error('Runtime missing: '+file);
   await cache.put(file,response);
  }
 });
 for(const pack of OFFLINE_VOICE_PACKS){
  try{
   const metadata=await page.evaluate(async pack=>{
    // Keep only a single model Blob in browser memory at any moment.
    if(window.__testModelKey!==pack.modelKey){
     window.__testModel=null;window.__testConfig=null;
     const [conf,weight]=await Promise.all([
      fetch(pack.configUrl),fetch(pack.modelUrl)
     ]);
     if(!conf.ok||!weight.ok)throw Error('Download failed: config '+conf.status+' model '+weight.status);
     window.__testConfig=await conf.json();
     window.__testModel=await weight.blob();
     window.__testModelKey=pack.modelKey;
    }
    return {bytes:window.__testModel.size,speakers:window.__testConfig.num_speakers};
   },pack);
   assert.ok(metadata.bytes>1048576,'Model too small');
   const text=pack.lang==='ar'?'مرحبًا بكم في منصتنا التعليمية. هذا اختبار للصوت العربي.':
    'Welcome to our educational platform. This is a clear voice test.';
   const result=await page.evaluate(({pack,url,text})=>new Promise((resolve,reject)=>{
    const worker=new Worker(url,{type:'module'});
    const timer=setTimeout(()=>{
     worker.terminate();reject(Error('Voice generation exceeded 120 seconds'));
    },120000);
    worker.onmessage=async ({data})=>{
     clearTimeout(timer);worker.terminate();
     if(!data?.ok)return reject(Error(data?.error||'Neural inference failed'));
     const buf=await data.audio.arrayBuffer();
     resolve({size:buf.byteLength,wav:new TextDecoder().decode(buf.slice(0,4))});
    };
    worker.onerror=e=>{
     clearTimeout(timer);worker.terminate();reject(Error('Worker failed: '+String(e.message||'unknown')));
    };
    worker.postMessage({id:1,modelKey:pack.modelKey,
     modelBlob:window.__testModel,config:window.__testConfig,
     text,speakerId:pack.speakerId});
   }),{pack,url:'/assets/'+workerFile,text});
   assert.equal(result.wav,'RIFF');
   assert.ok(result.size>5000,'WAV output too small');
   console.log('PASS '+pack.lang+' '+pack.gender+' '+pack.label+
    ' speaker='+pack.speakerId+' samples='+result.size);
   results.push({id:pack.id,ok:true});
  }catch(error){
   results.push({id:pack.id,ok:false,message:String(error?.message||error)});
   console.error('FAIL '+pack.id+': '+String(error?.message||error));
  }
 }
 // Confirm genuine disconnection does not break synthesis of the final cached model.
 await context.setOffline(true);
 const last=OFFLINE_VOICE_PACKS.at(-1);
 if(results.at(-1)?.ok){
  const result=await page.evaluate(({pack,url})=>new Promise((resolve,reject)=>{
   const worker=new Worker(url,{type:'module'});
   const timeout=setTimeout(()=>{worker.terminate();reject(Error('Offline worker timeout'))},120000);
   worker.onmessage=async ({data})=>{
    clearTimeout(timeout);worker.terminate();
    if(!data?.ok)return reject(Error(data?.error||'Offline inference failed'));
    const bytes=await data.audio.arrayBuffer();
    resolve({size:bytes.byteLength,wav:new TextDecoder().decode(bytes.slice(0,4))});
   };
   worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(Error(e.message||'Worker failed'))};
   worker.postMessage({id:1,modelKey:pack.modelKey,
    modelBlob:window.__testModel,config:window.__testConfig,
    text:'This voice works entirely without a connection.',speakerId:pack.speakerId});
  }),{pack:last,url:'/assets/'+workerFile});
  assert.equal(result.wav,'RIFF');assert.ok(result.size>5000);
  console.log('PASS offline re-generation for '+last.label);
 }
 const passed=results.filter(x=>x.ok).length;
 console.log('12-VOICE AUDIT SUMMARY: '+passed+'/'+OFFLINE_VOICE_PACKS.length+' models synthesized');
 if(passed!==OFFLINE_VOICE_PACKS.length)process.exitCode=1;
}catch(error){
 console.error('VOICE CATALOG FULL SMOKE FATAL:',error.stack||error);
 process.exitCode=1;
}finally{
 await context?.close().catch(()=>{});
 await browser?.close().catch(()=>{});
 server.kill('SIGTERM');
}
