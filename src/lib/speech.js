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

export function getAvailableVoices() {
  if(typeof window==='undefined'||!('speechSynthesis' in window))return [];
  return window.speechSynthesis.getVoices().map(v=>({name:v.name,lang:v.lang,default:Boolean(v.default),localService:Boolean(v.localService)}));
}
function selectVoice(synth, lang, preferred={}) {
  const voices=synth.getVoices();
  const wanted=lang.toLowerCase();
  const code=wanted.slice(0,2);
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
export function speakParts(parts, speed = 1, onStart, onDone, onError, preferredVoices={}, onChunk, volume=1) {
  if(typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined'){
    onError?.('القراءة الصوتية غير مدعومة في هذا المتصفح. جرّب متصفحًا حديثًا يدعم الأصوات.');
    return ()=>{};
  }
  const synth=window.speechSynthesis;
  const queue=(parts||[]).flatMap(({text,lang})=>chunkText(text).map(chunk=>({text:chunk,lang})));
  if(!queue.length) {
    onError?.('لا يوجد نص لهذا المسار. أضف الترجمة أو الشرح أولًا.');
    return ()=>{};
  }
  const missing = [...new Set(queue.map(p=>p.lang))].filter(lang=>!selectVoice(synth,lang));
  // Never claim success while the browser has not provided its voice catalogue.
  if(synth.getVoices().length===0){
    onError?.('الأصوات غير جاهزة بعد في المتصفح. افتح قائمة الأصوات مجددًا ثم أعد المحاولة.');
    return ()=>{};
  }
  if(missing.length > 0) {
    onError?.(missing.some(lang=>lang.startsWith('ar'))
      ? 'الصوت العربي المختار غير متوفر حاليًا. اختر صوتًا عربيًا متاحًا أو أعد تثبيته.'
      : 'الصوت الإنجليزي المختار غير متوفر حاليًا. اختر صوتًا إنجليزيًا متاحًا.');
    return ()=>{};
  }
  stopSpeech();
  let index=0, cancelled=false, started=false, completed=false;
  const fail=msg=>{
    if(cancelled||completed)return;
    completed=true;cancelled=true;synth.cancel();onError?.(msg);
  };
  const run=()=>{
    if(cancelled||completed)return;
    if(index>=queue.length){completed=true;onDone?.();return;}
    const chunkIndex=index;
    const {text,lang}=queue[index++];
    const u=new SpeechSynthesisUtterance(text);
    u.lang=lang;u.rate=Number(speed)||1;u.pitch=1;u.volume=Math.min(1,Math.max(0,Number(volume)||0));
    const voice=selectVoice(synth,lang,preferredVoices);if(voice)u.voice=voice;
    u.onstart=()=>{if(cancelled)return;onChunk?.({lang,text,index:chunkIndex,total:queue.length});if(!started){started=true;onStart?.()}};
    u.onend=()=>{if(!cancelled)run()};
    u.onerror=e=>{
      if(cancelled||['canceled','interrupted'].includes(e.error))return;
      fail(e.error==='language-unavailable'||e.error==='voice-unavailable'
        ? 'صوت اللغة المطلوبة غير متوفر. تحقق من تثبيت أصوات اللغة في النظام.'
        : 'تعذر تشغيل الصوت. تحقق من إعدادات المتصفح والصوت ثم أعد المحاولة.');
    };
    try{synth.speak(u)}catch{fail('تعذر تشغيل القراءة الصوتية في المتصفح.')}
  };
  run();
  return ()=>{cancelled=true;completed=true;stopSpeech()};
}
