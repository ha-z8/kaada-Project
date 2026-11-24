import {isCloudVoice,findCloudVoice} from './cloudVoiceCatalog.js';
const ENDPOINT='/.netlify/functions/cloud-tts';
let active=null;
const isOffline=()=>typeof navigator!=='undefined'&&navigator.onLine===false;

export async function cloudTtsStatus(signal){
 try{
  const response=await fetch(ENDPOINT,{method:'GET',cache:'no-store',signal});
  if(!response.ok)return {ready:false,message:'خدمة الصوت السحابي غير متاحة حاليًا.'};
  const data=await response.json();
  return {ready:data?.ready===true,message:data?.ready
   ?'الأصوات السحابية الاثنا عشر جاهزة'
   :'يلزم إعداد GOOGLE_CLOUD_TTS_API_KEY في Netlify لتفعيل الأصوات الاثني عشر.'};
 }catch{
  return {ready:false,message:'تعذّر التحقق من اتصال خدمة الأصوات السحابية.'};
 }
}
function textChunks(text,max=600){
 const words=String(text||'').trim().split(/\s+/u);
 const list=[];
 let value='';
 for(const word of words){
  if(!word)continue;
  if(word.length>max){
   if(value){list.push(value);value=''}
   for(let i=0;i<word.length;i+=max)list.push(word.slice(i,i+max));
  }else if(!value)value=word;
  else if((value+' '+word).length<=max)value+=' '+word;
  else{list.push(value);value=word}
 }
 if(value)list.push(value);
 return list;
}
export function stopCloudSpeech(){
 if(!active)return false;
 const job=active;active=null;job.cancelled=true;
 job.controller?.abort();
 if(job.audio){
  job.audio.onended=null;job.audio.onerror=null;job.audio.onplaying=null;
  job.audio.pause();job.audio.removeAttribute('src');job.audio.load();
 }
 if(job.url)URL.revokeObjectURL(job.url);
 return true;
}
export function pauseCloudSpeech(){
 if(!active?.audio||active.cancelled)return false;
 active.audio.pause();return true;
}
export function resumeCloudSpeech(){
 if(!active?.audio||active.cancelled)return false;
 void active.audio.play().catch(()=>active?.fail?.('لم يسمح المتصفح باستئناف الصوت. اضغط تشغيل مجددًا.'));
 return true;
}
export function speakCloudParts(parts,speed=1,onStart,onDone,onError,preferredVoices={},onChunk,volume=1){
 stopCloudSpeech();
 if(isOffline()){
  onError?.('الأصوات السحابية تحتاج اتصالًا بالإنترنت.');return ()=>{};
 }
 if(typeof Audio==='undefined'||typeof URL?.createObjectURL!=='function'){
  onError?.('تعذّر تشغيل ملفات الصوت في هذا المتصفح.');return ()=>{};
 }
 const tasks=(parts||[]).flatMap(part=>textChunks(part.text).map(text=>({
  lang:part.lang?.slice(0,2),text
 })));
 if(!tasks.length){onError?.('لا يوجد نص للاستماع.');return ()=>{}}
 if(tasks.some(t=>!isCloudVoice(preferredVoices[t.lang])
  ||findCloudVoice(preferredVoices[t.lang])?.lang!==t.lang)){
  onError?.('يجب اختيار صوت سحابي مستقل لكل لغة قبل التشغيل.');return ()=>{}
 }
 const job={cancelled:false,controller:null,audio:null,url:null,fail:null};
 active=job;
 let index=0,started=false;
 const free=()=>{
  if(job.url){URL.revokeObjectURL(job.url);job.url=null}
  job.audio=null;
 };
 const fail=message=>{
  if(job.cancelled)return;
  stopCloudSpeech();
  onError?.(message);
 };
 job.fail=fail;
 const next=async()=>{
  if(job.cancelled)return;
  if(index>=tasks.length){
   active=null;free();job.cancelled=true;onDone?.();return;
  }
  const task=tasks[index],voiceId=preferredVoices[task.lang];
  const controller=new AbortController();job.controller=controller;
  const timeout=setTimeout(()=>controller.abort(),32000);
  try{
   const response=await fetch(ENDPOINT,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({voiceId,text:task.text}),signal:controller.signal,
    cache:'no-store'
   });
   if(job.cancelled)return;
   if(!response.ok){
    const data=await response.json().catch(()=>null);
    throw Error(data?.message||'فشل الاتصال بمزوّد الصوت.');
   }
   const blob=await response.blob();
   if(job.cancelled)return;
   if(blob.type&&!blob.type.includes('audio/'))
    throw Error('وصل ملف غير صوتي من الخادم.');
   job.url=URL.createObjectURL(blob);
   const audio=new Audio();job.audio=audio;
   audio.preload='auto';audio.src=job.url;
   audio.playbackRate=Math.max(0.65,Math.min(1.8,Number(speed)||1));
   audio.volume=Math.min(1,Math.max(0,Number(volume)||0));
   audio.onplaying=()=>{
    if(job.cancelled)return;
    onChunk?.({lang:task.lang,index,total:tasks.length,text:task.text});
    if(!started){started=true;onStart?.()}
   };
   audio.onerror=()=>fail('تعذّر تشغيل الملف الصوتي. جرّب الضغط على تشغيل مرة أخرى.');
   audio.onended=()=>{
    if(job.cancelled)return;
    audio.onended=null;free();index++;void next();
   };
   await audio.play();
  }catch(error){
   if(job.cancelled)return;
   const message=controller.signal.aborted
    ?'تأخرت خدمة الصوت عن الاستجابة. أعد المحاولة.'
    :/NotAllowedError/i.test(String(error?.name))
     ?'يحتاج المتصفح السماح بتشغيل الصوت. اضغط تشغيل أو تجربة الصوت مرة أخرى.'
     :String(error?.message||'تعذّر إنشاء الصوت الآن.');
   fail(message);
  }finally{clearTimeout(timeout)}
 };
 // One click starts one queue. Never replace a requested speaker.
 void next();
 return ()=>{if(active===job)stopCloudSpeech()};
}
