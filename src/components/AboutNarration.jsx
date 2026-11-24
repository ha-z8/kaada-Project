import {voiceCompatibility} from '../lib/systemVoices.js';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  Volume2,VolumeX,Play,Pause,Square,RotateCcw,SkipBack,SkipForward,
  Headphones,AlertCircle,ChevronDown,ChevronUp
} from 'lucide-react';
import {aboutNarrationChunks} from '../lib/aboutNarration.js';
import {speakParts,stopSpeech,pauseSpeech,resumeSpeech} from '../lib/speech.js';

const MUTE_STORAGE_KEY='hsa-about-narration-muted-v1';
const COLLAPSED_STORAGE_KEY='hsa-about-narration-collapsed-v1';
const speakSupported=()=>typeof window!=='undefined'
 &&'speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined';

function initialMute(){
 try{return localStorage.getItem(MUTE_STORAGE_KEY)==='true'}catch{return false}
}
export default function AboutNarration({
 settings,voiceName='',voiceGroups, onVoiceChange=()=>{},
 speed=1,onSpeedChange=()=>{},volume=1
}){
 const parts=useMemo(()=>aboutNarrationChunks(settings),[settings]);
 const [muted,setMuted]=useState(initialMute);
 const [collapsed,setCollapsed]=useState(()=>{
  try{return localStorage.getItem(COLLAPSED_STORAGE_KEY)==='true'}
  catch{return false}
 });
 const [status,setStatus]=useState('starting');
 const [notice,setNotice]=useState('');
 const [chunkIndex,setChunkIndex]=useState(0);
 const [rate,setRate]=useState(speed);
 const stopRef=useRef(null);
 const pendingTimer=useRef(null);
 const statusRef=useRef('starting');
 const mutedRef=useRef(muted);
 const rateRef=useRef(rate);
 const partsRef=useRef(parts);
 const voiceNameRef=useRef(voiceName);
 const volumeRef=useRef(volume);
 mutedRef.current=muted;
 rateRef.current=rate;
 partsRef.current=parts;
 voiceNameRef.current=voiceName;
 volumeRef.current=volume;
 const voiceChoices=useMemo(()=>[...(voiceGroups?.female||[]),...(voiceGroups?.male||[])]
  .filter(v=>v?.id&&v.localService===false)
  .map(v=>({value:v.id,localService:false,label:v.label||v.id,compatibility:voiceCompatibility(v)})),[voiceGroups]);
 const setCollapsedSaved=value=>{
  setCollapsed(value);
  try{localStorage.setItem(COLLAPSED_STORAGE_KEY,String(value))}catch{}
 };
 const setPhase=useCallback(next=>{
  statusRef.current=next;
  setStatus(next);
 },[]);
 const cancel=useCallback(()=>{
  if(pendingTimer.current!==null){
   clearTimeout(pendingTimer.current);
   pendingTimer.current=null;
  }
  if(stopRef.current){
   const stop=stopRef.current;
   stopRef.current=null;
   stop();
  }else stopSpeech();
 },[]);
 const startAt=useCallback((offset=0)=>{
  cancel();
  const queue=partsRef.current;
  if(!queue.length){
   setPhase('unavailable');setNotice('لا يوجد محتوى صوتي متاح في هذه الصفحة.');return;
  }
  if(!speakSupported()){
   setPhase('unavailable');setNotice('القراءة الصوتية غير مدعومة في هذا المتصفح.');return;
  }
  if(mutedRef.current){
   setPhase('muted');setNotice('الصوت مكتوم. اضغط إلغاء الكتم للاستماع.');return;
  }
  const voices=window.speechSynthesis.getVoices();
  if(!voices.length){
   setPhase('voices-loading');
   setNotice('جارٍ تجهيز الأصوات. إذا لم يبدأ الشرح تلقائيًا، اضغط تشغيل.');
   return;
  }
  if(navigator.onLine===false){
   setPhase('unavailable');
   setNotice('هذا الشرح يستخدم أصوات الإنترنت فقط. اتصل بالإنترنت لإعادة تشغيله.');
   return;
  }
  if(!voices.some(v=>v.localService===false
    &&String(v.lang||'').toLowerCase().startsWith('ar'))){
   setPhase('unavailable');
   setNotice('لا يوجد صوت عربي سحابي متاح في هذا المتصفح حاليًا. جرّب متصفحًا يوفّر أصوات الإنترنت.');
   return;
  }
  // Use the EXACT same voice as the curriculum player. Never switch a missing
  // pinned speaker to another voice without the user's explicit selection.
  if(!voiceNameRef.current){
   setPhase('unavailable');
   setNotice('الصوت العربي المختار في مشغّل المواد غير متوفر. اختر صوتًا عربيًا من القائمة نفسها.');
   return;
  }
  const start=Math.min(Math.max(0,offset),queue.length-1);
  setChunkIndex(start);
  setPhase('starting');
  setNotice('جارٍ بدء الشرح الصوتي بالعربية...');
  const selected=queue.slice(start).map(({text,lang})=>({text,lang}));
  const clearTimer=()=>{
   if(pendingTimer.current!==null){
    clearTimeout(pendingTimer.current);
    pendingTimer.current=null;
   }
  };
  stopRef.current=speakParts(selected,rateRef.current,
   ()=>{clearTimer();setPhase('playing');setNotice('')},
   ()=>{clearTimer();stopRef.current=null;setChunkIndex(queue.length);
    setPhase('complete');setNotice('اكتمل الشرح الصوتي للصفحة.')},
   message=>{clearTimer();stopRef.current=null;
    setPhase('blocked');setNotice(message+' اضغط تشغيل للمحاولة مجددًا.')},
   {ar:voiceNameRef.current},
   ({index})=>{
    clearTimer();
    setChunkIndex(start+index);
    setPhase('playing');
   },volumeRef.current
  );
  // Browsers can silently block non-interactive speech without firing onerror.
  pendingTimer.current=setTimeout(()=>{
   pendingTimer.current=null;
   if(statusRef.current!=='starting')return;
   if(!window.speechSynthesis.speaking){
    cancel();
    setPhase('blocked');
    setNotice('المتصفح منع بدء الصوت تلقائيًا. اضغط تشغيل من الشريط لبدء الشرح.');
   }
  },3200);
 },[cancel,setPhase]);
 useEffect(()=>{
  const synth=window.speechSynthesis;
  let live=true;
  const voiceChanged=()=>{
   if(!live||mutedRef.current||statusRef.current!=='voices-loading')return;
   if(synth.getVoices().some(v=>v.localService===false
     &&String(v.lang||'').toLowerCase().startsWith('ar')))startAt(0);
  };
  synth?.addEventListener?.('voiceschanged',voiceChanged);
  const timer=setTimeout(()=>{
   if(live){
    if(mutedRef.current){setPhase('muted');setNotice('الصوت مكتوم حسب اختيارك السابق.');}
    else startAt(0);
   }
  },0);
  return()=>{
   live=false;
   clearTimeout(timer);
   synth?.removeEventListener?.('voiceschanged',voiceChanged);
   cancel();
  };
 },[startAt,cancel,setPhase]);
 useEffect(()=>{
  // The main study player may finish loading the selected system speaker after
  // the page mounted; resume automatic startup when its voice becomes ready.
  if(voiceName&&['voices-loading','unavailable'].includes(statusRef.current)&&!mutedRef.current){
   startAt(0);
  }
 },[voiceName,startAt]);
 const changeVoice=next=>{
  voiceNameRef.current=next;
  onVoiceChange(next);
  if(!mutedRef.current&&['playing','paused','starting','voices-loading','blocked','unavailable'].includes(statusRef.current)){
   startAt(chunkIndex>=parts.length?0:chunkIndex);
  }
 };
 const togglePause=()=>{
  if(statusRef.current==='playing'){
   pauseSpeech();setPhase('paused');
  }else if(statusRef.current==='paused'){
   resumeSpeech();setPhase('playing');
  }else{
   if(mutedRef.current){
    mutedRef.current=false;setMuted(false);
    try{localStorage.removeItem(MUTE_STORAGE_KEY)}catch{}
   }
   startAt(chunkIndex>=parts.length?0:chunkIndex);
  }
 };
 const stop=()=>{
  cancel();setPhase('stopped');setNotice('توقف الشرح. يمكنك استئنافه من المقطع الحالي أو إعادته من البداية.');
 };
 const toggleMute=()=>{
  if(!mutedRef.current){
   mutedRef.current=true;setMuted(true);
   try{localStorage.setItem(MUTE_STORAGE_KEY,'true')}catch{}
   cancel();setPhase('muted');setNotice('تم كتم الشرح الصوتي، وسيبقى مكتومًا عند زيارتك التالية.');
  }else{
   mutedRef.current=false;setMuted(false);
   try{localStorage.removeItem(MUTE_STORAGE_KEY)}catch{}
   startAt(chunkIndex>=parts.length?0:chunkIndex);
  }
 };
 const sections=useMemo(()=>{
  const result=[];
  for(let i=0;i<parts.length;i++){
   if(result.at(-1)?.id!==parts[i].sectionId)result.push({
    id:parts[i].sectionId,title:parts[i].title,start:i
   });
  }
  return result;
 },[parts]);
 const current=parts[Math.min(chunkIndex,parts.length-1)]||null;
 const currentSection=Math.max(0,sections.findIndex(s=>s.id===current?.sectionId));
 const chooseSection=delta=>{
  const next=Math.max(0,Math.min(sections.length-1,currentSection+delta));
  if(mutedRef.current){setChunkIndex(sections[next].start);return}
  startAt(sections[next].start);
 };
 const completed=status==='complete';
 const percentage=parts.length?Math.round(100*(completed?1:chunkIndex/parts.length)):0;
 if(collapsed)return <aside className="about-narration is-collapsed"
  aria-label="الشرح الصوتي المصغر لصفحة عن المنصة" dir="rtl">
  <button type="button" className="about-narration-expand"
   aria-label="إظهار لوحة الشرح الصوتي" aria-expanded={false}
   title="إظهار لوحة الشرح الصوتي" onClick={()=>setCollapsedSaved(false)}>
   <Headphones size={18}/>
   <span>إظهار الشرح الصوتي</span>
   {status==='playing'&&<span className="about-narration-mini-live" aria-hidden="true"/>}
   <ChevronUp size={17}/>
  </button>
 </aside>;
 return <aside className="about-narration" aria-label="مشغّل الشرح الصوتي لصفحة عن المنصة" dir="rtl">
  <div className="about-narration-heading">
   <span className="about-narration-symbol"><Headphones size={20}/></span>
   <div className="about-narration-title">
    <strong>الشرح الصوتي لصفحة عن المنصة</strong>
    <span>{current?.title||'مقدمة عن المنصة'} · القسم {Math.min(currentSection+1,sections.length)} من {sections.length}</span>
   </div>
   <button type="button" className="about-narration-collapse"
    aria-label="إخفاء لوحة الشرح الصوتي" aria-expanded={true}
    title="إخفاء لوحة الشرح الصوتي" onClick={()=>setCollapsedSaved(true)}>
    <ChevronDown size={18}/><span>إخفاء</span>
   </button>
   <span className={'about-narration-status '+(status==='playing'?'is-playing':'')}>
    {status==='playing'?'يُشرح الآن':status==='paused'?'متوقف مؤقتًا':
     status==='muted'?'الصوت مكتوم':status==='complete'?'اكتمل الشرح':
     status==='starting'?'جارٍ التشغيل':status==='voices-loading'?'تجهيز الصوت':
     status==='blocked'?'اضغط للتشغيل':status==='unavailable'?'صوت غير متوفر':'متوقف'}
   </span>
  </div>
  <div className="about-narration-progress" role="progressbar" aria-label="تقدّم الشرح الصوتي"
   aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
   <span style={{width:percentage+'%'}}/>
  </div>
  <div className="about-narration-controls">
   <div className="about-narration-buttons">
    <button type="button" aria-label="القسم السابق" title="القسم السابق"
     disabled={!sections.length||currentSection===0}
     onClick={()=>chooseSection(-1)}><SkipBack size={18}/></button>
    <button type="button" className="about-narration-main" onClick={togglePause}
     aria-label={status==='playing'?'إيقاف الشرح مؤقتًا':status==='paused'?'استئناف الشرح':'تشغيل الشرح'}>
     {status==='playing'?<Pause size={18}/>:<Play size={18}/>}
     <span>{status==='playing'?'إيقاف مؤقت':status==='paused'?'استئناف':'تشغيل الشرح'}</span>
    </button>
    <button type="button" aria-label="القسم التالي" title="القسم التالي"
     disabled={!sections.length||currentSection>=sections.length-1}
     onClick={()=>chooseSection(1)}><SkipForward size={18}/></button>
    <button type="button" onClick={stop} title="إيقاف الصوت" aria-label="إيقاف الصوت">
     <Square size={16}/><span>إيقاف</span>
    </button>
    <button type="button" onClick={()=>{if(mutedRef.current){
      mutedRef.current=false;setMuted(false);try{localStorage.removeItem(MUTE_STORAGE_KEY)}catch{}
     }startAt(0)}} title="إعادة الشرح من البداية" aria-label="إعادة الشرح من البداية">
     <RotateCcw size={17}/><span>إعادة</span>
    </button>
    <button type="button" onClick={toggleMute} title={muted?'إلغاء كتم الصوت':'كتم الصوت'}
     aria-label={muted?'إلغاء كتم الصوت':'كتم الصوت'}
     aria-pressed={muted}>
     {muted?<VolumeX size={18}/>:<Volume2 size={18}/>}
     <span>{muted?'إلغاء الكتم':'كتم'}</span>
    </button>
   </div>
   <div className="about-narration-settings">
    <label className="about-narration-voice">الصوت العربي
     <select aria-label="اختيار الصوت العربي نفسه المستخدم في المواد"
      value={voiceName} onChange={e=>changeVoice(e.target.value)}>
      {!voiceChoices.some(choice=>choice.value===voiceName)&&
       <option value="">الصوت المختار غير متوفر</option>}
      {voiceChoices.map(voice=><option key={voice.value}
       value={voice.value}>{voice.label}</option>)}
     </select>
     <small dir="auto">{voiceChoices.find(choice=>choice.value===voiceName)?.compatibility||'لا يوجد صوت متاح في المتصفح الحالي'}</small>
    </label>
    <label className="about-narration-speed">السرعة
     <select aria-label="سرعة الشرح" value={rate} onChange={e=>{
       const value=Number(e.target.value);
       rateRef.current=value;setRate(value);onSpeedChange(value);
       if(['playing','paused','starting'].includes(statusRef.current))startAt(chunkIndex);
     }}>
      <option value={0.85}>هادئة</option>
      <option value={1}>طبيعية</option>
      <option value={1.15}>أسرع قليلًا</option>
      <option value={1.3}>سريعة</option>
      <option value={1.5}>سريعة جدًا</option>
     </select>
    </label>
   </div>
  </div>
  <p className="about-narration-notice" role="note"><AlertCircle size={14}/>
    أسماء الأصوات سعودية للعرض فقط، والصوت الحقيقي مجاني من المتصفح؛ قد تختلف نبرته أو لا يتوفر في متصفح جهاز آخر. لا يستخدم الموقع أصواتًا محلية أو خدمات صوت مدفوعة.
   </p>
   {notice&&<p className="about-narration-notice" role="status">
   <AlertCircle size={14}/>{notice}
  </p>}
 </aside>;
}
