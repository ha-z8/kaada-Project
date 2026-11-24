import { BookOpen,BookText,Headphones,Info,Languages,Pause,Volume2,Play,Square,SkipForward,SkipBack,ChevronDown,Check,Settings2,HeadphoneOff,RotateCcw,Mic2,Volume1 } from 'lucide-react';
import {useNotice} from '../lib/notifications.js';
import { speechParts } from '../lib/speech.js';
import {VOICE_NAMES,voiceCompatibility} from '../lib/systemVoices.js';
const LANGUAGES=[
 {id:'mixed',label:'إنجليزي ثم عربي',detail:'المقطع الإنجليزي، ثم ترجمته العربية، ثم المقطع التالي'},
 {id:'en',label:'الإنجليزية فقط',detail:'استمع إلى النص الإنجليزي وحده'},
 {id:'ar',label:'العربية فقط',detail:'استمع إلى النص العربي وحده'},
];
const SPEEDS=[.85,1,1.15,1.3,1.5];
function SettingsGroup({title,subtitle,icon:Icon,children,initiallyOpen=false,className=''}) {
 return <details className={'study-accordion '+className} defaultOpen={initiallyOpen}>
  <summary><span className="study-acc-icon"><Icon size={17}/></span><span className="study-acc-label"><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}</span><ChevronDown size={17} className="study-acc-chevron"/></summary>
  <div className="study-acc-content">{children}</div>
 </details>;
}
function VoiceSelection({language,groups,selected,onSelect,onPreview,previewing}){
 const arabic=language==='ar';
 const title=arabic?'الأصوات العربية':'الأصوات الإنجليزية';
 const online=navigator.onLine!==false;
 const genders=[{key:'female',title:'أصوات نسائية'},{key:'male',title:'أصوات رجالية'}];
 const slots=genders.flatMap(({key})=>Array.from({length:3},(_,index)=>({
  speaker:groups?.[key]?.[index]||null,label:VOICE_NAMES[language][key][index],gender:key,index
 }))).filter(v=>v.speaker?.id&&v.speaker.localService===false);
 const available=slots.filter(v=>v.speaker?.id&&v.speaker.localService===false);
 const chosen=available.find(v=>v.speaker.id===selected);
 useNotice(!online?'يتطلب تشغيل الصوت اتصالًا بالإنترنت.':available.length===0?'لا توجد أصوات متاحة لهذه اللغة.':available.length<6?'بعض الأصوات غير متاحة على جهازك':'','warning');
 return <div className={'voice-lang-block '+(arabic?'voice-lang-ar':'voice-lang-en')} dir="rtl">
  <div className="voice-lang-title">
   <strong>{title}</strong>
   <small>{available.length} أصوات متاحة</small>
  </div>
  {chosen&&<div className="voice-current-summary" aria-live="polite">
   <Check size={14}/><span>الصوت المختار: {chosen.label}</span>
  </div>}
  {genders.filter(group=>slots.some(v=>v.gender===group.key)).map(group=>
   <section className="voice-new-group" key={group.key}>
    <div className="voice-new-heading"><strong>{group.title}</strong>
     <small>{slots.filter(v=>v.gender===group.key&&v.speaker?.id).length} متاحة</small>
    </div>
    <div className="voice-new-grid">
     {slots.filter(v=>v.gender===group.key).map(({speaker,label,index})=>{
      const ready=Boolean(speaker?.id&&speaker.localService===false);
      const id=speaker?.id||'';
      const selectedNow=ready&&selected===id;
      const listeningNow=ready&&previewing===language+':'+id;
      return <div key={language+':'+group.key+':'+index}
       className={'voice-new-item'+(selectedNow?' voice-new-current':'')+(!ready?' voice-new-unavailable':'')}>
       <button type="button" className="voice-new-select"
        disabled={!ready||!online} aria-pressed={selectedNow}
        aria-label={ready?'اختيار الصوت '+label:label+' غير متوفر في هذا المتصفح'}
        onClick={()=>ready&&onSelect(id)}>
        <span className="voice-avatar" aria-hidden="true">{label[0]}</span>
        <span className="voice-name"><strong dir="auto">{label}</strong>
         <small>{ready?(online?'متاح':'يتطلب إنترنت'):'غير متوفر على هذا الجهاز'}</small>
         
        </span>
        {selectedNow&&<Check size={17} className="voice-new-check" aria-hidden="true"/>}
       </button>
       <button type="button" className={'voice-sample'+(listeningNow?' voice-sample-playing':'')}
        disabled={!ready||!online}
        title={ready?'تجربة الصوت '+label:'لا يوجد صوت مختلف لهذه الخانة'}
        aria-label={ready?(listeningNow?'إيقاف تجربة '+label:'تجربة صوت '+label):'الصوت '+label+' غير متوفر'}
        onClick={()=>ready&&onPreview(language,id)}>
        {listeningNow?<><Square size={14}/> إيقاف</>:ready?<><Play size={14}/> تجربة الصوت</>:'غير متوفر'}
       </button>
      </div>;
     })}
    </div>
   </section>
  )}

 </div>;
}
export default function StudyAudioPanel({
 current,sectionIndex,sectionCount,purpose,track,onPurposeChange,onTrackChange,explanationOnly=false,
 playing,paused,speakingLanguage,canPlayAudio,onlineVoiceMissing=false,onPlay,onStop,onSectionChange,
 continueListening,onContinueChange,speed,onSpeedChange,
 arVoices,enVoices,selectedArVoice,selectedEnVoice,onArabicVoiceChange,onEnglishVoiceChange,
 onPreviewVoice,previewingVoice='',volume=1,onVolumeChange=()=>{},
 recordingAvailable=false,recordingUrl='',recordingRef,onLoadRecording,localVoices=[],onRefreshVoices=()=>{},
}){
 useNotice(current&&!canPlayAudio?(onlineVoiceMissing?'الصوت غير متاح حاليًا. اختر صوتًا آخر أو تحقق من الاتصال.':'لا يوجد نص جاهز للاستماع باللغة المحددة.'):'','warning');
 const progress=sectionCount?Math.round((sectionIndex+1)*100/sectionCount):0;
 const state=playing?'يتم الآن تشغيل الصوت':paused?'متوقف مؤقتًا':'جاهز للاستماع';
 const activeLanguage=playing?(speakingLanguage==='ar'?'العربية':'الإنجليزية'):(track==='mixed'?'إنجليزي ← عربي':track==='en'?'الإنجليزية':'العربية');
 return <div className="audio-panel study-player modern-study-player">
   <header className="modern-player-header">
     <div className="modern-player-brand"><span className="modern-player-mark"><Headphones size={21}/></span>
       <div><span className="modern-eyebrow">KAADA AUDIO</span><h3>استمع وافهم</h3></div>
     </div>
     <span className={'modern-player-status '+(playing?'is-playing':'')}><span className="status-led"/>{state}</span>
   </header>

   <section className="modern-playback-card" aria-label="مشغّل الدرس">
     <div className="modern-now-playing">
       <div className="modern-now-icon"><Volume2 size={22}/></div>
       <div className="modern-now-details">
         <small>{purpose==='read'?'قراءة النص':'الشرح المبسّط'} · {activeLanguage}</small>
         <strong>المقطع {sectionCount?sectionIndex+1:0} من {sectionCount}</strong>
       </div>
       {playing&&<div className="modern-sound-bars" aria-hidden="true"><i/><i/><i/><i/></div>}
     </div>
     {track==='mixed'&&<div className="modern-language-sequence">
       <span className={speakingLanguage==='en'?'lang-active':''}>EN</span>
       <span className="sequence-line"/>
       <span className={speakingLanguage==='ar'?'lang-active':''}>AR</span>
       <small>ثم المقطع التالي</small>
     </div>}
     <div className="modern-position"><span>تقدّم الدرس</span><span>{progress}%</span></div>
     <div className="modern-position-track" role="progressbar" aria-valuemin={0} aria-valuemax={sectionCount} aria-valuenow={sectionCount?sectionIndex+1:0} aria-label="المقاطع المستكملة"><span style={{width:progress+'%'}}/></div>
     <div className="modern-controls">
       <button className="modern-control-side" type="button" onClick={()=>onSectionChange(sectionIndex-1)} disabled={sectionIndex===0} title="المقطع السابق" aria-label="المقطع السابق"><SkipBack size={21}/></button>
       <button className="modern-main-play" type="button" onClick={onPlay} disabled={!current||!canPlayAudio} aria-label={playing?'إيقاف مؤقت':paused?'متابعة':'ابدأ الاستماع'}>
         {playing?<Pause size={28} fill="currentColor"/>:<Play size={28} fill="currentColor"/>}
       </button>
       <button className="modern-control-side" type="button" onClick={()=>onSectionChange(sectionIndex+1)} disabled={sectionIndex>=sectionCount-1} title="المقطع التالي" aria-label="المقطع التالي"><SkipForward size={21}/></button>
       <button className="modern-control-stop" type="button" onClick={onStop} disabled={!playing&&!paused&&!previewingVoice} title="إيقاف كامل" aria-label="إيقاف الصوت"><Square size={17}/></button>
     </div>
     <div className="modern-control-caption">{playing?'اضغط للإيقاف المؤقت':paused?'اضغط للمتابعة من نفس الموضع':'اضغط للبدء من المقطع الحالي'}</div>

   </section>

   <div className="modern-player-options">
     {!explanationOnly&&<SettingsGroup title="نوع الاستماع" subtitle={purpose==='read'?'قراءة النص الأصلي':'الشرح المبسط'} icon={BookOpen}>
       <div className="modern-option-pills">
         <button type="button" className={purpose==='read'?'is-selected':''} onClick={()=>onPurposeChange('read')}><BookOpen size={16}/> القراءة</button>
         <button type="button" className={purpose==='explain'?'is-selected':''} onClick={()=>onPurposeChange('explain')}><BookText size={16}/> الشرح</button>
       </div>
       <p className="player-hint">{purpose==='read'?'يقرأ النص الأصلي وترجمته كما هما بعد الحفظ.':'يقرأ الشرح الذي تم إعداده لكل مقطع.'}</p>
     </SettingsGroup>}
     <SettingsGroup title={explanationOnly?"لغة الشرح":"لغة القراءة"} subtitle={LANGUAGES.find(v=>v.id===track)?.label} icon={Languages} initiallyOpen={false}>
       <div className="modern-track-list">
         {LANGUAGES.map(option=>{
           const enabled=speechParts(current,option.id,purpose).length>0;
           return <button type="button" key={option.id} className={'modern-track-row '+(track===option.id?'modern-track-selected':'')} onClick={()=>onTrackChange(option.id)}>
             <span className="modern-radio"/><span><strong>{option.label}</strong><small>{explanationOnly?'استمع إلى الشرح بهذا المسار':option.detail}</small></span>
             <span className={enabled?'modern-available':'modern-unavailable'}>{enabled?'جاهز':'ناقص نص'}</span>
           </button>;
         })}
       </div>
       {track==='mixed'&&<p className="modern-language-hint"><Languages size={15}/> {explanationOnly?'يقرأ الشرح الإنجليزي ثم العربي لنفس المقطع.':'يقرأ الإنجليزي ثم الترجمة العربية لنفس المقطع، بعدها ينتقل للمقطع التالي تلقائيًا.'}</p>}
     </SettingsGroup>
     <SettingsGroup title="الأصوات" subtitle="اختر صوت القراءة" icon={Mic2} initiallyOpen={false}>
       <p className="player-hint">تختلف الأصوات المتاحة باختلاف الجهاز والمتصفح.</p>
       <div className="modern-voice-stack">
        {(track==='mixed'||track==='en')&&<VoiceSelection language="en" groups={enVoices} selected={selectedEnVoice} onSelect={onEnglishVoiceChange} onPreview={onPreviewVoice} previewing={previewingVoice}/>}
        {(track==='mixed'||track==='ar')&&<VoiceSelection language="ar" groups={arVoices} selected={selectedArVoice} onSelect={onArabicVoiceChange} onPreview={onPreviewVoice} previewing={previewingVoice}/>}
       </div>
       <button type="button" className="outline-btn" onClick={onRefreshVoices}>
        <RotateCcw size={15}/> تحديث قائمة الأصوات المتصلة
       </button>
      </SettingsGroup>
      <SettingsGroup title="إعدادات التشغيل" subtitle={'السرعة '+speed+'× · '+(continueListening?'تلقائي':'مقطع واحد')} icon={Settings2}>
       <div className="modern-settings-line"><span>سرعة القراءة</span><div className="modern-speed-pills">
         {SPEEDS.map(value=><button key={value} type="button" className={speed===value?'selected':''} onClick={()=>onSpeedChange(value)}>{value}×</button>)}
       </div></div>
       <label className="modern-volume-control">مستوى الصوت <input type="range" min="0.2" max="1" step="0.1" value={volume} onChange={e=>onVolumeChange(Number(e.target.value))}/><span>{Math.round(volume*100)}%</span></label>
       <label className="modern-auto-next"><input type="checkbox" checked={continueListening} onChange={e=>onContinueChange(e.target.checked)}/><span>انتقال تلقائي للمقطع التالي بعد انتهاء قراءة المقطع الحالي بكلتا اللغتين</span></label>
     </SettingsGroup>
   </div>
   {recordingAvailable&&<details className="recording-more">
     <summary>تسجيل مرفوع من المشرف (اختياري)</summary>
     <p>تسجيل مستقل لهذا المقطع ولا يحل محل القراءة المزدوجة.</p>
     <button type="button" className="outline-btn" onClick={onLoadRecording}>فتح التسجيل</button>
     {recordingUrl&&<audio ref={recordingRef} controls preload="none" src={recordingUrl} aria-label="التسجيل الصوتي"/>}
   </details>}
 </div>;
}
