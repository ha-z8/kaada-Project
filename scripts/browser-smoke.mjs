import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,firefox,webkit} from 'playwright';
import {build} from 'esbuild';
import {writeFile,unlink} from 'node:fs/promises';
const testAsset='dist/__selection-compatibility-test.mjs';
const bundle=await build({entryPoints:['src/lib/selectionTranslation.js'],bundle:true,format:'esm',platform:'browser',write:false,define:{'import.meta.env':'{}'}});
await writeFile(testAsset,bundle.outputFiles[0].text);

const origin='http://127.0.0.1:4173';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
 '--host','127.0.0.1','--port','4173','--strictPort'],{
 stdio:['ignore','pipe','pipe']
});
let serverOutput='';
for(const stream of [server.stdout,server.stderr])
 stream.on('data',chunk=>{serverOutput+=chunk.toString().slice(-800)});
async function waitForServer(){
 for(let i=0;i<55;i++){
  try{const res=await fetch(origin,{signal:AbortSignal.timeout(1000)});
   if(res.ok)return;
  }catch{}
  await delay(250);
 }
 throw Error('Vite preview did not start: '+serverOutput.slice(-1200));
}
const targets=[
 {name:'Chromium desktop',engine:chromium,viewport:{width:1366,height:768}},
 {name:'Chromium small phone',engine:chromium,viewport:{width:360,height:740},isMobile:true,hasTouch:true},
 {name:'Firefox desktop',engine:firefox,viewport:{width:1280,height:800}},
 {name:'WebKit (Safari engine) phone',engine:webkit,viewport:{width:390,height:844},isMobile:true,hasTouch:true}
];
async function verify({name,engine,viewport,isMobile=false,hasTouch=false}){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport,isMobile,hasTouch});
 const page=await context.newPage();
 const errors=[],autoDownloads=[],failedRequests=[];
 page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('request',request=>{
  if(request.url().includes('huggingface.co/')&&
      /\.onnx(\?|$)|\.onnx\.json(\?|$)/.test(request.url()))
   autoDownloads.push(request.url());
 });
 try{
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:35000});
  await page.locator('main.page-content').waitFor({state:'visible',timeout:25000});
  await delay(1800);
  assert.equal(errors.length,0,name+': JavaScript crash: '+errors.join('; '));
  assert.equal(autoDownloads.length,0,name+': automatically downloading neural models');
  const compatibility=await page.evaluate(async()=>{
   const {translateDocumentSelection}=await import('/__selection-compatibility-test.mjs');
   const word=await translateDocumentSelection({native:'en',source:'SVG'},{translator:null,online:false});
   let friendly=false;try{await translateDocumentSelection({native:'en',source:'unlisted sentence for compatibility'},{translator:{availability:async()=>'available',create:async()=>{throw Error('Unable to create translator')}}});}catch(e){friendly=/لا تتوفر ترجمة/.test(e.message);}
   return {translation:word.translation,method:word.method,friendly};
  });
  assert.equal(compatibility.translation,'رسومات متجهية قابلة للتحجيم',name+': local word translation failed');
  assert.equal(compatibility.method,'glossary');
  assert.ok(compatibility.friendly,name+': raw browser error not handled');
  const allButtons=await page.locator('button').count();
  assert.ok(allButtons>=4,name+': the UI is not interactive');
  const didBoot=await page.locator('main.page-content').count();
  assert.equal(didBoot,1,name+': cannot render main page');

  // Check responsiveness rather than relying only on a production build.
  const dims=await page.evaluate(()=>({
   scroll:document.documentElement.scrollWidth,inner:window.innerWidth
  }));
  assert.ok(dims.scroll<=dims.inner+15,name+': horizontal overflow '+JSON.stringify(dims));

  // Top bar interactivity should work regardless of whether audio is supported.
  await page.getByRole('button',{name:'تغيير المظهر'}).click({timeout:8000});
  assert.ok(['light','dark'].includes(await page.evaluate(()=>
    document.documentElement.dataset.theme)),name+': appearance control failed');

  // About used to auto-download a large model when visited. It must not do so.
  if(isMobile){
   await page.getByRole('button',{name:'فتح القائمة'}).click();
  }
  const about=page.locator('button.side-nav').filter({hasText:'عن المنصة'}).first();
  if(await about.count()){
   await about.click({timeout:8000});
   await page.locator('.about-page').waitFor({state:'visible',timeout:15000});
   await delay(500);
   assert.equal(autoDownloads.length,0,name+': About silently downloaded a voice');
  }

  // Do not disconnect before PWA registration and caching finish. On the
  // first visit, the service worker may still be precaching hashed assets.
  await page.evaluate(async()=>{
   if(!('serviceWorker' in navigator))throw Error('Service workers unavailable');
   await Promise.race([
    (async()=>{
     await navigator.serviceWorker.ready;
     if(navigator.serviceWorker.controller)return;
     await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('No SW controller after 20s')),20000);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
       if(navigator.serviceWorker.controller){clearTimeout(timeout);resolve()}
      });
     });
    })(),
    new Promise((_,reject)=>setTimeout(()=>reject(Error('PWA shell installation timed out')),25000))
   ]);
  });
  const beforeOffline=await page.evaluate(async()=>{
   const scripts=[...document.querySelectorAll('script[src]')].map(x=>x.src);
   const cacheNames=await caches.keys();
   return {
    serviceWorkerController:navigator.serviceWorker.controller?.scriptURL||null,
    scripts,cacheNames,
    cachedShell:Boolean(await caches.match('/index.html')),
    cachedScripts:await Promise.all(scripts.map(async url=>
     ({url,found:Boolean(await caches.match(url))})))
   };
  });
  await context.setOffline(true);
  try{
   await page.reload({waitUntil:'domcontentloaded',timeout:25000});
  }catch(error){
   // Playwright WebKit's Linux runner can throw "WebKit encountered an
   // internal error" on page.reload() when its network emulator is offline.
   // Check that the shell, JS and CSS are in Cache Storage, report a PARTIAL
   // instead of claiming that real Safari offline navigation was tested.
   if(name.startsWith('WebKit')&&/WebKit encountered an internal error/.test(String(error))){
    const missing=beforeOffline.cachedScripts.filter(asset=>!asset.found);
    assert.equal(missing.length,0,'WebKit: missing cached entry scripts: '+JSON.stringify(missing));
    const cached=await page.evaluate(async()=>{
     const keys=await caches.keys();
     const shell=await caches.match('/index.html');
     return {shell:Boolean(shell),keys};
    }).catch(()=>({shell:beforeOffline.cachedShell,keys:beforeOffline.cacheNames}));
    assert.ok(cached.shell,name+': PWA index.html is not precached');
    process.stdout.write('PARTIAL '+name+' (online navigation passed; offline JS assets cached; Linux WebKit internal reload error)\\n');
    return;
   }
   throw error;
  }
  try{
   await page.locator('main.page-content').waitFor({state:'visible',timeout:14000});
  }catch(error){
   const body=await page.locator('body').innerText().catch(()=>'(body unavailable)');
   const html=await page.locator('body').innerHTML().catch(()=>'(html unavailable)');
   const after=await page.evaluate(async()=>{
    const scripts=[...document.querySelectorAll('script[src]')].map(x=>x.src);
    return {controller:navigator.serviceWorker.controller?.scriptURL||null,
     scripts,caches:await caches.keys(),cachedScripts:await Promise.all(scripts.map(async url=>
      ({url,found:Boolean(await caches.match(url))})))};
   }).catch(e=>({error:String(e)}));
   throw Error(name+': offline site did not render. Body: '+body.slice(0,700)+
     '. HTML: '+html.slice(0,450)+
     '. Page errors: '+errors.join('; ')+
     '. Failed requests: '+JSON.stringify(failedRequests.slice(-14))+
     '. Before: '+JSON.stringify(beforeOffline)+
     '. After: '+JSON.stringify(after)+'; '+String(error));
  }
  assert.equal(errors.length,0,name+': offline JavaScript error: '+errors.join('; '));
  process.stdout.write('PASS '+name+' (online, About, mobile layout, offline shell)\n');
 }finally{
  await context.close();await browser.close();
 }
}
try{
 await waitForServer();
 for(const target of targets)await verify(target);
 console.log('PASS browser smoke: Chromium desktop/mobile and Firefox offline; WebKit online tested with offline shell asset check when supported');
}catch(error){
 console.error('BROWSER SMOKE FAILED:',error.stack||error);
 process.exitCode=1;
}finally{
 server.kill('SIGTERM');await unlink(testAsset).catch(()=>{});
}
