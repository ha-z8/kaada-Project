import { BookOpen,BookText,ChevronLeft,Headphones,Info,Languages,Pause,Volume2,CirclePlay,Square,SkipForward,SkipBack } from 'lucide-react';
import { speechParts } from '../lib/speech.js';

const LANGUAGES=[
 {id:'mixed',label:'إنجليزي ثم عربي',hint:'لكل فقرة: الأصل الإنجليزي، ثم ترجمته العربية'},
 {id:'en',label:'إنجليزي فقط',hint:'قراءة النص الإنجليزي'},
 {id:'ar',label:'عربي فقط',hint:'قراءة النص العربي'},
];
const SPEEDS=[1,1.25,1.5];
const LABELS={
 ar:{male:['راشد','فهد','ناصر'],female:['نورة','سَنا','مها']},
 en:{male:['Adam','Liam','Noah'],female:['Ava','Emma','Olivia']},
};
function VoiceChooser({language,groups,selected,onSelect,suggested=[]}){
 const arabic=language==='ar';
 const groupRows=['female','male'].filter(gender=>!arabic||groups[gender].length);
 const rows=<>
  {groupRows.map(gender=><div key={gender} className="voice-gender-row">
    <span className="voice-gender-heading">{gender==='male'?'أصوات رجالية':'أصوات نسائية'}</span>
    <div className="voice-choice-grid" role="group" aria-label={(arabic?'الأصوات العربية':'English voices')+' '+(gender==='male'?'الرجالية':'النسائية')}>
      {(arabic?groups[gender]:LABELS[language][gender]).map((item,i)=>{
        const voice=arabic?item:groups[gender][i];
        const label=arabic?item.label:item;
        return <button key={gender+i} className={'voice-choice '+(selected===voice?.id?'voice-choice-active':'')+(voice?'':' voice-choice-disabled')}
          type="button" disabled={!voice} onClick={()=>voice&&onSelect(voice.id)}
          title={voice?'اختيار '+label:'الصوت غير مثبت على جهازك'} aria-label={voice?label:label+' غير متوفر'}>
          {label}{!voice&&<small>غير متاح</small>}
        </button>;
      })}
    </div>
  </div>)}
 </>;
 return <div className="voice-language-group">
  <div className="voice-group-header">
    <strong>{arabic?'الأصوات العربية':'English voices'}</strong>
    <span>صوت مستقل لهذه اللغة</span>
  </div>
  {arabic&&suggested.length>0&&<>
    <span className="voice-gender-heading">الاختيارات البسيطة</span>
    <div className="voice-choice-grid" role="group" aria-label="أفضل الأصوات العربية المتوفرة">
      {suggested.map(voice=><button key={voice.id} className={'voice-choice '+(selected===voice.id?'voice-choice-active':'')}
        type="button" onClick={()=>onSelect(voice.id)}>
        <strong>{voice.label}</strong>
        {voice.gender&&<small>{voice.gender==='female'?'نسائي':'رجالي'}</small>}
      </button>)}
    </div>
  </>}
  {arabic? (
    groupRows.length>0&&<details className="optional-voice-genders">
      <summary>أصوات نسائية ورجالية إضافية</summary>
      <div className="voice-extra-groups">{rows}</div>
    </details>
  ):rows}
  {groups.other.length>0&&(!arabic||!suggested.some(x=>x.id===groups.other[0].id))&&
    <button type="button" className={'device-voice-option '+(selected===groups.other[0].id?'voice-choice-active':'')}
      onClick={()=>onSelect(groups.other[0].id)}><Volume2 size={15}/> صوت الجهاز (غير مصنّف)</button>}
  {groups.male.length+groups.female.length+groups.other.length===0&&suggested.length===0&&
    <p className="voice-service-note"><Info size={14}/> لم يُعثر على صوت لهذه اللغة. أضفه من إعدادات الجهاز ثم أعد فتح المتصفح.</p>}
 </div>;
}
export default function StudyAudioPanel({
 current,sectionIndex,sectionCount,purpose,track,onPurposeChange,onTrackChange,
 playing,paused,speakingLanguage,canPlayAudio,onPlay,onStop,onSectionChange,
 continueListening,onContinueChange,speed,onSpeedChange,
 arVoices,enVoices,arabicSuggested=[],selectedArVoice,selectedEnVoice,onArabicVoiceChange,onEnglishVoiceChange,
 recordingAvailable=false,recordingUrl='',recordingRef,onLoadRecording,
}){
 const percentage=sectionCount?Math.round(100*(sectionIndex+1)/sectionCount):0;
 return <div className="audio-panel study-player">
  <div className="player-title">
   <span className="audio-icon"><Headphones size={22}/></span>
   <div><h3>مشغل الدراسة</h3><p>استمع إلى المادة فقرة بعد فقرة، بطريقة سهلة وواضحة.</p></div>
  </div>

  <div className="player-step-title"><span>١</span><strong>نوع الاستماع</strong></div>
  <div className="listen-purpose" role="group" aria-label="القراءة أو الشرح">
   <button className={purpose==='read'?'listen-selected':''} onClick={()=>onPurposeChange('read')}><BookOpen size={16}/> قراءة النص</button>
   <button className={purpose==='explain'?'listen-selected':''} onClick={()=>onPurposeChange('explain')}><BookText size={16}/> الشرح المبسط</button>
  </div>
  <p className="player-hint">{purpose==='read'?'يقرأ النص الأصلي والترجمة كما كُتبا في المادة.':'يقرأ الشرح المكتوب بالعربية والإنجليزية، وليس النص الأصلي.'}</p>

  <div className="player-step-title"><span>٢</span><strong>لغة القراءة</strong></div>
  <div className="audio-tracks">{LANGUAGES.map(option=>{
   const available=!!speechParts(current,option.id,purpose).length;
   return <button key={option.id} className={'track '+(track===option.id?'track-selected':'')} onClick={()=>onTrackChange(option.id)}>
     <span className="track-radio"/><span><strong>{option.label}</strong><small>{option.hint}</small></span>
     <span className={'availability '+(available?'available':'unavailable')}>{available?'جاهز':'غير مكتمل'}</span>
    </button>;
  })}</div>
  {track==='mixed'&&<div className="paired-order"><Languages size={17}/>
    <div><strong>ترتيب الاستماع المزدوج</strong><p>الفقرة الأولى بالإنجليزي ← الفقرة الأولى بالعربي ← الفقرة الثانية بالإنجليزي ← الفقرة الثانية بالعربي…</p></div>
  </div>}

  <div className="player-step-title"><span>٣</span><strong>اختر الأصوات</strong></div>
  <p className="player-hint">الأصوات العربية المختصرة متاحة أولًا. ويمكنك عرض أصوات النساء والرجال الإضافية إذا كانت مثبتة في جهازك.</p>
  <div className="voice-options">
   {(track==='en'||track==='mixed')&&<VoiceChooser language="en" groups={enVoices}
    selected={selectedEnVoice} onSelect={onEnglishVoiceChange}/>}
   {(track==='ar'||track==='mixed')&&<VoiceChooser language="ar" groups={arVoices} suggested={arabicSuggested}
    selected={selectedArVoice} onSelect={onArabicVoiceChange}/>}
  </div>

  <div className="player-step-title"><span>٤</span><strong>ابدأ التشغيل</strong></div>
  <div className="playback">
   <div className="playback-header">
    <span><Volume2 size={16}/> الفقرة {sectionCount?sectionIndex+1:0} من {sectionCount}</span>
    <span>{paused?'إيقاف مؤقت':playing?(speakingLanguage==='en'?'الآن: الإنجليزية':speakingLanguage==='ar'?'الآن: العربية':'جارٍ القراءة'):'جاهز للتشغيل'}</span>
   </div>
   <div className="audio-progress"><span style={{width:percentage+'%'}}/></div>
   <div className="play-row">
    <button className="skip" onClick={()=>onSectionChange(sectionIndex-1)} disabled={sectionIndex===0} aria-label="الفقرة السابقة"><SkipForward size={19}/></button>
    <button className="play-main" onClick={onPlay} disabled={!current||!canPlayAudio} aria-label={playing?'إيقاف مؤقت':paused?'متابعة القراءة':'بدء الاستماع'}>
     {playing?<Pause size={23} fill="currentColor"/>:<CirclePlay size={27}/>}
    </button>
    <button className="skip" onClick={()=>onSectionChange(sectionIndex+1)} disabled={sectionIndex>=sectionCount-1} aria-label="الفقرة التالية"><SkipBack size={19}/></button>
    <button className="skip stop-play" onClick={onStop} aria-label="إيقاف القراءة"><Square size={17}/></button>
   </div>
   <label className="checkbox-line auto-next">
    <input type="checkbox" checked={continueListening} onChange={e=>onContinueChange(e.target.checked)}/>
    الانتقال تلقائيًا إلى الفقرة التالية بعد انتهاء الاستماع للغتين
   </label>
   <div className="speed-row"><span>سرعة القراءة</span><div className="speed-pills">{SPEEDS.map(n=>
    <button key={n} className={speed===n?'speed-selected':''} onClick={()=>onSpeedChange(n)}>{n}×</button>)}</div></div>
   {!canPlayAudio&&<p className="audio-unavailable compact"><Info size={16}/> تحتاج هذه الفقرة ترجمة أو شرحًا بهذه اللغة قبل بدء التشغيل.</p>}
  </div>
  <p className="audio-note"><Info size={15}/> يشغّل المتصفح أحدث نص محفوظ باستخدام أصوات جهازك، دون مزود أصوات خارجي. تغيير الصوت أو السرعة يوقف القراءة لتبدأ من الفقرة الحالية.</p>
  {recordingAvailable&&<details className="recording-more">
    <summary>تسجيل صوتي مرفوع من المشرف (اختياري)</summary>
    <p>تشغيل مستقل لهذه الفقرة فقط، ولا يدخل ضمن تسلسل الإنجليزية والعربية التلقائي.</p>
    <button type="button" className="outline-btn" onClick={onLoadRecording}>فتح التسجيل</button>
    {recordingUrl&&<audio ref={recordingRef} controls preload="none" src={recordingUrl} aria-label="التسجيل الصوتي المرفوع"/>}
  </details>}
 </div>;
}
