import {onlineSpeechVoices,voiceQualityScore} from './systemVoices.js';
/** Script-aware reading helpers. No automatic translation is implied. */
export function sourceLanguage(text = '') {
  const arabic = (String(text).match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (String(text).match(/[a-zA-Z]/g) || []).length;
  return arabic > latin ? 'ar' : 'en';
}
const filled = text => typeof text === 'string' && text.trim().length > 0;
const part = (lang,text) => filled(text) ? [{lang,text:text.trim()}] : [];

export function speechParts(section, track, purpose = 'read') {
  if (!section) return [];
  const language = sourceLanguage(section.content_en);
  const originalEnglish = language === 'en' ? section.content_en : '';
  const originalArabic = language === 'ar' ? section.content_en : '';
  // NEVER use explanation scripts to read the original document: the two modes are independent.
  const english = purpose === 'explain'
    ? section.explanation_en
    : originalEnglish;
  const arabic = purpose === 'explain'
    ? section.explanation_ar
    : (section.content_ar || originalArabic);
  if (track === 'en') return part('en-US', english);
  if (track === 'ar') return part('ar-SA', arabic);
  if (purpose === 'explain') {
    // Bilingual listening is the ENGLISH explanation followed by the
    // ARABIC explanation of the SAME section; not a mixed-language paraphrase.
    return filled(english) && filled(arabic)
      ? [...part('en-US', english), ...part('ar-SA', arabic)] : [];
  }
  return filled(originalEnglish) && filled(arabic)
    ? [...part('en-US', originalEnglish), ...part('ar-SA', arabic)] : [];
}

/** Split mixed-script sentences so English terminology is pronounced by an English voice. */
export function splitMixedSpeech(text) {
  if (!filled(text)) return [];
  const tokens=String(text).match(/\S+\s*/gu)||[];
  const parts=[];
  let lang='',buffer='';
  const emit=()=>{if(buffer.trim())parts.push({lang,text:buffer.trim()});};
  for(const token of tokens) {
    // Symbols/numbers inherit the preceding language. Pure text selects its language.
    const a=(token.match(/[\u0600-\u06FF]/gu)||[]).length;
    const e=(token.match(/[a-zA-Z]/g)||[]).length;
    const next=a>e?'ar-SA':e>a?'en-US':(lang||'ar-SA');
    if(lang && next!==lang){emit();buffer='';}
    lang=next;buffer+=token;
  }
  emit();
  return parts;
}

export function chunkText(text, limit = 190) {
  const plain=String(text||'').replace(/\s+/g,' ').trim();
  if(!plain)return [];
  const result=[];
  const sentences=plain.split(/(?<=[.!?؟؛،])\s+/u);
  let buffer='';
  const flush=()=>{if(buffer){result.push(buffer);buffer=''}};
  for(const sentence of sentences){
    if(!sentence)continue;
    if((buffer+' '+sentence).trim().length <= limit){ buffer=(buffer+' '+sentence).trim();continue; }
    flush();
    if(sentence.length<=limit){buffer=sentence;continue;}
    for(const word of sentence.split(/\s+/)){
      if((buffer+' '+word).trim().length<=limit){buffer=(buffer+' '+word).trim();continue;}
      flush();
      if(word.length<=limit){buffer=word;continue;}
      for(let i=0;i<word.length;i+=limit)result.push(word.slice(i,i+limit));
    }
  }
  flush();
  return result;
}

let adaptivePlayback=null;
export function stopSpeech() {
  const active=adaptivePlayback;adaptivePlayback=null;active?.cancel();
  if(typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
export function pauseSpeech(){
 if(adaptivePlayback){adaptivePlayback.pause();return;}
 if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.pause();
}
export function resumeSpeech(){
 if(adaptivePlayback){adaptivePlayback.resume();return;}
 if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.resume();
}

export const ONLINE_VOICE_UNAVAILABLE_EVENT='hsa:online-voice-unavailable';
const failedOnlineSpeakers=new Set();
export function retryOnlineVoices(){failedOnlineSpeakers.clear()}
const realVoiceId=v=>String(v?.voiceURI||'').trim().toLowerCase()
 ||(String(v?.name||'').trim().toLowerCase()+'|'+String(v?.lang||'').toLowerCase());
function markFailedVoice(voice){
 if(!voice)return;
 failedOnlineSpeakers.add(realVoiceId(voice));
 try{
  if(typeof window!=='undefined'&&typeof Event!=='undefined')
   window.dispatchEvent?.(new Event(ONLINE_VOICE_UNAVAILABLE_EVENT));
 }catch{/* Older browser: next voice enumeration will reflect the failure. */}
}
export function getAvailableVoices() {
 if(typeof window==='undefined'||!('speechSynthesis' in window))return [];
 return onlineSpeechVoices(window.speechSynthesis.getVoices())
  .filter(v=>!failedOnlineSpeakers.has(realVoiceId(v)))
  .map(v=>({name:v.name,lang:v.lang,voiceURI:v.voiceURI||'',
   gender:v.gender||'',default:Boolean(v.default),localService:false}));
}
/** Kept for compatibility with old read-only tests; never offered for playback. */
export function isOfflineVoice(voice){return voice?.localService===true}
const offlineNow=()=>typeof navigator!=='undefined'&&navigator.onLine===false;
const OFFLINE_VOICE_MESSAGE='القراءة الصوتية تستخدم أصوات الإنترنت فقط حسب اختيارك. اتصل بالإنترنت ثم اختر أحد الأصوات السحابية المتاحة في المتصفح.';
function selectVoice(synth, lang, preferred={},allowLocal=false) {
  const wanted=lang.toLowerCase();
  const code=wanted.slice(0,2);
  // Match the catalogue's ranking: when provider names are repeated across
  // locales, the selected browser voice must be the same preferred variant.
  const voices=(allowLocal?compatibleNativeVoices(synth.getVoices(),code):onlineSpeechVoices(synth.getVoices()))
   .filter(v=>!failedOnlineSpeakers.has(realVoiceId(v)))
   .sort((a,b)=>voiceQualityScore(b,code)-voiceQualityScore(a,code));
  const name=preferred[code];
  if(name){
    const match=voices.find(v=>v.name===name&&v.lang.toLowerCase().startsWith(code));
    // A saved speaker must NEVER silently fall back to a different speaker.
    return match||null;
  }
  const matches=voices.filter(v=>v.lang.toLowerCase().startsWith(code));
  const natural=matches.find(v=>/natural|neural|enhanced|high.?quality/i.test(v.name));
  return natural||matches.find(v=>v.lang.toLowerCase()===wanted)||matches[0]||null;
}

/** A controlled queue of short utterances avoids silent failure on long imported paragraphs. */
export function speakParts(parts, speed = 1, onStart, onDone, onError, preferredVoices={}, onChunk, volume=1, onBoundary, options={}) {
  if(typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined'){
    onError?.('القراءة الصوتية غير مدعومة في هذا المتصفح. جرّب متصفحًا حديثًا يدعم الأصوات.');
    return ()=>{};
  }
  const synth=window.speechSynthesis;
  const queue=(parts||[]).flatMap(({text,lang})=>chunkText(text).map(chunk=>({text:chunk,lang})));
  if(offlineNow()){
   onError?.(OFFLINE_VOICE_MESSAGE);
   return ()=>{};
  }
  if(!queue.length) {
    onError?.('لا يوجد نص لهذا المسار. أضف الترجمة أو الشرح أولًا.');
    return ()=>{};
  }
  const allowLocal=options.allowLocal===true;
  const missing = [...new Set(queue.map(p=>p.lang))].filter(lang=>!selectVoice(synth,lang,preferredVoices,allowLocal));
  // Never claim success while the browser has not provided its voice catalogue.
  if(!allowLocal&&getAvailableVoices().length===0){
    onError?.('لا توجد أصوات سحابية متاحة حاليًا في هذا المتصفح. تأكد من اتصال الإنترنت أو استخدم متصفحًا يتيح أصواتًا متصلة.');
    return ()=>{};
  }
  if(missing.length > 0) {
    onError?.(missing.some(lang=>lang.startsWith('ar'))
      ? 'الصوت العربي المختار غير متوفر حاليًا. اختر صوتًا عربيًا متاحًا أو أعد تثبيته.'
      : 'الصوت الإنجليزي المختار غير متوفر حاليًا. اختر صوتًا إنجليزيًا متاحًا.');
    return ()=>{};
  }
  const languages=[...new Set(queue.map(item=>item.lang))];
  const speakers=languages.map(lang=>selectVoice(synth,lang,preferredVoices,allowLocal));
  // All permitted speakers have localService === false: no OS/offline fallback.
  const networkVoice=true;
  if(!options.skipCancel)synth.cancel();
  let index=0, cancelled=false, started=false, completed=false;
  const lostConnection=()=>{if(networkVoice)fail(OFFLINE_VOICE_MESSAGE)};
  let currentUtterance=null,startTimer=null;
  const cleanup=()=>{window.removeEventListener?.('offline',lostConnection);if(startTimer!==null){clearTimeout(startTimer);startTimer=null;}if(currentUtterance){currentUtterance.onstart=null;currentUtterance.onend=null;currentUtterance.onerror=null;currentUtterance.onboundary=null;}currentUtterance=null;};
  const fail=msg=>{
    if(cancelled||completed)return;
    completed=true;cancelled=true;cleanup();synth.cancel();onError?.(msg);
  };
  // Network speakers must stop when the connection drops instead of degrading
  // silently to an unrelated low-quality browser/OS fallback.
  if(networkVoice)window.addEventListener?.('offline',lostConnection);
  const run=()=>{
    if(cancelled||completed)return;
    if(index>=queue.length){completed=true;cleanup();onDone?.();return;}
    const chunkIndex=index;
    const {text,lang}=queue[index++];
    const u=new SpeechSynthesisUtterance(text);currentUtterance=u;
    u.lang=lang;u.rate=Number(speed)||1;u.pitch=1;u.volume=Math.min(1,Math.max(0,Number(volume)||0));
    const voice=selectVoice(synth,lang,preferredVoices,allowLocal);
    if(!voice){
      fail('الصوت السحابي المختار لم يعد متاحًا. اختر صوتًا آخر من القائمة.');
      return;
    }
    if(offlineNow()){fail(OFFLINE_VOICE_MESSAGE);return;}
    u.voice=voice;
    // For example, a selected en-GB speaker should not be instructed to
    // synthesize in en-US solely because the study track is English.
    u.lang=voice.lang||lang;
    let utteranceStarted=false;
    // Some browsers silently leave unavailable network voices queued forever.
    const startTimeout=startTimer=setTimeout(()=>{
      if(cancelled||utteranceStarted)return;
      markFailedVoice(voice);
      fail('لم يبدأ هذا الصوت السحابي في الوقت المتوقع. أزلناه من قائمة الأصوات لهذه الجلسة؛ جرّب صوتًا آخر.');
    },18000);
    const clearStartTimeout=()=>{clearTimeout(startTimeout);if(startTimer===startTimeout)startTimer=null;};
    u.onstart=()=>{
      clearStartTimeout();utteranceStarted=true;
      if(cancelled)return;
      if(offlineNow()){fail(OFFLINE_VOICE_MESSAGE);return;}
      onChunk?.({lang,text,index:chunkIndex,total:queue.length});
      if(!started){started=true;onStart?.()}
    };
    u.onboundary=e=>{if(!cancelled&&utteranceStarted&&Number.isInteger(e.charIndex))onBoundary?.({index:chunkIndex,charIndex:e.charIndex,charLength:e.charLength||0,name:e.name});};
    u.onend=()=>{
      clearStartTimeout();
      if(cancelled)return;
      if(!utteranceStarted){
       markFailedVoice(voice);
       fail('لم يؤكد المتصفح بدء الصوت المختار؛ استُبعد من القائمة لهذه الجلسة.');
       return;
      }
      run();
    };
    u.onerror=e=>{
      clearStartTimeout();
      if(cancelled||completed)return;
      if(['canceled','interrupted'].includes(e.error)){fail('توقف الصوت قبل اكتمال القراءة. اضغط تشغيل للمتابعة.');return;}
      if(['voice-unavailable','language-unavailable','synthesis-failed'].includes(e.error))
       markFailedVoice(voice);
      fail(offlineNow()?OFFLINE_VOICE_MESSAGE:
       ['voice-unavailable','language-unavailable','synthesis-failed'].includes(e.error)
        ?'فشل الصوت السحابي المحدد؛ استُبعد من القائمة لهذه الجلسة. اختر صوتًا آخر.'
        :e.error==='not-allowed'?'اسمح للموقع بتشغيل الصوت ثم أعد المحاولة.'
        :'تعذر تشغيل الصوت السحابي. تحقق من اتصال الإنترنت والصوت ثم أعد المحاولة.');
    };
    try{if(synth.paused)synth.resume();synth.speak(u)}catch{
      clearStartTimeout();markFailedVoice(voice);
      fail('تعذّر بدء الصوت السحابي؛ جرّب صوتًا آخر من القائمة.');
    }
  };
  run();
  return ()=>{cancelled=true;completed=true;cleanup();synth.cancel()};
}

export const COMPATIBILITY_VOICES=Object.freeze({ar:{id:'compat:ar',label:'صوت عربي تلقائي',lang:'ar-SA',compatibility:true},en:{id:'compat:en',label:'Automatic English',lang:'en-GB',compatibility:true}});
export const INDEPENDENT_VOICE_IDS=Object.freeze({ar:'piper:hsa-emirati-female',en:'piper:en_GB-alan-medium'});
export function compatibleNativeVoices(voices,language,preferred=''){
 const seen=new Set(),list=(Array.isArray(voices)?voices:[]).filter(v=>{
  if(!v?.name||!String(v.lang||'').toLowerCase().startsWith(language)||failedOnlineSpeakers.has(realVoiceId(v)))return false;
  if(/(?:^|\W)(?:saba|sabah|سبا|صبا)(?:$|\W)/i.test(v.name))return false;
  const id=realVoiceId(v);if(seen.has(id))return false;seen.add(id);return true;
 });
 const rank=v=>(v.name===preferred?10000:0)+(v.localService===false?500:0)+(/natural|neural|enhanced|premium/i.test(v.name)?100:0)+((language==='ar'?/^ar-SA/i:/^en-GB/i).test(v.lang)?30:0)+(v.default?5:0)-(/robot|espeak|legacy/i.test(v.name)?200:0);
 return list.sort((a,b)=>rank(b)-rank(a));
}
export function compatibleVoiceGroups(groups,language){
 return {...groups,other:[COMPATIBILITY_VOICES[language],...(groups.other||[])]};
}
export async function prepareIndependentVoice(language){
 const id=INDEPENDENT_VOICE_IDS[language];if(!id)throw Error('لغة الصوت غير مدعومة.');
 const engine=await import('./offlineVoice.js');
 if(!engine.canUseOfflineModels())throw Error('هذا الجهاز لا يتيح تجهيز الصوت المستقل. حدّث المتصفح أو استخدم صوت النظام.');
 await engine.installOfflineVoice(id);
 return id;
}
export const VOICE_FALLBACK_EVENT='hsa:voice-compatibility';
function fallbackNotice(language,method){
 try{window.dispatchEvent(new CustomEvent(VOICE_FALLBACK_EVENT,{detail:{language,method}}));}catch{}
}
/** A single ordered playback controller. Try the requested real voice, then
 * another actual voice of the same language, then an explicitly prepared
 * independent neural model. Never use an English voice for Arabic text.
 * Heavy models are loaded only when the user asks to prepare them. */
export function speakAdaptiveParts(parts,speed=1,onStart,onDone,onError,preferred={},onChunk,volume=1,onBoundary,options={}){
 stopSpeech();
 const queue=(parts||[]).flatMap(({lang,text})=>chunkText(text).map(text=>({lang,text})));
 if(!queue.length){onError?.('لا يوجد نص جاهز للاستماع.');return ()=>{};}
 if(typeof window==='undefined'){onError?.('الاستماع غير متاح في هذا الجهاز.');return ()=>{};}
 let cancelled=false,paused=false,started=false,release=null,waitResume=null,child=null,engine=null,context=null,source=null;
 const announced=new Set();
 const announce=(lang,method)=>{const key=lang+':'+method;if(!announced.has(key)){announced.add(key);fallbackNotice(lang,method)}};
 // Open Web Audio synchronously during the actual play gesture when it may
 // be needed. No model download or inference occurs here.
 try{const C=window.AudioContext||window.webkitAudioContext;if(C&&globalThis.navigator?.userActivation?.isActive!==false){context=new C();void context.resume().catch(()=>{});}}catch{}
 const close=()=>{if(context){void context.close().catch(()=>{});context=null;}engine?.releaseIndependentInference?.();};
 const controller={cancel(){cancelled=true;child?.();try{source?.stop()}catch{}release?.();waitResume?.();close();},pause(){paused=true;if(source&&context)void context.suspend().catch(()=>{});else window.speechSynthesis?.pause?.();},resume(){paused=false;if(context&&source)void context.resume().catch(()=>{});else window.speechSynthesis?.resume?.();waitResume?.();}};
 adaptivePlayback=controller;
 const done=()=>{if(adaptivePlayback===controller)adaptivePlayback=null;close();};
 const begin=(item,index)=>{if(cancelled)return;onChunk?.({...item,index,total:queue.length});if(!started){started=true;onStart?.();}};
 const wait=async()=>{if(paused&&!cancelled)await new Promise(resolve=>{waitResume=resolve});waitResume=null;};
 const playNative=(item,index,voice)=>new Promise(resolve=>{
  let began=false,settled=false;
  const finish=ok=>{if(settled)return;settled=true;release=null;resolve({ok,began});};
  release=()=>finish(false);
  child=speakParts([item],speed,()=>{began=true;begin(item,index)},()=>finish(true),()=>finish(false),{[item.lang.slice(0,2)]:voice.name},undefined,volume,event=>{if(!cancelled)onBoundary?.({...event,index})},{allowLocal:voice.localService!==false,skipCancel:true});
 });
 const playIndependent=async(item,index,language)=>{
  engine=await import('./offlineVoice.js');
  const id=INDEPENDENT_VOICE_IDS[language];
  const ready=await engine.storedIndependentVoiceReady(id);
  if(!ready)throw Error('لا يوجد صوت '+(language==='ar'?'عربي':'إنجليزي')+' متاح. من إعدادات الاستماع اختر «تجهيز الصوت المستقل» مرة واحدة.');
  if(cancelled)return;
  announce(language,'independent');
  const blob=await engine.synthesizeOfflineVoice(item.text,id);
  if(cancelled)return;await wait();if(cancelled)return;
  if(!context){const C=window.AudioContext||window.webkitAudioContext;if(C){context=new C();}}
  if(context){
   await context.resume();
   const buffer=await context.decodeAudioData(await blob.arrayBuffer());
   if(cancelled)return;
   const node=context.createBufferSource(),gain=context.createGain();source=node;
   node.buffer=buffer;node.playbackRate.value=Math.max(.6,Math.min(2,Number(speed)||1));gain.gain.value=Math.min(1,Math.max(0,Number(volume)||0));node.connect(gain);gain.connect(context.destination);
   await new Promise((resolve,reject)=>{let ended=false;const finish=()=>{if(ended)return;ended=true;release=null;node.onended=null;try{node.disconnect();gain.disconnect()}catch{}source=null;resolve()};release=finish;node.onended=finish;try{node.start();begin(item,index)}catch(e){finish();reject(e)}});
  }else{
   const url=URL.createObjectURL(blob),audio=new Audio(url);audio.playbackRate=Number(speed)||1;audio.volume=Number(volume)||0;
   const previousChild=child;child=()=>{audio.pause();previousChild?.();};
   await new Promise((resolve,reject)=>{let ended=false;const finish=e=>{if(ended)return;ended=true;release=null;audio.pause();URL.revokeObjectURL(url);e?reject(e):resolve()};release=()=>finish();audio.onended=()=>finish();audio.onerror=()=>finish(Error('تعذّر تشغيل الصوت المستقل.'));audio.play().then(()=>{if(!cancelled)begin(item,index)}).catch(()=>finish(Error('اضغط تشغيل للسماح بالصوت.')))});
  }
 };
 const run=async()=>{
  for(let index=0;index<queue.length;index++){
   await wait();if(cancelled)return;
   const item=queue[index],language=item.lang.slice(0,2),preferredId=preferred[language]||'';
   if(!INDEPENDENT_VOICE_IDS[language])throw Error('لغة القراءة غير مدعومة.');
   const native=typeof SpeechSynthesisUtterance!=='undefined'?compatibleNativeVoices(window.speechSynthesis?.getVoices?.(),language,preferredId):[];
   let played=false;
   if(!preferredId.startsWith('piper:')&&(!offlineNow())){
    for(const voice of native.slice(0,4)){
     if(cancelled)return;
     if(options.strictPreview&&preferredId&&!preferredId.startsWith('compat:')&&voice.name!==preferredId)continue;
     const result=await playNative(item,index,voice);if(cancelled)return;
     if(result.ok){played=true;if(voice.localService===true||preferredId&&!preferredId.startsWith('compat:')&&preferredId!==voice.name)announce(language,'native');break;}
     child?.();child=null;
     if(result.began)throw Error('توقف الصوت أثناء القراءة. اضغط تشغيل للمحاولة مجددًا.');
    }
   }
   if(!played){if(options.strictPreview&&preferredId&&!preferredId.startsWith('compat:')&&!preferredId.startsWith('piper:'))throw Error('تعذّر تشغيل الصوت المختار. جرّب الصوت التلقائي.');await playIndependent(item,index,language);}
  }
  if(!cancelled){done();onDone?.();}
 };
 void run().catch(e=>{if(cancelled)return;done();onError?.(String(e?.message||'تعذّر تشغيل الصوت.'))});
 return ()=>{if(adaptivePlayback===controller)adaptivePlayback=null;controller.cancel()};
}
