/**
 * Optional genuine sound-generation smoke: boots the built Piper Web Worker
 * in Chromium, downloads just one public voice, checks WAV synthesis, then
 * turns the network off and synthesizes again with the same local model.
 *
 * This is one engine/voice smoke, NOT proof that all 12 speak on all devices.
 */
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {findOfflineVoice} from '../src/lib/voiceManifest.js';

const origin='http://127.0.0.1:4174';
const files=await readdir('dist/assets');
const workerFile=files.find(name=>/^piperWorker-[\w-]+\.js$/.test(name));
assert.ok(workerFile,'Missing compiled Piper Web Worker asset');
const language=process.env.HSA_VOICE_LANGUAGE==='ar'?'ar':'en';
const voice=findOfflineVoice(language==='ar'?'piper:hsa-emirati-female':'piper:en_GB-alan-medium');
assert.ok(voice);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
 '--host','127.0.0.1','--port','4174','--strictPort'],{stdio:'ignore'});
let browser,context;
try{
 let ready=false;
 for(let i=0;i<60;i++){
  try{const r=await fetch(origin,{signal:AbortSignal.timeout(1000)});
   if(r.ok){ready=true;break}
  }catch{}
  await delay(250);
 }
 assert.ok(ready,'Vite preview failed');
 browser=await chromium.launch({headless:true});
 context=await browser.newContext();
 const page=await context.newPage();
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:35000});
 await page.locator('main.page-content').waitFor({timeout:25000});
 await page.evaluate(async()=>{
  await navigator.serviceWorker.ready;
  const response=await fetch('/tts-runtime/manifest.json');
  if(!response.ok)throw Error('Local WASM manifest not found');
  const data=await response.clone().json();
  const c=await caches.open('hsa-compat-runtime-v1');
  await c.put('/tts-runtime/manifest.json',response);
  for(const path of data.files){
   const asset=await fetch(path);
   if(!asset.ok)throw Error('Missing runtime '+path);
   await c.put(path,asset);
  }
 });
 console.log('READY local ONNX/phonemizer WASM assets cached');
 // The model stays in this browser only, using a user-independent public voice.
 const model=await page.evaluate(async pack=>{
  const configResponse=await fetch(pack.configUrl);
  if(!configResponse.ok)throw Error('Config request '+configResponse.status);
  const config=await configResponse.json();
  const response=await fetch(pack.modelUrl);
  if(!response.ok)throw Error('Model request '+response.status);
  window.__voiceModel=await response.blob();
  window.__voiceConfig=config;
  return {bytes:window.__voiceModel.size,phonemeType:config.phoneme_type};
 },voice);
 assert.ok(model.bytes>1024*1024);
 assert.equal(model.phonemeType,'espeak');
 console.log('READY model '+voice.modelKey+' size='+model.bytes);

 const run=async(offline=false)=>page.evaluate(({url,pack})=>new Promise((resolve,reject)=>{
  const worker=new Worker(url,{type:'module'});
  const timer=setTimeout(()=>{worker.terminate();reject(Error('Neural synthesis exceeded 120s'))},120000);
  worker.onmessage=async event=>{
   clearTimeout(timer);worker.terminate();
   const d=event.data;
   if(!d?.ok)return reject(Error(d?.error||'Worker failed'));
   try{
    const audio=d.audio;
    const bytes=await audio.arrayBuffer();
    const header=new TextDecoder().decode(bytes.slice(0,4));
    resolve({size:bytes.byteLength,header});
   }catch(error){reject(error)}
  };
  worker.onerror=event=>{
   clearTimeout(timer);worker.terminate();
   reject(Error('Worker runtime error: '+String(event.message||'unknown')));
  };
  worker.postMessage({id:1,text:pack.lang==='ar'?'تساعد بحوث العمليات على اتخاذ القرارات.':'Operations research helps us make better decisions.',
   modelKey:pack.modelKey,modelBlob:window.__voiceModel,
   config:window.__voiceConfig,speakerId:pack.speakerId});
 }),{url:'/assets/'+workerFile,pack:voice});
 const online=await run(false);
 assert.equal(online.header,'RIFF');
 assert.ok(online.size>5000);
 console.log('PASS real online Piper inference, WAV bytes='+online.size);
 await context.setOffline(true);
 const offline=await run(true);
 assert.equal(offline.header,'RIFF');
 assert.ok(offline.size>5000);
 console.log('PASS offline Piper inference, same voice, WAV bytes='+offline.size);
}catch(error){
 console.error('VOICE INFERENCE SMOKE FAILED:',error.stack||error);
 process.exitCode=1;
}finally{
 await context?.close().catch(()=>{});
 await browser?.close().catch(()=>{});
 server.kill('SIGTERM');
}
