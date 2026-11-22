import { BookOpen,BookText,Headphones,Info,Languages,Pause,Volume2,Play,Square,SkipForward,SkipBack,ChevronDown,Check,Settings2,HeadphoneOff,RotateCcw,Mic2,Volume1 } from 'lucide-react';
import { speechParts } from '../lib/speech.js';
import {VOICE_NAMES} from '../lib/systemVoices.js';
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
 const total=groups.female.length+groups.male.length;
 const current=[...groups.female,...groups.male].find(v=>v.id===selected);
 return <div className={'voice-lang-block '+(arabic?'voice-lang-ar':'voice-lang-en')} dir="rtl">
  <div className="voice-lang-title">
    <strong>{title}</strong>
    <small>{total?total+' من ٦ أصوات متاحة':'لا توجد أصوات مصنّفة متاحة'}</small>
  </div>
  <div className="voice-current-summary" aria-live="polite">
    <Check size={14}/>
    <span>{current?'الصوت المختار: '+current.label:'اختر صوتًا من الخيارات المتاحة بالأسفل'}</span>
  </div>
  {['female','male'].map(group=><section className="voice-new-group" key={group} aria-label={arabic?(group==='female'?'أصوات النساء العربية':'أصوات الرجال العربية'):(group==='female'?'English female voices':'English male voices')}>
    <div className="voice-new-heading">
      <strong>{group==='female'?'أصوات نسائية':'أصوات رجالية'}</strong>
      <small>{groups[group].length} من ٣ متاحة</small>
    </div>
    <div className="voice-new-grid">
      {VOICE_NAMES[language][group].map((label,index)=>{
        const voice=groups[group][index];
        const available=Boolean(voice?.id);
        const active=available&&selected===voice.id;
        const previewActive=available&&previewing===language+':'+voice.id;
        return <div key={group+'-'+index} className={'voice-new-item'+(available?'':' voice-new-unavailable')+(active?' voice-new-current':'')}>
          <button type="button" className="voice-new-select" disabled={!available}
            aria-pressed={active}
            onClick={()=>available&&onSelect(voice.id)}
            aria-label={available?'اختيار صوت '+label:label+' غير متوفر'}>
            <span className="voice-avatar" aria-hidden="true">{label.slice(0,1)}</span>
            <span className="voice-name">
              <strong>{label}</strong>
              <small>{!available?'غير متوفر':active?'تم الاختيار':voice.enhanced?'صوت محسّن':'جاهز للاستماع'}</small>
            </span>
            {active&&<Check size={17} className="voice-new-check" aria-hidden="true"/>}
            {available&&!active&&<span className="voice-pick-hint">اختيار</span>}
          </button>
          {available&&<button className={'voice-sample'+(previewActive?' voice-sample-playing':'')}
            type="button" title={'استمع إلى صوت '+label}
            aria-label={previewActive?'إيقاف تجربة '+label:'تجربة صوت '+label}
            onClick={()=>onPreview(language,voice.id)}>
            {previewActive?<><Square size={14}/> إيقاف التجربة</>:<><Play size={14}/> تجربة الصوت</>}
          </button>}
        </div>;
      })}
    </div>
  </section>)}
  {!total&&<div className="voice-install-note"><Info size={16}/>
    <span>لم يُعثر على أصوات رجالية أو نسائية معروفة لهذه اللغة. خيارات الصوت غير المتوفرة معطلة حتى تتوفر أصوات مناسبة في المتصفح.</span>
  </div>}
 </div>;
}
export default function StudyAudioPanel({
 current,sectionIndex,sectionCount,purpose,track,onPurposeChange,onTrackChange,
 playing,paused,speakingLanguage,canPlayAudio,onPlay,onStop,onSectionChange,
 continueListening,onContinueChange,speed,onSpeedChange,
 arVoices,enVoices,selectedArVoice,selectedEnVoice,onArabicVoiceChange,onEnglishVoiceChange,
 onPreviewVoice,previewingVoice='',volume=1,onVolumeChange=()=>{},
 recordingAvailable=false,recordingUrl='',recordingRef,onLoadRecording,
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
     <SettingsGroup title="الأصوات" subtitle="٣ رجال و٣ نساء لكل لغة حسب المتوفر" icon={Mic2} initiallyOpen={false}>
       <p className="player-hint">اختر الصوت من البطاقة مباشرة، أو اضغط «تجربة الصوت» للاستماع إليه قبل الاختيار. تظهر الخيارات غير المتوفرة معطّلة حتى تتوفر الأصوات المناسبة.</p>
       <div className="modern-voice-stack">
         {(track==='mixed'||track==='en')&&<VoiceSelection language="en" groups={enVoices} selected={selectedEnVoice} onSelect={onEnglishVoiceChange} onPreview={onPreviewVoice} previewing={previewingVoice}/>}
         {(track==='mixed'||track==='ar')&&<VoiceSelection language="ar" groups={arVoices} selected={selectedArVoice} onSelect={onArabicVoiceChange} onPreview={onPreviewVoice} previewing={previewingVoice}/>}
       </div>
       <p className="voice-service-note"><Info size={14}/> يتم ترتيب الأصوات الواضحة أولًا عند توفرها. عدد الأصوات الفعلي يختلف حسب المتصفح ونظام التشغيل.</p>
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
