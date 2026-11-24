import { BookOpen,BookText,Headphones,Info,Languages,Pause,Volume2,Play,Square,SkipForward,SkipBack,ChevronDown,Check,Settings2,HeadphoneOff,RotateCcw,Mic2,Volume1 } from 'lucide-react';
import { speechParts } from '../lib/speech.js';
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
function VoiceSelection({language,groups,selected,onSelect,onPreview,previewing,availableVoices=[]}){
 const arabic=language==='ar';
 const title=arabic?'الأصوات العربية المتصلة':'الأصوات الإنجليزية المتصلة';
 const women=(groups.female||[]).filter(v=>v?.id&&v.localService===false);
 const men=(groups.male||[]).filter(v=>v?.id&&v.localService===false);
 const known=[...women,...men];
 const other=availableVoices.filter(v=>v.localService===false
  &&v.lang?.toLowerCase().startsWith(language)
  &&!known.some(slot=>slot.id===v.name));
 const all=[...known,...other];
 const current=all.find(v=>(v.id||v.name)===selected);
 const renderVoice=(voice)=>{
  const id=voice.id||voice.name;
  const selectedNow=selected===id;
  const listeningNow=previewing===language+':'+id;
  const name=voice.name||voice.id;
  const available=navigator.onLine!==false;
  return <div key={voice.voiceURI||name+'|'+voice.lang}
   className={'voice-new-item'+(selectedNow?' voice-new-current':'')}>
   <button type="button" className="voice-new-select"
    disabled={!available} aria-pressed={selectedNow}
    onClick={()=>onSelect(id)} aria-label={'اختيار الصوت '+name}>
    <span className="voice-avatar" aria-hidden="true">{name?.slice(0,1)||'♫'}</span>
    <span className="voice-name">
     <strong dir="auto">{name}</strong>
     <small>{voice.lang} · صوت متصل بالإنترنت</small>
    </span>
    {selectedNow&&<Check size={17} className="voice-new-check" aria-hidden="true"/>}
    {!selectedNow&&available&&<span className="voice-pick-hint">اختيار</span>}
   </button>
   {available&&<button className={'voice-sample'+(listeningNow?' voice-sample-playing':'')}
    type="button" title={'تجربة الصوت '+name}
    aria-label={listeningNow?'إيقاف تجربة '+name:'تجربة صوت '+name}
    onClick={()=>onPreview(language,id)}>
    {listeningNow?<><Square size={14}/> إيقاف</>:<><Play size={14}/> تجربة الصوت</>}
   </button>}
  </div>;
 };
 return <div className={'voice-lang-block '+(arabic?'voice-lang-ar':'voice-lang-en')} dir="rtl">
  <div className="voice-lang-title">
   <strong>{title}</strong>
   <small>{all.length} صوتًا متصلًا متاحًا على هذا المتصفح</small>
  </div>
  {current&&<div className="voice-current-summary" aria-live="polite">
   <Check size={14}/><span>الصوت المختار: {current.name||current.id} · {current.lang}</span>
  </div>}
  {[
   {key:'female',label:'أصوات نسائية',list:women},
   {key:'male',label:'أصوات رجالية',list:men},
   {key:'other',label:'أصوات متصلة إضافية',list:other}
  ].filter(group=>group.list.length>0).map(group=>
   <section className="voice-new-group" key={group.key}>
    <div className="voice-new-heading"><strong>{group.label}</strong>
     <small>{group.list.length} صوت فعلي</small></div>
    <div className="voice-new-grid">{group.list.map(renderVoice)}</div>
   </section>
  )}
  {!all.length&&<div className="voice-install-note" role="status">
   <Info size={16}/>
   <span>ما فيه أصوات سحابية متاحة لهذه اللغة في المتصفح الآن. لن نعرض أصوات الجهاز المحلية أو نستخدمها بدلًا منها. جرّب تحديث القائمة أو متصفحًا يدعم الأصوات المتصلة.</span>
  </div>}
  {navigator.onLine===false&&<div className="voice-install-note" role="status">
   <Info size={16}/> تشغيل هذه الأصوات يحتاج اتصالًا بالإنترنت.
  </div>}
 </div>;
}
export default function StudyAudioPanel({
 current,sectionIndex,sectionCount,purpose,track,onPurposeChange,onTrackChange,
 playing,paused,speakingLanguage,canPlayAudio,onPlay,onStop,onSectionChange,
 continueListening,onContinueChange,speed,onSpeedChange,
 arVoices,enVoices,selectedArVoice,selectedEnVoice,onArabicVoiceChange,onEnglishVoiceChange,
 onPreviewVoice,previewingVoice='',volume=1,onVolumeChange=()=>{},
 recordingAvailable=false,recordingUrl='',recordingRef,onLoadRecording,localVoices=[],onRefreshVoices=()=>{},
}){
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
     {!canPlayAudio&&<div className="voice-install-note"><Info size={16}/> ينقص هذا المقطع نص أو ترجمة باللغة المحددة. اختر لغة أخرى أو أكمل الترجمة.</div>}
   </section>

   <div className="modern-player-options">
     <SettingsGroup title="نوع الاستماع" subtitle={purpose==='read'?'قراءة النص الأصلي':'الشرح المبسط'} icon={BookOpen}>
       <div className="modern-option-pills">
         <button type="button" className={purpose==='read'?'is-selected':''} onClick={()=>onPurposeChange('read')}><BookOpen size={16}/> القراءة</button>
         <button type="button" className={purpose==='explain'?'is-selected':''} onClick={()=>onPurposeChange('explain')}><BookText size={16}/> الشرح</button>
       </div>
       <p className="player-hint">{purpose==='read'?'يقرأ النص الأصلي وترجمته كما هما بعد الحفظ.':'يقرأ الشرح الذي تم إعداده لكل مقطع.'}</p>
     </SettingsGroup>
     <SettingsGroup title="لغة القراءة" subtitle={LANGUAGES.find(v=>v.id===track)?.label} icon={Languages} initiallyOpen={false}>
       <div className="modern-track-list">
         {LANGUAGES.map(option=>{
           const enabled=speechParts(current,option.id,purpose).length>0;
           return <button type="button" key={option.id} className={'modern-track-row '+(track===option.id?'modern-track-selected':'')} onClick={()=>onTrackChange(option.id)}>
             <span className="modern-radio"/><span><strong>{option.label}</strong><small>{option.detail}</small></span>
             <span className={enabled?'modern-available':'modern-unavailable'}>{enabled?'جاهز':'ناقص نص'}</span>
           </button>;
         })}
       </div>
       {track==='mixed'&&<p className="modern-language-hint"><Languages size={15}/> يقرأ الإنجليزي ثم الترجمة العربية لنفس المقطع، بعدها ينتقل للمقطع التالي تلقائيًا.</p>}
     </SettingsGroup>
     <SettingsGroup title="الأصوات" subtitle="أصوات سحابية حقيقية فقط · دون أصوات محلية" icon={Mic2} initiallyOpen={false}>
       <p className="player-hint">نعرض الأصوات التي يصرّح المتصفح أنها سحابية فقط، باسمها الحقيقي كما يقدمه مزوّد الصوت. لا نعرض أصواتًا مثبتة محليًا ولا نكرر الاسم تحت صوت آخر.</p>
       <div className="modern-voice-stack">
         {(track==='mixed'||track==='en')&&<VoiceSelection language="en" groups={enVoices} selected={selectedEnVoice} availableVoices={localVoices} onSelect={onEnglishVoiceChange} onPreview={onPreviewVoice} previewing={previewingVoice}/>}
         {(track==='mixed'||track==='ar')&&<VoiceSelection language="ar" groups={arVoices} selected={selectedArVoice} availableVoices={localVoices} onSelect={onArabicVoiceChange} onPreview={onPreviewVoice} previewing={previewingVoice}/>}
       </div>
       <button type="button" className="outline-btn" onClick={onRefreshVoices}>
        <RotateCcw size={15}/> تحديث قائمة الأصوات المتصلة
       </button>
       <p className="voice-service-note"><Info size={14}/> تظهر الأصوات التي يوفرها متصفحك عبر الإنترنت فقط. أي صوت يفشل فعليًا سيُستبعد من القائمة لهذه الجلسة؛ يمكن إعادة فحصه بزر التحديث. أصوات النظام المحلية غير مستخدمة نهائيًا.</p>
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
