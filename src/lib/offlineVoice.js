import {
 OFFLINE_VOICE_PACKS,OFFLINE_VOICE_EVENT,isOnDeviceVoice,findOfflineVoice,
 VOICE_GROUPS,uniqueVoiceModels
} from './voiceManifest.js';
// Neural ONNX and phonemizer are loaded only in a dedicated module worker.
export {OFFLINE_VOICE_PACKS,OFFLINE_VOICE_EVENT,isOnDeviceVoice,findOfflineVoice,VOICE_GROUPS,uniqueVoiceModels}
 from './voiceManifest.js';

const MODELS_DIR='hsa-voice-models-v2';
const RUNTIME_CACHE='hsa-tts-runtime-v1';
const MIN_MODEL_SIZE=1024*1024;
const REQUIRED_RUNTIME_FILES=['/tts-runtime/piper_phonemize.wasm',
 '/tts-runtime/piper_phonemize.data'];
const downloading=new Map();
let cachedRuntimePromise;
let activePlayback=null;
let synthesisQueue=Promise.resolve();
let synthWorker=null;
let workerSequence=0;
const workerRequests=new Map();
const WORKER_TIMEOUT_MS=120000;
const lastProgressByModel=new Map();
function terminateInference(error=Error('توقف توليد الصوت.')){
 const old=synthWorker;synthWorker=null;
 old?.terminate();
 for(const request of workerRequests.values()){
  clearTimeout(request.timer);request.reject(error);
 }
 workerRequests.clear();
}
function workerInstance(){
 if(synthWorker)return synthWorker;
 if(typeof Worker==='undefined')
  throw Error('هذا المتصفح لا يدعم محرك الصوت العصبي المحلي؛ اختر صوتًا مثبتًا في نظام الجهاز.');
 const worker=new Worker(new URL('./piperWorker.js',import.meta.url),{type:'module'});
 worker.onmessage=event=>{
  const {id,ok,audio,error}=event.data||{};
  const request=workerRequests.get(id);
  if(!request)return;
  workerRequests.delete(id);clearTimeout(request.timer);
  if(ok&&audio instanceof Blob)request.resolve(audio);
  else request.reject(Error(String(error||'تعذّر توليد المقطع على جهازك.')));
 };
 worker.onerror=()=>terminateInference(Error('تعطل معالج الصوت المحلي. تأكد من ذاكرة الجهاز والملفات المحفوظة.'));
 worker.onmessageerror=()=>terminateInference(Error('تعذّر نقل الصوت من المعالج الخلفي.'));
 synthWorker=worker;
 return worker;
}
function synthesizeInWorker(text,pack,modelBlob,config){
 const worker=workerInstance();
 return new Promise((resolve,reject)=>{
  const id=++workerSequence;
  const timer=setTimeout(()=>terminateInference(Error(
   'استغرق توليد الصوت وقتًا أطول من قدرة الجهاز. جرّب مقطعًا أقصر.'
  )),WORKER_TIMEOUT_MS);
  workerRequests.set(id,{resolve,reject,timer});
  try{
   worker.postMessage({id,text,modelKey:pack.modelKey,modelBlob,config,
    speakerId:pack.speakerId});
  }catch(error){
   clearTimeout(timer);workerRequests.delete(id);
   reject(Error('تعذّر إرسال النموذج لمعالج الصوت: '+String(error?.message||error)));
  }
 });
}

const offline=()=>typeof navigator!=='undefined'&&navigator.onLine===false;
export const canUseOfflineModels=()=>typeof navigator!=='undefined'
 &&typeof navigator.storage?.getDirectory==='function'
 &&typeof WebAssembly!=='undefined'&&typeof Audio!=='undefined'&&typeof Worker!=='undefined';
const emit=(pack,status,loaded=0,total=0,error='')=>{
 if(typeof window==='undefined'||typeof CustomEvent==='undefined')return;
 // Large models stream thousands of chunks; <= 4 UI updates/second/model.
 if(status==='downloading'){
  const previous=lastProgressByModel.get(pack.modelKey)||0;
  const now=Date.now();
  if(now-previous<250)return;
  lastProgressByModel.set(pack.modelKey,now);
 }else lastProgressByModel.delete(pack.modelKey);
 for(const voice of OFFLINE_VOICE_PACKS.filter(v=>v.modelKey===pack.modelKey)){
  window.dispatchEvent(new CustomEvent(OFFLINE_VOICE_EVENT,{
   detail:{voice:voice.id,status,loaded,total,error}
  }));
 }
};
async function modelDirectory(){
 const root=await navigator.storage.getDirectory();
 return root.getDirectoryHandle(MODELS_DIR,{create:true});
}
async function fileOrNull(directory,name){
 try{
  const handle=await directory.getFileHandle(name);
  return await handle.getFile();
 }catch{return null}
}
async function readInstalledModel(pack){
 try{
  const directory=await modelDirectory();
  const marker=await fileOrNull(directory,pack.modelKey+'.ready.json');
  if(marker){
   const metadata=JSON.parse(await marker.text());
   if(metadata.modelKey===pack.modelKey){
    const file=await fileOrNull(directory,pack.modelKey+'.onnx');
    const cfg=await fileOrNull(directory,pack.modelKey+'.onnx.json');
    if(file?.size>MIN_MODEL_SIZE&&cfg?.size){
     const config=JSON.parse(await cfg.text());
     if(config.phoneme_type==='espeak'&&config.espeak?.voice){
      return {modelBlob:file,config};
     }
    }
   }
  }
  // Compatible with old Piper OPFS models: do not re-download their 60MB
  // weights just because the new voice studio switched runtime.
  if(pack.modelKey===pack.model){
   const root=await navigator.storage.getDirectory();
   const old=await root.getDirectoryHandle('piper');
   const file=await fileOrNull(old,pack.modelKey+'.onnx');
   const cfg=await fileOrNull(old,pack.modelKey+'.onnx.json');
   if(file?.size>MIN_MODEL_SIZE&&cfg?.size){
    const config=JSON.parse(await cfg.text());
    if(config.phoneme_type==='espeak'&&config.espeak?.voice)
     return {modelBlob:file,config};
   }
  }
 }catch{/* Unavailable OPFS or interrupted download */ }
 return null;
}
async function runtimePresent(){
 try{
  const cache=await caches.open(RUNTIME_CACHE);
  if(!await cache.match('/tts-runtime/manifest.json'))return false;
  for(const file of REQUIRED_RUNTIME_FILES)
   if(!await cache.match(file))return false;
  return true;
 }catch{return false}
}
export async function storedOfflineVoiceIds(){
 if(!canUseOfflineModels()||!await runtimePresent())return [];
 const statuses=await Promise.all(OFFLINE_VOICE_PACKS.map(async p=>
  (await readInstalledModel(p))?p.id:null));
 return statuses.filter(Boolean);
}
export async function cacheTtsRuntime(){
 if(cachedRuntimePromise)return cachedRuntimePromise;
 cachedRuntimePromise=(async()=>{
  if(typeof caches==='undefined')throw Error('المتصفح لا يسمح بحفظ مكوّنات الصوت.');
  const cache=await caches.open(RUNTIME_CACHE);
  let manifest=await cache.match('/tts-runtime/manifest.json');
  if(!manifest){
   if(offline())throw Error('يجب تجهيز محرك الأصوات أثناء الاتصال أولًا.');
   const response=await fetch('/tts-runtime/manifest.json');
   if(!response.ok)throw Error('ملفات محرك الصوت غير موجودة على الموقع.');
   manifest=response.clone();
   await cache.put('/tts-runtime/manifest.json',response);
  }
  const data=await manifest.json();
  const files=Array.isArray(data.files)?data.files:[];
  if(!REQUIRED_RUNTIME_FILES.every(f=>files.includes(f)))
   throw Error('ملفات محرك Piper غير مكتملة في نسخة الموقع.');
  for(const file of files){
   if(!/^\/tts-runtime\/[a-zA-Z0-9._-]+$/.test(file))
    throw Error('ملف تشغيل محلي غير آمن.');
   if(await cache.match(file))continue;
   if(offline())throw Error('أكمل تنزيل ملفات تشغيل الصوت أثناء الاتصال.');
   const response=await fetch(file);
   if(!response.ok)throw Error('تعذّر تنزيل ملف تشغيل الصوت: '+file);
   await cache.put(file,response);
  }
  return true;
 })().catch(e=>{cachedRuntimePromise=null;throw e});
 return cachedRuntimePromise;
}
async function downloadWeights(pack,dir){
 const response=await fetch(pack.modelUrl,{cache:'no-store'});
 if(!response.ok||!response.body)throw Error('تعذّر تنزيل نموذج '+pack.label+' ('+response.status+').');
 const file=await dir.getFileHandle(pack.modelKey+'.onnx',{create:true});
 const output=await file.createWritable();
 const reader=response.body.getReader();
 const total=Number(response.headers.get('Content-Length')||0);
 let loaded=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   loaded+=value.byteLength;
   if(loaded>1024*1024*1024)throw Error('حجم النموذج تجاوز الحد المسموح.');
   await output.write(value);
   emit(pack,'downloading',loaded,total);
  }
  await output.close();
  if(loaded<MIN_MODEL_SIZE)throw Error('النموذج الصوتي الذي وصل غير مكتمل.');
 }catch(error){
  await output.abort().catch(()=>{});
  await dir.removeEntry(pack.modelKey+'.onnx').catch(()=>{});
  throw error;
 }
}
async function downloadModel(pack){
 if(await readInstalledModel(pack))return true;
 if(offline())throw Error('الصوت '+pack.label+' يحتاج تنزيلًا أوليًا أثناء الاتصال.');
 await cacheTtsRuntime();
 const dir=await modelDirectory();
 const response=await fetch(pack.configUrl,{cache:'no-store'});
 if(!response.ok)throw Error('تعذّر تنزيل إعدادات صوت '+pack.label+'.');
 const config=await response.json();
 if(config.phoneme_type!=='espeak'||!config.espeak?.voice||
  !config.audio?.sample_rate)throw Error('هذا النموذج غير متوافق مع محرك الصوت الحالي.');
 if(pack.speakerId>0){
  const count=Number(config.num_speakers||Object.keys(config.speaker_id_map||{}).length||1);
  if(count<=pack.speakerId)throw Error('النموذج لا يملك المتحدث المطلوب للصوت '+pack.label+'.');
 }
 emit(pack,'downloading');
 await downloadWeights(pack,dir);
 const configFile=await dir.getFileHandle(pack.modelKey+'.onnx.json',{create:true});
 const writer=await configFile.createWritable();
 await writer.write(JSON.stringify(config));await writer.close();
 const marker=await dir.getFileHandle(pack.modelKey+'.ready.json',{create:true});
 const readyWriter=await marker.createWritable();
 await readyWriter.write(JSON.stringify({modelKey:pack.modelKey,savedAt:Date.now(),version:2}));
 await readyWriter.close();
 if(!await readInstalledModel(pack))throw Error('لم يتم التحقق من اكتمال الصوت المحلي.');
 return true;
}
export async function installOfflineVoice(id){
 const pack=findOfflineVoice(id);
 if(!pack)throw Error('هذا الصوت غير موجود في المكتبة.');
 if(pack.supported===false)throw Error(pack.unavailableReason||'هذا الصوت لم يجتز اختبار التشغيل الفعلي.');
 if(!canUseOfflineModels())throw Error('المتصفح لا يدعم ذاكرة النماذج المحلية OPFS أو WebAssembly.');
 if(downloading.has(pack.modelKey))return downloading.get(pack.modelKey);
 const work=(async()=>{
  if(await readInstalledModel(pack)){
   await cacheTtsRuntime();
   emit(pack,'ready');return true;
  }
  await downloadModel(pack);
  emit(pack,'ready');return true;
 })().catch(error=>{
  emit(pack,'error',0,0,String(error?.message||error));
  throw error;
 }).finally(()=>downloading.delete(pack.modelKey));
 downloading.set(pack.modelKey,work);
 return work;
}
export async function installRecommendedOfflineVoices(){
 const installed=[];
 const sorted=[...OFFLINE_VOICE_PACKS].sort((a,b)=>
  Number(Boolean(b.recommended))-Number(Boolean(a.recommended)));
 const checked=new Set();
 for(const pack of sorted){
  if(pack.supported===false)continue;
  if(checked.has(pack.modelKey))continue;
  checked.add(pack.modelKey);
  if(offline())break;
  try{
   const estimate=await navigator.storage?.estimate?.().catch(()=>null);
   if(estimate?.quota&&estimate.quota-(estimate.usage||0)<100*1024*1024){
    emit(pack,'insufficient-storage');continue;
   }
   // Only triggered by explicit user action; never skip arbitrary voices.
   await installOfflineVoice(pack.id);
   installed.push(pack.id);
  }catch{/* Marked as error in the UI; keep other voices and offline library. */}
 }
 return installed;
}
export async function synthesizeOfflineVoice(text,id){
 const pack=findOfflineVoice(id);
 if(!pack)throw Error('لم يُعثر على الصوت المختار.');
 if(pack.supported===false)throw Error(pack.unavailableReason||'تعذّر التحقق من النموذج الصوتي.');
 const content=await readInstalledModel(pack);
 if(!content)throw Error('الصوت '+pack.label+' غير محمّل. نزّله من استوديو الأصوات أولًا.');
 const task=synthesisQueue.then(async()=>{
  await cacheTtsRuntime();
  return synthesizeInWorker(String(text||''),pack,content.modelBlob,content.config);
 });
 synthesisQueue=task.catch(()=>{});
 return task;
}
function chunks(text,max=155){
 const words=String(text||'').trim().split(/\s+/).filter(Boolean);
 const result=[];let part='';
 for(const word of words){
  if(part&&(part+' '+word).length>max){result.push(part);part=''}
  part=(part+' '+word).trim();
 }
 if(part)result.push(part);
 return result;
}
function finishPlayback(player){
 // Release model ONNX memory when listening finishes; otherwise Safari/mobile
 // can keep hundreds of MB resident even after leaving the reader.
 terminateInference();
 if(player.context){
  void player.context.close().catch(()=>{});
  player.context=null;
 }
}
export function stopOfflineVoice(){
 if(!activePlayback)return;
 const player=activePlayback;activePlayback=null;
 player.cancelled=true;
 try{player.source?.stop()}catch{}
 try{player.audio?.pause()}catch{}
 if(player.url)URL.revokeObjectURL(player.url);
 player.release?.();
 player.unpause?.();
 finishPlayback(player);
}
export function pauseOfflineVoice(){
 if(!activePlayback)return false;
 const player=activePlayback;
 player.paused=true;
 if(player.context)void player.context.suspend().catch(()=>{});
 if(player.audio)player.audio.pause();
 return true;
}
export function resumeOfflineVoice(){
 if(!activePlayback)return false;
 const player=activePlayback;
 player.paused=false;
 if(player.context)void player.context.resume().catch(()=>{});
 if(player.audio)void player.audio.play().catch(()=>{});
 player.unpause?.();
 return true;
}
export function speakOfflineVoiceParts(parts,speed,onStart,onDone,onError,preferred={},onChunk,volume=1){
 stopOfflineVoice();
 const queue=(parts||[]).flatMap(part=>chunks(part.text)
  .map(text=>({text,lang:part.lang})));
 const player={cancelled:false,paused:false,audio:null,url:null,source:null,
  release:null,unpause:null,context:null};
 activePlayback=player;
 // Unlock Web Audio immediately from the user's play/preview event, before
 // the async neural model takes time to synthesize the first chunk. On Safari
 // and Chrome a late HTMLAudioElement.play() may otherwise be blocked.
 try{
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(AudioCtx){
   player.context=new AudioCtx();
   void player.context.resume().catch(()=>{});
  }
 }catch{/* HTML audio fallback below */}
 let started=false;
 const run=async()=>{
  for(let i=0;i<queue.length;i++){
   if(player.cancelled)return;
   const item=queue[i],id=preferred[item.lang?.slice(0,2)];
   if(!isOnDeviceVoice(id)||!findOfflineVoice(id))
    throw Error('القراءة المزدوجة تتطلب صوتين محليين حقيقيين لكلتا اللغتين.');
   const blob=await synthesizeOfflineVoice(item.text,id);
   if(player.cancelled)return;
   if(player.paused)await new Promise(resolve=>{player.unpause=resolve});
   player.unpause=null;
   if(player.cancelled)return;
   if(player.context){
    const context=player.context;
    const buffer=await context.decodeAudioData(await blob.arrayBuffer());
    if(player.cancelled)return;
    const source=context.createBufferSource();
    const gain=context.createGain();
    source.buffer=buffer;
    source.playbackRate.value=Math.max(0.6,Math.min(2,Number(speed)||1));
    gain.gain.value=Math.max(0,Math.min(1,Number(volume)||0));
    source.connect(gain);gain.connect(context.destination);
    player.source=source;
    await new Promise(resolve=>{
     let done=false;
     const finish=()=>{
      if(done)return;done=true;
      player.release=null;source.onended=null;source.disconnect();gain.disconnect();
      if(player.source===source)player.source=null;
      resolve();
     };
     player.release=finish;source.onended=finish;
     onChunk?.({lang:item.lang,text:item.text,index:i,total:queue.length});
     if(!started){started=true;onStart?.()}
     source.start(0);
    });
   }else{
    const url=URL.createObjectURL(blob),audio=new Audio(url);
    player.audio=audio;player.url=url;
    audio.volume=Math.max(0,Math.min(1,Number(volume)||0));
    audio.playbackRate=Math.max(0.6,Math.min(2,Number(speed)||1));
    if('preservesPitch' in audio)audio.preservesPitch=true;
    await new Promise((resolve,reject)=>{
     let ended=false;
     const finish=error=>{
      if(ended)return;ended=true;player.release=null;
      audio.onended=null;audio.onerror=null;audio.pause();
      URL.revokeObjectURL(url);
      if(player.url===url)player.url=null;
      if(player.audio===audio)player.audio=null;
      if(error)reject(error);else resolve();
     };
     player.release=()=>finish();
     audio.onended=()=>finish();
     audio.onerror=()=>finish(Error('فشل تشغيل المقطع الصوتي المحلي.'));
     audio.play().then(()=>{
      if(player.cancelled)return finish();
      onChunk?.({lang:item.lang,text:item.text,index:i,total:queue.length});
      if(!started){started=true;onStart?.()}
     }).catch(()=>finish(Error('منع المتصفح التشغيل التلقائي. اضغط تشغيل مجددًا.')));
    });
   }
  }
  if(!player.cancelled){activePlayback=null;finishPlayback(player);onDone?.()}
 };
 void run().catch(error=>{
  if(player.cancelled)return;
  activePlayback=null;
  finishPlayback(player);
  onError?.(String(error?.message||'فشل تشغيل الصوت المحلي.'));
 });
 return ()=>{if(activePlayback===player)stopOfflineVoice();else player.cancelled=true};
}
