/**
 * HSA on-device neural TTS: Piper models run through ONNX Runtime WASM.
 * Models stay in OPFS per origin/device after the first authorised download.
 * The repository hosts code and WASM; large model weights are fetched from
 * their publishers instead of committing them to Git history.
 *
 * Each card is a REAL model. Never alias an unavailable voice as a new speaker.
 */
export const OFFLINE_VOICE_PACKS=Object.freeze([
 Object.freeze({id:'piper:ar_JO-kareem-medium',model:'ar_JO-kareem-medium',lang:'ar',gender:'male',label:'كريم — عربي',license:'راجع بطاقة النموذج',recommended:true}),
 Object.freeze({id:'piper:en_US-joe-medium',model:'en_US-joe-medium',lang:'en',gender:'male',label:'Joe — English',license:'CC0',recommended:true}),
 Object.freeze({id:'piper:en_US-bryce-medium',model:'en_US-bryce-medium',lang:'en',gender:'male',label:'Bryce — English',license:'Public Domain'}),
 Object.freeze({id:'piper:en_US-kristin-medium',model:'en_US-kristin-medium',lang:'en',gender:'female',label:'Kristin — English',license:'Public Domain'}),
 Object.freeze({id:'piper:en_GB-alba-medium',model:'en_GB-alba-medium',lang:'en',gender:'female',label:'Alba — English',license:'CC BY 4.0'})
]);
export const OFFLINE_VOICE_EVENT='hsa-offline-voice-updated';
export const isOnDeviceVoice=name=>typeof name==='string'&&name.startsWith('piper:');
export const findOfflineVoice=id=>OFFLINE_VOICE_PACKS.find(voice=>voice.id===id)||null;
export const canUseOfflineModels=()=>typeof navigator!=='undefined'&&
 typeof navigator.storage?.getDirectory==='function'&&
 typeof WebAssembly!=='undefined'&&typeof Audio!=='undefined';

let loadedLibrary;
let cachedRuntimePromise;
let lastSessionVoice='';
const downloadTasks=new Map();
let activePlayback=null;
async function library(){
 if(!loadedLibrary)loadedLibrary=import('@mintplex-labs/piper-tts-web');
 return loadedLibrary;
}
function announce(voice,status,loaded=0,total=0){
 if(typeof window!=='undefined'&&typeof CustomEvent!=='undefined')
  window.dispatchEvent(new CustomEvent(OFFLINE_VOICE_EVENT,{
   detail:{voice,status,loaded,total}
  }));
}
/** WASM and phonemization data are served from our own domain. */
export async function cacheTtsRuntime(){
 if(cachedRuntimePromise)return cachedRuntimePromise;
 cachedRuntimePromise=(async()=>{
  if(!('caches' in window))throw Error('المتصفح لا يدعم حفظ ملفات الصوت اللازمة دون إنترنت.');
  const cache=await caches.open('hsa-tts-runtime-v1');
  let manifest=await cache.match('/tts-runtime/manifest.json');
  if(!manifest){
   if(navigator.onLine===false)throw Error('ملفات محرك الصوت لم تُنزّل قبل انقطاع الاتصال.');
   const response=await fetch('/tts-runtime/manifest.json');
   if(!response.ok)throw Error('ملفات محرك الصوت غير منشورة في الموقع.');
   await cache.put('/tts-runtime/manifest.json',response.clone());
   manifest=response;
  }
  const data=await manifest.json();
  if(!Array.isArray(data.files)||!data.files.length)throw Error('قائمة ملفات الصوت غير صالحة.');
  for(const file of data.files){
   if(!/^\/tts-runtime\/[a-zA-Z0-9._-]+$/.test(file))throw Error('مسار ملف صوت غير آمن.');
   if(await cache.match(file))continue;
   if(navigator.onLine===false)throw Error('يجب تنزيل ملفات تشغيل الصوت مرة واحدة قبل العمل دون إنترنت.');
   const response=await fetch(file,{cache:'no-store'});
   if(!response.ok)throw Error('فشل تنزيل جزء من محرك الصوت: '+file);
   await cache.put(file,response);
  }
  return true;
 })().catch(error=>{cachedRuntimePromise=null;throw error});
 return cachedRuntimePromise;
}
export async function storedOfflineVoiceIds(){
 if(!canUseOfflineModels())return [];
 try{
  const tts=await library();
  const names=await tts.stored();
  return OFFLINE_VOICE_PACKS.filter(pack=>names.includes(pack.model)).map(pack=>pack.id);
 }catch{return []}
}
export async function installOfflineVoice(id){
 const voice=findOfflineVoice(id);
 if(!voice)throw Error('لم يُعثر على نموذج الصوت المختار.');
 if(!canUseOfflineModels())throw Error('الجهاز أو المتصفح لا يدعم تشغيل نماذج الصوت المحلية حاليًا.');
 if(downloadTasks.has(id))return downloadTasks.get(id);
 const task=(async()=>{
  if((await storedOfflineVoiceIds()).includes(id)){
   await cacheTtsRuntime();
   announce(id,'ready');return true;
  }
  if(navigator.onLine===false)throw Error('يلزم اتصال أول مرة لتنزيل الصوت، وبعدها يعمل دون إنترنت.');
  announce(id,'downloading');
  await cacheTtsRuntime();
  const tts=await library();
  await tts.download(voice.model,p=>{
   announce(id,'downloading',Number(p?.loaded||0),Number(p?.total||0));
  });
  // This upstream downloader starts OPFS writes asynchronously. Do not
  // declare a voice ready until the model file is genuinely present on disk.
  let verified=false;
  for(let attempt=0;attempt<12;attempt++){
   if((await storedOfflineVoiceIds()).includes(id)){verified=true;break}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!verified)throw Error('لم يكتمل حفظ نموذج الصوت على الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.');
  announce(id,'ready');
  return true;
 })().catch(error=>{announce(id,'error');throw error})
  .finally(()=>downloadTasks.delete(id));
 downloadTasks.set(id,task);
 return task;
}
export async function installRecommendedOfflineVoices(){
 const installed=[];
 for(const voice of OFFLINE_VOICE_PACKS.filter(pack=>pack.recommended)){
  try{await installOfflineVoice(voice.id);installed.push(voice.id)}
  catch{/* Other voices can still be downloaded manually. */}
 }
 return installed;
}
export async function synthesizeOfflineVoice(text,id){
 const voice=findOfflineVoice(id);
 if(!voice)throw Error('هذا الصوت المحلي غير معروف.');
 await installOfflineVoice(id);
 const tts=await library();
 // The third-party TtsSession singleton otherwise reuses the WRONG model when
 // the reader alternates Arabic and English. Reset only between model ids.
 if(lastSessionVoice!==voice.model){
  tts.TtsSession._instance=null;
  lastSessionVoice=voice.model;
 }
 const session=await tts.TtsSession.create({
  voiceId:voice.model,
  wasmPaths:{
   onnxWasm:'/tts-runtime/',
   piperData:'/tts-runtime/piper_phonemize.data',
   piperWasm:'/tts-runtime/piper_phonemize.wasm'
  }
 });
 return session.predict(String(text||'').trim());
}
function cut(text,max=170){
 const words=String(text||'').trim().split(/\s+/).filter(Boolean);
 const parts=[];let current='';
 for(const word of words){
  if((current+' '+word).trim().length>max&&current){parts.push(current);current=''}
  if(word.length>max){
   for(let i=0;i<word.length;i+=max)parts.push(word.slice(i,i+max));
  }else current=(current+' '+word).trim();
 }
 if(current)parts.push(current);
 return parts;
}
export function stopOfflineVoice(){
 if(!activePlayback)return;
 const playback=activePlayback;
 activePlayback=null;
 playback.stopped=true;
 playback.audio?.pause();
 if(playback.url)URL.revokeObjectURL(playback.url);
 playback.release?.();
}
export function pauseOfflineVoice(){
 if(!activePlayback?.audio)return false;
 activePlayback.audio.pause();return true;
}
export function resumeOfflineVoice(){
 if(!activePlayback?.audio)return false;
 void activePlayback.audio.play().catch(()=>{});
 return true;
}
/** speakParts-compatible cancellation interface. No WebSpeech replacement. */
export function speakOfflineVoiceParts(parts,speed,onStart,onDone,onError,preferred={},onChunk,volume=1){
 stopOfflineVoice();
 const queued=(parts||[]).flatMap(({text,lang})=>cut(text).map(chunk=>({text:chunk,lang})));
 const playback={stopped:false,audio:null,url:null,release:null};
 activePlayback=playback;
 let began=false;
 const run=async()=>{
  for(let i=0;i<queued.length;i++){
   if(playback.stopped)return;
   const item=queued[i];
   const id=preferred[item.lang?.slice(0,2)];
   if(!isOnDeviceVoice(id)||!findOfflineVoice(id)){
    throw Error('حتى تعمل القراءة المدمجة دون إنترنت، اختر نموذجًا محليًا لكل لغة في إعدادات الأصوات.');
   }
   const blob=await synthesizeOfflineVoice(item.text,id);
   if(playback.stopped)return;
   const url=URL.createObjectURL(blob);
   const audio=new Audio(url);
   playback.url=url;
   playback.audio=audio;
   audio.volume=Math.max(0,Math.min(1,Number(volume)||0));
   audio.playbackRate=Math.max(0.6,Math.min(2,Number(speed)||1));
   if('preservesPitch' in audio)audio.preservesPitch=true;
   await new Promise((resolve,reject)=>{
    let finished=false;
    const finish=err=>{
     if(finished)return;
     finished=true;playback.release=null;
     audio.onended=null;audio.onerror=null;
     audio.pause();
     URL.revokeObjectURL(url);
     if(playback.url===url)playback.url=null;
     if(playback.audio===audio)playback.audio=null;
     if(err)reject(err);else resolve();
    };
    playback.release=()=>finish();
    audio.onended=()=>finish();
    audio.onerror=()=>finish(Error('تعذر تشغيل الملف الصوتي المحلي.'));
    audio.play().then(()=>{
     if(playback.stopped){finish();return}
     onChunk?.({lang:item.lang,text:item.text,index:i,total:queued.length});
     if(!began){began=true;onStart?.()}
    }).catch(()=>finish(Error('المتصفح منع التشغيل التلقائي. اضغط زر التشغيل مرة أخرى.')));
   });
  }
  if(!playback.stopped){activePlayback=null;onDone?.()}
 };
 void run().catch(err=>{
  if(playback.stopped)return;
  activePlayback=null;
  onError?.(String(err?.message||'فشل تشغيل نموذج الصوت المحلي.'));
 });
 return ()=>{if(activePlayback===playback)stopOfflineVoice();else playback.stopped=true};
}
