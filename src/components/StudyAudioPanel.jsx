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
 const title=language==='ar'?'الأصوات العربية':'English voices';
 return <div className="voice-lang-block">
  <div className="voice-lang-title"><strong>{title}</strong><small>{language==='ar'?'أسماء سعودية':'أسماء أمريكية'}</small></div>
  {['female','male'].map(group=><div className="voice-new-group" key={group}>
    <div className="voice-new-heading"><span>{group==='female'?'أصوات نسائية':'أصوات رجالية'}</span><small>٣ أصوات</small></div>
    <div className="voice-new-grid">
      {VOICE_NAMES[language][group].map((label,index)=>{
        const voice=groups[group][index];
        return <div className={'voice-new-item '+(voice?'':'voice-new-unavailable')+(selected===voice?.id?' voice-new-current':'')} key={group+label}>
          <button type="button" className="voice-new-select" disabled={!voice} onClick={()=>voice&&onSelect(voice.id)} aria-label={voice?'اختر '+label:label+' غير متاح'}>
            <span className="voice-avatar">{label.slice(0,1)}</span>
            <span className="voice-name"><strong>{label}</strong><small>{voice?'متاح للاستماع':'غير مثبت'}</small></span>
            {selected===voice?.id&&<Check size={15} className="voice-new-check"/>}
          </button>
          {voice&&<button className="voice-sample" type="button" title={'استمع إلى عينة من '+label} aria-label={'تجربة صوت '+label} onClick={()=>onPreview(language,voice.id)}>
            {previewing===language+':'+voice.id?<Square size={13}/>:<Play size={14}/>}
          </button>}
        </div>;
      })}
    </div>
  </div>)}
  {groups.other.length>0&&<div className="voice-uncategorized">
    <small>أصوات أخرى غير مصنّفة</small>
    <div>{groups.other.map((voice,i)=><button type="button" key={voice.id} onClick={()=>onSelect(voice.id)}
       className={selected===voice.id?'voice-uncat-active':''}>{'الصوت '+(i+1)}</button>)}</div>
   </div>}
  {!groups.female.length&&!groups.male.length&&!groups.other.length&&
    <div className="voice-install-note"><Info size={16}/> لا توجد أصوات لهذه اللغة على جهازك. ثبّت حزمة الأصوات من إعدادات النظام ثم أعد فتح المتصفح.</div>}
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
       <p className="player-hint">اختر من الأسماء السعودية والأمريكية، ثم اضغط زر <Play size={12} className="inline-icon"/> لسماع العينة. تُعرض الخيارات غير المثبتة بلون باهت.</p>
       <div className="modern-voice-stack">
         {(track==='mixed'||track==='en')&&<VoiceSelection language="en" groups={enVoices} selected={selectedEnVoice} onSelect={onEnglishVoiceChange} onPreview={onPreviewVoice} previewing={previewingVoice}/>}
         {(track==='mixed'||track==='ar')&&<VoiceSelection language="ar" groups={arVoices} selected={selectedArVoice} onSelect={onArabicVoiceChange} onPreview={onPreviewVoice} previewing={previewingVoice}/>}
       </div>
       <p className="voice-service-note"><Info size={14}/> جودة الصوت تعتمد على الأصوات المثبتة في المتصفح والجهاز؛ يُفضّل استخدام الأصوات العصبية الحديثة إن توفرت.</p>
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
