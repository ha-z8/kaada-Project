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

export function stopSpeech() {
  if(typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
export function pauseSpeech(){
 if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.pause();
}
export function resumeSpeech(){
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
function selectVoice(synth, lang, preferred={}) {
  const wanted=lang.toLowerCase();
  const code=wanted.slice(0,2);
  // Match the catalogue's ranking: when provider names are repeated across
  // locales, the selected browser voice must be the same preferred variant.
  const voices=onlineSpeechVoices(synth.getVoices())
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
export function speakParts(parts, speed = 1, onStart, onDone, onError, preferredVoices={}, onChunk, volume=1, onBoundary) {
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
  const missing = [...new Set(queue.map(p=>p.lang))].filter(lang=>!selectVoice(synth,lang,preferredVoices));
  // Never claim success while the browser has not provided its voice catalogue.
  if(getAvailableVoices().length===0){
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
  const speakers=languages.map(lang=>selectVoice(synth,lang,preferredVoices));
  // All permitted speakers have localService === false: no OS/offline fallback.
  const networkVoice=true;
  stopSpeech();
  let index=0, cancelled=false, started=false, completed=false;
  const lostConnection=()=>{if(networkVoice)fail(OFFLINE_VOICE_MESSAGE)};
  let currentUtterance=null;
  const cleanup=()=>{window.removeEventListener?.('offline',lostConnection);currentUtterance=null;};
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
    const voice=selectVoice(synth,lang,preferredVoices);
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
    const startTimeout=setTimeout(()=>{
      if(cancelled||utteranceStarted)return;
      markFailedVoice(voice);
      fail('لم يبدأ هذا الصوت السحابي في الوقت المتوقع. أزلناه من قائمة الأصوات لهذه الجلسة؛ جرّب صوتًا آخر.');
    },18000);
    const clearStartTimeout=()=>clearTimeout(startTimeout);
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
  return ()=>{cancelled=true;completed=true;cleanup();stopSpeech()};
}
