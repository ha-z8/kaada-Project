import {LOCAL_TRANSLATION_CACHE,LOCAL_TRANSLATION_READY,LOCAL_TRANSLATION_EVENT,LOCAL_TRANSLATION_SAMPLE,LOCAL_TRANSLATION_REVISION,translationInput} from './localTranslationConfig.js';
let worker=null,sequence=0,preparing=null,idleTimer=null;
const requests=new Map();
function dispose(error=Error('توقف المترجم المحلي.')){
 clearTimeout(idleTimer);idleTimer=null;worker?.terminate();worker=null;
 for(const req of requests.values()){clearTimeout(req.timer);req.reject(error);}requests.clear();
}
function request(type,text=''){
 clearTimeout(idleTimer);idleTimer=null;
 if(!worker){
  if(typeof Worker==='undefined')throw Error('هذا الجهاز لا يدعم المترجم المحلي.');
  worker=new Worker(new URL('./localTranslationWorker.js',import.meta.url),{type:'module'});
  worker.onmessage=e=>{const msg=e.data||{},req=requests.get(msg.id);if(!req)return;requests.delete(msg.id);clearTimeout(req.timer);msg.ok?req.resolve(msg.value):req.reject(Error('تعذّر تشغيل المترجم المحلي. تحقق من اكتمال تنزيله.'));if(!requests.size)idleTimer=setTimeout(()=>{if(!preparing&&!requests.size)dispose();},20000);};
  worker.onerror=()=>dispose(Error('تعطّل المترجم المحلي. قد لا تكفي ذاكرة الجهاز.'));
 }
 return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>dispose(Error('استغرق المترجم المحلي وقتًا طويلًا. جرّب نصًا أقصر.')),type==='prepare'?600000:120000);requests.set(id,{resolve,reject,timer});worker.postMessage({id,type,text});});
}
export async function localTranslationReady(){
 try{const cache=await caches.open(LOCAL_TRANSLATION_CACHE),marker=await cache.match(LOCAL_TRANSLATION_READY);if(!marker)return false;const record=await marker.json();if(record.revision!==LOCAL_TRANSLATION_REVISION||!Array.isArray(record.files)||!record.files.length)return false;for(const url of record.files)if(!await cache.match(url))return false;return true;}catch{return false;}
}
export async function prepareLocalTranslation(onProgress=()=>{}){
 if(preparing)return preparing;
 if(globalThis.navigator?.onLine===false)throw Error('جهّز المترجم مرة واحدة أثناء الاتصال.');
 preparing=(async()=>{
  const cache=await caches.open(LOCAL_TRANSLATION_CACHE);
  await cache.delete(LOCAL_TRANSLATION_READY);
  dispose();onProgress('runtime');
  const manifest=await fetch('/translation-runtime/manifest.json');if(!manifest.ok)throw Error('ملفات تشغيل المترجم غير متوفرة.');
  const {files}=await manifest.json();if(!Array.isArray(files)||!files.length)throw Error('ملفات المترجم ناقصة.');
  for(const path of files){if(!/^\/translation-runtime\/[\w.-]+\.wasm$/.test(path))throw Error('ملف تشغيل غير صالح.');if(!await cache.match(path)){const res=await fetch(path);if(!res.ok)throw Error('تعذّر تنزيل محرك الترجمة.');await cache.put(path,res);}}
  onProgress('model');
  await request('prepare');dispose();
  onProgress('verify');
  // A new worker must reopen exclusively from cached assets before reporting ready.
  const result=await request('translate',LOCAL_TRANSLATION_SAMPLE);
  if(!/[\p{Script=Arabic}]/u.test(result))throw Error('لم يجتز المترجم اختبار التشغيل.');
  const keys=(await cache.keys()).map(x=>x.url).filter(x=>!x.endsWith(LOCAL_TRANSLATION_READY));
  if(!keys.some(x=>x.endsWith('.onnx')))throw Error('لم تُحفظ ملفات نموذج الترجمة.');
  await cache.put(LOCAL_TRANSLATION_READY,new Response(JSON.stringify({revision:LOCAL_TRANSLATION_REVISION,files:keys})));
  globalThis.window?.dispatchEvent(new Event(LOCAL_TRANSLATION_EVENT));
  return true;
 })().catch(e=>{dispose();throw e;}).finally(()=>{preparing=null;});
 return preparing;
}
export async function translateLocally(text){
 if(!await localTranslationReady())return '';
 return request('translate',translationInput(text));
}
export function releaseLocalTranslator(){if(!preparing&&!requests.size)dispose();}
