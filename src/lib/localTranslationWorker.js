import {pipeline,env} from '@xenova/transformers';
import {LOCAL_TRANSLATION_CACHE,LOCAL_TRANSLATION_MODEL,LOCAL_TRANSLATION_REVISION,LOCAL_TRANSLATION_SAMPLE,translationChunks} from './localTranslationConfig.js';
let instance=null,serial=Promise.resolve();
async function getPipeline(prepare){
 if(instance)return instance;
 env.allowLocalModels=true;env.localModelPath='/local-models/';
 env.allowRemoteModels=prepare;env.useBrowserCache=false;env.useFSCache=false;env.useCustomCache=true;
 const cache=await caches.open(LOCAL_TRANSLATION_CACHE);
 // Only exact cached model files are used when offline. Local path probes do not fetch an HTML SPA fallback.
 env.customCache={match:key=>cache.match(key),put:(key,response)=>cache.put(key,response)};
 env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.wasmPaths='/translation-runtime/';
 // The hub loader checks local paths before remote. Bypass SPA fallback by
 // allowing local model URLs only through the cache when already prepared.
 if(prepare)env.allowLocalModels=false;
 instance=await pipeline('translation',LOCAL_TRANSLATION_MODEL,{quantized:true,revision:LOCAL_TRANSLATION_REVISION,local_files_only:!prepare});
 return instance;
}
async function translate(text,prepare=false){
 const engine=await getPipeline(prepare);
 const chunks=translationChunks(text);
 const output=[];
 for(const chunk of chunks){
  const result=await engine(chunk,{max_new_tokens:192,num_beams:3});
  const value=String(result?.[0]?.translation_text||'').trim();
  if(!value||!/[\p{Script=Arabic}]/u.test(value)&&/[a-z]/i.test(chunk))throw Error('تعذّرت ترجمة النص المحدد محليًا.');
  output.push(value);
 }
 return output.join(' ');
}
self.onmessage=e=>{const {id,type,text}=e.data||{};serial=serial.then(async()=>{try{
 const value=await translate(type==='prepare'?LOCAL_TRANSLATION_SAMPLE:text,type==='prepare');
 self.postMessage({id,ok:true,value});
 }catch(err){self.postMessage({id,ok:false,error:String(err?.message||err)});}
 });};
