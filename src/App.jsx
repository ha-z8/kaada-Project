import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, BookText, Check, CheckCircle2, ChevronLeft, ChevronRight,
  CirclePlay, Cloud, FileAudio, FileText, FolderOpen, Headphones, Info, Languages,
  LayoutDashboard, LoaderCircle, LogOut, Menu, Moon, Pause, Pencil, Plus, Search,
  Settings2, ShieldCheck, SkipBack, SkipForward, Sparkles, Square, Sun, Upload,
  Volume2, X, AlertTriangle, LockKeyhole, Trash2, UserRound, SlidersHorizontal
} from 'lucide-react';
import { configured, supabase } from './lib/supabase.js';
import { extractText, splitIntoSections, detectChapters } from './lib/import.js';
import { speechParts, speakParts, stopSpeech, sourceLanguage } from './lib/speech.js';
import * as api from './lib/api.js';
import { NATURAL_VOICES } from './lib/naturalVoice.js';

const emptyData = () => ({ subjects: [], lessons: [], sections: [], progress: [] });
const sample = {
  subjects: [{ id: 'demo-subject', title: 'مادة تجريبية', description: 'مقدمة توضيحية عن طريقة الدراسة' }],
  lessons: [{ id: 'demo-lesson', subject_id: 'demo-subject', title: 'Introduction to Biology', position: 0 }],
  sections: [
    { id:'demo-1',lesson_id:'demo-lesson',position:0,
      content_en:'Biology is the scientific study of living organisms. It explores how organisms grow, reproduce, interact with their environment, and maintain life.',
      content_ar:'علم الأحياء هو الدراسة العلمية للكائنات الحية. ويبحث في كيفية نمو الكائنات وتكاثرها وتفاعلها مع بيئتها والمحافظة على الحياة.',
      explanation_mixed:'Biology هو علم الأحياء، أي دراسة living organisms أو الكائنات الحية. ويركّز على النمو والتكاثر والتفاعل مع البيئة.',
      explanation_ar:'يركّز هذا التعريف على أن علم الأحياء يستخدم منهجًا علميًا لدراسة الكائنات الحية ووظائفها.',
      explanation_en:'Biology investigates living things by examining growth, reproduction and interactions with the environment.',
    },
    { id:'demo-2',lesson_id:'demo-lesson',position:1,
      content_en:'A cell is the basic structural and functional unit of life. Some organisms consist of one cell, while others contain many cells working together.',
      content_ar:'الخلية هي الوحدة الأساسية للتركيب والوظيفة في الكائنات الحية. تتكون بعض الكائنات من خلية واحدة، بينما تتكون كائنات أخرى من خلايا عديدة تعمل معًا.',
      explanation_mixed:'A cell تعني الخلية، وهي أصغر وحدة أساسية للتركيب والوظيفة في الكائن الحي.',
      explanation_ar:'الخلية أساس بناء الكائنات الحية، وقد يعمل كائن بخلية واحدة أو بعدد كبير من الخلايا المتعاونة.',
      explanation_en:'The cell is the smallest fundamental structural and functional component of living organisms.',
    },
  ],
  progress: [],
};
const tracks = [
  { id: 'mixed', label:'عربي + English', hint:'قراءة الأصل ثم شرح عربي' },
  { id: 'en', label:'English only', hint:'استماع إلى اللغة الإنجليزية' },
  { id: 'ar', label:'العربية فقط', hint:'شرح عربي ومراجعة مركزة' },
];
const speeds = [1, 1.25, 1.5];
const shortError = e => e?.message || 'حدث خطأ غير متوقع.';
const parentTitle = (d,id) => d.subjects.find(x=>x.id===id)?.title || 'المكتبة';
const makeId = () => crypto.randomUUID();

function AuthScreen({ onDemo }) {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [signup,setSignup] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      if (signup) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('تم إرسال طلب التسجيل. افتح بريدك لتأكيد الحساب إذا كان تأكيد البريد مفعّلًا.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch(e) { setMessage(shortError(e)); }
    finally { setBusy(false); }
  };
  return <div className="auth-wrap">
    <div className="auth-decoration"><div className="brand-hero"><span className="brand-mark"><BookOpen size={27}/></span><span>KAADA <strong>Study</strong></span></div>
      <div className="auth-quote"><div className="quote-kicker">تعلم بذكاء. افهم بوضوح.</div><h1>مناهجك العلمية،<br/><em>بلغة تفهمها.</em></h1><p>اقرأ بالإنجليزية، افهم بالعربية، واستمع بالطريقة التي تناسبك. جميع موادك في مكان واحد.</p></div>
      <div className="auth-feature"><Languages size={18}/> قراءة أكاديمية ثنائية اللغة <span>•</span> <Headphones size={18}/> 3 مسارات صوتية</div>
    </div>
    <div className="auth-area"><div className="auth-card">
      <div className="auth-icon"><LockKeyhole size={24}/></div>
      <div className="eyebrow">مرحبًا بك</div><h2>{signup?'إنشاء حساب جديد':'تسجيل الدخول'}</h2><p className="subtle">تظهر المواد الدراسية للمستخدمين المسجّلين، وإدارتها محصورة بالمشرف.</p>
      <form onSubmit={submit} className="form-stack">
        <label>البريد الإلكتروني<input type="email" required autoComplete="email" placeholder="name@example.com" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>كلمة المرور<input type="password" required minLength={6} autoComplete={signup?'new-password':'current-password'} placeholder="••••••••" dir="ltr" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        {message&&<p className="inline-alert" role="status">{message}</p>}
        <button className="primary-btn wide" disabled={busy}>{busy&&<LoaderCircle size={17} className="spin"/>}{signup?'إنشاء حساب':'دخول إلى المنصة'}<ArrowLeft size={17}/></button>
      </form>
      <button className="plain-link" onClick={()=>{setSignup(!signup);setMessage('')}}>{signup?'لديك حساب؟ تسجيل الدخول':'ليس لديك حساب؟ أنشئ حسابًا'}</button>
      <div className="or-divider"><span>أو</span></div>
      <button className="outline-btn wide" onClick={onDemo}><BookOpen size={18}/> تجربة الواجهة دون حساب</button>
      <p className="auth-footnote"><ShieldCheck size={14}/> النسخة التجريبية محلية ومؤقتة ولا تحفظ ملفاتك سحابيًا.</p>
    </div></div>
  </div>;
}

function Modal({ title, subtitle, children, onClose, wide=false }) {
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className={'modal '+(wide?'modal-wide':'')} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header"><div><h2>{title}</h2>{subtitle&&<p className="subtle">{subtitle}</p>}</div><button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={20}/></button></header>
      {children}
    </div>
  </div>;
}

export default function App() {
  const [session,setSession] = useState(null);
  const [role,setRole] = useState('user');
  const [demo,setDemo] = useState(!configured);
  const [booting,setBooting] = useState(configured);
  const [library,setLibrary] = useState(configured ? emptyData() : structuredClone(sample));
  const [subjectId,setSubjectId] = useState(configured ? null : 'demo-subject');
  const [lessonId,setLessonId] = useState(configured ? null : 'demo-lesson');
  const [screen,setScreen] = useState('home');
  const [drawer,setDrawer] = useState(false);
  const [search,setSearch] = useState('');
  const [theme,setTheme] = useState(() => localStorage.getItem('kaada-study-theme') || 'light');
  const [mode,setMode] = useState('both');
  const [track,setTrack] = useState('mixed');
  const [purpose,setPurpose] = useState('read');
  const [explainMode,setExplainMode] = useState('ar');
  const [speed,setSpeed] = useState(1);
  const [audioEngine,setAudioEngine] = useState('device');
  const [naturalVoice,setNaturalVoice] = useState('coral');
  const [audioConsent,setAudioConsent] = useState(false);
  const [audioLoading,setAudioLoading] = useState(false);
  const [sectionIndex,setSectionIndex] = useState(0);
  const [dialog,setDialog] = useState('');
  const [subjectTitle,setSubjectTitle] = useState('');
  const [subjectDescription,setSubjectDescription] = useState('');
  const [editingSubjectId,setEditingSubjectId] = useState(null);
  const [editingLessonTitle,setEditingLessonTitle] = useState('');
  const [importWarnings,setImportWarnings] = useState([]);
  const [draft,setDraft] = useState(null);
  const [editDraft,setEditDraft] = useState({});
  const [generatedDraft,setGeneratedDraft] = useState(false);
  const [consent,setConsent] = useState(false);
  const [studyLevel,setStudyLevel] = useState('intermediate');
  const [saving,setSaving] = useState(false);
  const [processing,setProcessing] = useState(false);
  const [playing,setPlaying] = useState(false);
  const [paused,setPaused] = useState(false);
  const [audioPosition,setAudioPosition] = useState(0);
  const [audioLength,setAudioLength] = useState(0);
  const [error,setError] = useState('');
  const [notification,setNotification] = useState('');
  const audioRef = useRef(null);
  const cancelSpeech = useRef(null);
  const naturalRunRef=useRef(0);
  const audioObjectRef=useRef(null);

  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    localStorage.setItem('kaada-study-theme',theme);
  },[theme]);

  useEffect(()=>{
    if(!configured) return;
    let mounted=true;
    supabase.auth.getUser().then(({data})=>{
      if(mounted){setSession(data?.user||null);setBooting(false);}
    }).catch(()=>{if(mounted)setBooting(false)});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,current)=>{
      if(!mounted)return;
      if(current?.user){setSession(current.user);setDemo(false)}
      else setSession(null);
    });
    return ()=>{mounted=false;subscription.unsubscribe()};
  },[]);

  const isAdmin = role==='admin' && !demo;
  useEffect(()=>{
    if(!session?.id||demo){setRole('user');return;}
    let active=true;
    api.loadMyRole(session.id).then(next=>{if(active)setRole(next)}).catch(e=>{if(active)setError(shortError(e))});
    return()=>{active=false};
  },[session?.id,demo]);

  const refresh = async()=>{
    if(!session || demo)return;
    const next = await api.loadLibrary();
    setLibrary(next);
    setSubjectId(current=>next.subjects.some(s=>s.id===current)?current:next.subjects[0]?.id||null);
    setLessonId(current=>next.lessons.some(l=>l.id===current)?current:next.lessons[0]?.id||null);
    return next;
  };
  useEffect(()=>{if(session&&!demo)refresh().catch(e=>setError(shortError(e)))},[session?.id,demo]);

  useEffect(()=>{ if(notification){const timer=setTimeout(()=>setNotification(''),4700);return()=>clearTimeout(timer)} },[notification]);
  useEffect(()=>{ if(error){const timer=setTimeout(()=>setError(''),7500);return()=>clearTimeout(timer)} },[error]);

  const subjects = library.subjects.filter(s=>!search||s.title.toLowerCase().includes(search.toLowerCase()));
  const lessons = library.lessons.filter(l=>l.subject_id===subjectId&&(!search||l.title.toLowerCase().includes(search.toLowerCase())));
  const activeLesson = library.lessons.find(x=>x.id===lessonId);
  const activeSections = useMemo(()=>library.sections.filter(s=>s.lesson_id===lessonId).sort((a,b)=>a.position-b.position),[library.sections,lessonId]);
  const importPreview=useMemo(()=>{
    if(!draft?.text?.trim())return [];
    return draft.autoChapters?detectChapters(draft.text,draft.title):[{title:draft.title||'درس',sections:splitIntoSections(draft.text)}];
  },[draft?.text,draft?.title,draft?.autoChapters]);
  const current = activeSections[sectionIndex];
  const originalLanguage = sourceLanguage(current?.content_en || '');
  const trackPath = {mixed:'audio_mixed_path',en:'audio_en_path',ar:'audio_ar_path'}[track];
  const recordedTrack = purpose==='explain' && !demo && Boolean(current?.[trackPath]);
  const speechContent = speechParts(current, track, purpose);
  const canPlayAudio = Boolean(recordedTrack || speechContent.length);
  const explanationText = explainMode==='ar' ? current?.explanation_ar
    : explainMode==='en' ? current?.explanation_en : current?.explanation_mixed;
  const percentage = activeSections.length ? Math.round(((sectionIndex+1)/activeSections.length)*100) : 0;
  const reviewed = library.progress.length;
  const notify = s=>setNotification(s);
  const stop = () => {
    naturalRunRef.current+=1;
    if(audioObjectRef.current){URL.revokeObjectURL(audioObjectRef.current);audioObjectRef.current=null;}
    cancelSpeech.current?.(); cancelSpeech.current=null;stopSpeech();
    if(audioRef.current){audioRef.current.pause();audioRef.current.src='';audioRef.current=null;}
    setPlaying(false);setPaused(false);setAudioLoading(false);setAudioPosition(0);setAudioLength(0);
  };
  useEffect(()=>()=>{stopSpeech();if(audioRef.current)audioRef.current.pause()},[]);

  const saveLocation = async (lesson,section,lang=track,r=speed)=>{
    if(!demo&&session&&lesson&&section){
      try{await api.saveProgress(lesson,section,lang,r)}catch(e){setError(shortError(e))}
    }
  };
  const openLesson = (id) => {
    stop();
    const item=library.lessons.find(l=>l.id===id);
    const p=library.progress.find(p=>p.lesson_id===id);
    const list=library.sections.filter(s=>s.lesson_id===id).sort((a,b)=>a.position-b.position);
    setLessonId(id);setSubjectId(item?.subject_id||subjectId);
    const resumeIndex=Math.max(0,list.findIndex(s=>s.id===p?.section_id));
    setSectionIndex(resumeIndex);
    setTrack(p?.audio_track || (sourceLanguage(list[resumeIndex]?.content_en) === 'ar' ? 'ar' : 'en'));
    setPurpose('read');
    setSpeed(Number(p?.speed||1));
    setScreen('reader');setDrawer(false);
  };
  const changeSection = i => {
    if(i<0||i>=activeSections.length)return;
    stop();setSectionIndex(i);saveLocation(lessonId,activeSections[i]?.id);
  };
  const play = async(targetTrack=track,targetPurpose=purpose)=>{
    if(!current)return;
    const changed=targetTrack!==track||targetPurpose!==purpose;
    const audioKey={mixed:'audio_mixed_path',en:'audio_en_path',ar:'audio_ar_path'}[targetTrack];
    const recorded=targetPurpose==='explain'&&!demo&&Boolean(current[audioKey]);
    const parts=speechParts(current,targetTrack,targetPurpose);
    if(!recorded && !parts.length){
      setError(targetPurpose==='explain'?'لم يجهز المشرف شرحًا صوتيًا لهذه اللغة بعد.':'هذه اللغة لا تحتوي على ترجمة أو نص قابل للقراءة.');
      return;
    }
    if(audioEngine==='natural' && !audioConsent) {
      setError('فعّل الموافقة على إرسال نص الفقرة إلى مزود الصوت الذكي قبل التشغيل.');
      return;
    }
    if(playing && !changed) {
      if(audioRef.current){audioRef.current.pause();setPaused(true);setPlaying(false)}
      else if('speechSynthesis' in window){window.speechSynthesis.pause();setPaused(true);setPlaying(false)}
      return;
    }
    if(paused && !changed){
      if(audioRef.current)audioRef.current.play().catch(e=>setError(shortError(e)));
      else if('speechSynthesis' in window)window.speechSynthesis.resume();
      setPlaying(true);setPaused(false);return;
    }
    stop();
    if(changed){setTrack(targetTrack);setPurpose(targetPurpose)}
    const runId=naturalRunRef.current;
    try {
      if(audioEngine==='natural' && !demo){
        setAudioLoading(true);
        const playChunk=async partIndex=>{
          const {audio,partCount}=await api.generateNaturalAudio(current.id,targetTrack,targetPurpose,naturalVoice,partIndex);
          if(runId!==naturalRunRef.current)return;
          if(audioObjectRef.current){URL.revokeObjectURL(audioObjectRef.current);audioObjectRef.current=null}
          const url=URL.createObjectURL(audio);
          audioObjectRef.current=url;
          const player=new Audio(url);audioRef.current=player;player.playbackRate=speed;
          player.ontimeupdate=()=>setAudioPosition(player.currentTime);
          player.onloadedmetadata=()=>setAudioLength(player.duration||0);
          player.onended=()=>{
            if(runId!==naturalRunRef.current)return;
            if(partIndex+1<partCount){
              setAudioLoading(true);
              playChunk(partIndex+1).catch(e=>{setError(shortError(e));setPlaying(false);setAudioLoading(false)});
            }else{setPlaying(false);setPaused(false);setAudioLoading(false)}
          };
          player.onerror=()=>{setError('تعذّر تشغيل الصوت الذكي.');setPlaying(false);setAudioLoading(false)};
          await player.play();
          if(runId===naturalRunRef.current){setPlaying(true);setAudioLoading(false)}
        };
        await playChunk(0);
      } else if(recorded){
        const url=await api.signedAudioUrl(current[audioKey]);
        if(runId!==naturalRunRef.current)return;
        const player=new Audio(url);audioRef.current=player;player.playbackRate=speed;
        player.ontimeupdate=()=>setAudioPosition(player.currentTime);
        player.onloadedmetadata=()=>setAudioLength(player.duration||0);
        player.onended=()=>{setPlaying(false);setPaused(false)};
        player.onerror=()=>{setError('تعذّر تشغيل التسجيل الصوتي.');setPlaying(false)};
        await player.play();setPlaying(true);
      }else{
        cancelSpeech.current=speakParts(parts,speed,
          ()=>{setPlaying(true);setPaused(false)},
          ()=>{setPlaying(false);setPaused(false)},
          msg=>{setError(msg);setPlaying(false);setPaused(false)}
        );
      }
      await saveLocation(lessonId,current.id,targetTrack,speed);
    }catch(e){setPlaying(false);setAudioLoading(false);setError(shortError(e))}
  };
  const setAudioTrack = value=>{stop();setTrack(value);if(current)saveLocation(lessonId,current.id,value,speed)};
  const setListenPurpose = value=>{stop();setPurpose(value)};
  const setAudioSpeed = value=>{const n=Number(value);setSpeed(n);if(audioRef.current)audioRef.current.playbackRate=n;if(current)saveLocation(lessonId,current.id,track,n)};

  const createSubject = async e=>{
    e.preventDefault();
    if(!isAdmin)return setError('إدارة المواد متاحة للمشرف فقط.');
    if(!subjectTitle.trim())return;
    setSaving(true);
    try {
      const subject=demo
        ? {id:makeId(),title:subjectTitle.trim(),description:subjectDescription.trim()}
        : await api.addSubject(subjectTitle.trim(),subjectDescription.trim());
      if(demo)setLibrary(prev=>({...prev,subjects:[...prev.subjects,subject]}));
      else await refresh();
      setSubjectId(subject.id);setSubjectTitle('');setSubjectDescription('');setDialog('');setScreen('home');
      notify('تمت إضافة المادة بنجاح.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const startSubjectEdit=(item)=>{
    if(!isAdmin)return;
    setEditingSubjectId(item.id);setSubjectTitle(item.title);setSubjectDescription(item.description||'');setDialog('subject-edit');
  };
  const updateSubject = async e=>{
    e.preventDefault();if(!isAdmin||!editingSubjectId)return;
    setSaving(true);
    try{await api.updateSubject(editingSubjectId,{title:subjectTitle,description:subjectDescription});
      await refresh();setDialog('');notify('تم تعديل المادة.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const deleteSubject = async()=>{
    if(!isAdmin||!subjectId)return;
    const count=library.lessons.filter(l=>l.subject_id===subjectId).length;
    if(!window.confirm('هل تريد حذف هذه المادة و'+count+' من دروسها وفقراتها نهائيًا؟ لا يمكن التراجع.'))return;
    setSaving(true);
    try{await api.deleteSubject(subjectId);setSubjectId(null);setLessonId(null);
      await refresh();notify('حُذفت المادة ودروسها من المكتبة.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const renameLesson=async e=>{
    e.preventDefault();if(!isAdmin||!activeLesson)return;
    setSaving(true);try{await api.updateLesson(activeLesson.id,editingLessonTitle);
      await refresh();setDialog('');notify('تم تعديل اسم الدرس.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const deleteLesson=async()=>{
    if(!isAdmin||!activeLesson)return;
    if(!window.confirm('حذف الدرس وكل فقراته نهائيًا؟'))return;
    setSaving(true);try{await api.deleteLesson(activeLesson.id);setLessonId(null);
      await refresh();setScreen('home');notify('حُذف الدرس.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const selectFile = async e=>{
    if(!isAdmin)return setError('استيراد الملفات من صلاحيات المشرف فقط.');
    const file=e.target.files?.[0];e.target.value='';
    if(!file)return;
    setSaving(true);
    try{
      const extracted=await extractText(file);
      if(!extracted)throw Error('تعذّر استخراج نص من الملف. قد يكون صورة ممسوحة تحتاج OCR.');
      setDraft({file,title:file.name.replace(/\.[^.]+$/,''),text:extracted,autoChapters:true,subject_id:subjectId||library.subjects[0]?.id});
      setImportWarnings(extracted.length<80?['النص المستخرج قصير. قد يحتوي الملف على صور أو صفحات ممسوحة لا تقرؤها هذه الأداة.']:[]);
      setDialog('import');
    }catch(err){setError(shortError(err))}finally{setSaving(false)}
  };
  const saveImport = async()=>{
    if(!isAdmin)return setError('الاستيراد متاح للمشرف فقط.');
    if(!draft?.title.trim()||!draft.subject_id)return setError('أضف مادة أولًا وحدد عنوانًا للدرس.');
    const chapters=importPreview;
    const count=chapters.reduce((sum,chapter)=>sum+chapter.sections.length,0);
    if(count>500)return setError('المادة تحتوي '+count+' فقرة. قسّمها إلى ملفات أصغر قبل الاستيراد، حتى لا يُفقد أي نص.');
    if(draft.text.length>800000)return setError('الملف كبير جدًا من حيث النص. يُفضّل استيراد فصل واحد في كل مرة.');
    if(!chapters.length || !chapters.some(chapter=>chapter.sections.length))return setError('لا توجد فقرات قابلة للحفظ.');
    setSaving(true);
    try{
      let createdLessons;
      if(demo){
        const newLessons=[]; const newSections=[];
        for(const [position,chapter] of chapters.entries()){
          const lesson={id:makeId(),subject_id:draft.subject_id,title:chapter.title,position:library.lessons.length+position};
          newLessons.push(lesson);
          newSections.push(...chapter.sections.map((content_en,i)=>({id:makeId(),lesson_id:lesson.id,position:i,content_en,content_ar:sourceLanguage(content_en)==='ar'?content_en:''})));
        }
        setLibrary(prev=>({...prev,lessons:[...prev.lessons,...newLessons],sections:[...prev.sections,...newSections]}));
        createdLessons=newLessons;
      } else {
        createdLessons=await api.addLessonBundle(draft.subject_id,chapters,draft.file,session.id);
        await refresh();
      }
      setSubjectId(draft.subject_id);setDraft(null);setDialog('');setLessonId(createdLessons[0].id);setSectionIndex(0);
      setPurpose('read');setTrack(sourceLanguage(chapters[0]?.sections[0])==='ar'?'ar':'en');setScreen('reader');
      notify(`تم استيراد ${createdLessons.length} درسًا مع ${chapters.reduce((sum,ch)=>sum+ch.sections.length,0)} فقرة، بعد المعاينة.`);
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const editSection = ()=>{
    if(!isAdmin)return setError('تعديل الشرح والمادة من صلاحيات المشرف فقط.');
    if(!current)return;
    const keys=['content_en','content_ar','explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en'];
    setEditDraft(Object.fromEntries(keys.map(k=>[k,current[k]||''])));
    setConsent(false);setGeneratedDraft(false);setDialog('edit');
  };
  const saveEdit = async()=>{
    if(!isAdmin)return setError('لا تملك صلاحية تعديل المادة.');
    if(!current)return;
    setSaving(true);
    try{
      if(demo) setLibrary(prev=>({...prev,sections:prev.sections.map(s=>s.id===current.id?{...s,...editDraft}:s)}));
      else{await api.saveSection(current.id,editDraft);await refresh()}
      setGeneratedDraft(false);setDialog('');notify('تم حفظ الترجمة والشرح بنجاح، ويمكن الآن الاستماع إلى النص المعدّل.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const processTranslation = async()=>{
    if(!isAdmin)return setError('المشرف فقط يستطيع توليد شرح للمادة المشتركة.');
    if(demo || !configured || !session) {
      setError('التوليد التلقائي يحتاج ربط Supabase وتسجيل الدخول، ثم تفعيل خدمة Netlify AI Gateway. يمكنك كتابة شرحك وتعديله يدويًا الآن.');
      return;
    }
    if(!consent)return setError('يلزم تأكيد السماح بإرسال هذه الفقرة إلى مزود الذكاء الاصطناعي.');
    if(!current)return;
    setProcessing(true);
    try{
      const result=await api.generateTranslation(current.id,studyLevel);
      const keys=['content_en','content_ar','explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en'];
      const present=Object.fromEntries(keys.map(k=>[k,current[k]||'']));
      setEditDraft({...present,...result});
      setGeneratedDraft(true);
      setDialog('edit');
      notify('تم إنشاء مسودة بالعربي والإنجليزي. راجعها وعدّلها قبل الضغط على «حفظ الشرح».');
    }catch(e){setError(shortError(e))}
    finally{setProcessing(false)}
  };
  const handleAudioFile = async(e,targetTrack)=>{
    const file=e.target.files?.[0];e.target.value='';
    if(!isAdmin||!file||!current||demo)return;
    if(!file.type.startsWith('audio/'))return setError('الملف يجب أن يكون صوتيًا.');
    setSaving(true);
    try{await api.uploadAudio(current,targetTrack,file,session.id);await refresh();notify('تم حفظ الملف الصوتي الخاص بهذا المسار.')}
    catch(err){setError(shortError(err))}finally{setSaving(false)}
  };
  const logout=async()=>{
    stop();if(configured&&!demo)await supabase.auth.signOut();
    setSession(null);setRole('user');setDemo(false);setLibrary(emptyData());setScreen('home');
  };
  const renderSource=type=>mode==='both'||mode===type;

  if(booting)return <div className="loading-page"><LoaderCircle className="spin" size={36}/><p>جاري تهيئة المنصة...</p></div>;
  if(!session&&!demo)return <AuthScreen onDemo={()=>{setDemo(true);setLibrary(structuredClone(sample));setSubjectId('demo-subject');setLessonId('demo-lesson');setScreen('home')}}/>;

  return <div className="app-shell">
    <aside className={'sidebar '+(drawer?'sidebar-open':'')}>
      <div className="sidebar-head">
        <div className="brand"><span className="brand-mark"><BookOpen size={21}/></span><span>KAADA <strong>Study</strong><small>منصتك التعليمية</small></span></div>
        <button className="icon-btn mobile-only" onClick={()=>setDrawer(false)} aria-label="إغلاق القائمة"><X size={20}/></button>
      </div>
      <div className="side-scroll">
        <div className="side-caption">المكتبة التعليمية المشتركة</div>
        <button className={'side-nav '+(screen==='home'?'selected':'')} onClick={()=>{setScreen('home');setDrawer(false)}}><LayoutDashboard size={19}/> لوحة المذاكرة</button>
        <button className={'side-nav '+(screen==='reader'?'selected':'')} disabled={!activeLesson} onClick={()=>{setScreen('reader');setDrawer(false)}}><BookOpen size={19}/> قارئ الدروس</button>
        <div className="side-title"><span>المواد الدراسية</span>{isAdmin&&<button className="icon-btn small-icon" onClick={()=>setDialog('subject')} aria-label="إضافة مادة"><Plus size={19}/></button>}</div>
        {library.subjects.map(s=><button key={s.id} className={'subject-link '+(subjectId===s.id?'active':'')} onClick={()=>{setSubjectId(s.id);setScreen('home');setDrawer(false)}}>
          <span className="folder-dot"><FolderOpen size={17}/></span><span className="ellipsis">{s.title}</span><span className="item-count">{library.lessons.filter(l=>l.subject_id===s.id).length}</span>
        </button>)}
        {!library.subjects.length&&<p className="sidebar-empty">لم يضف المشرف أي مادة بعد.</p>}
        <div className="side-caption second-caption">المساعدة</div>
        <button className="side-nav" onClick={()=>{setDialog('help');setDrawer(false)}}><Info size={19}/> دليل الاستخدام</button>
      </div>
      <div className="sidebar-footer">
        <div className="account-card"><div className="avatar">{demo?'ت':(session?.email?.[0]||'م').toUpperCase()}</div><div className="account-text"><strong>{demo?'وضع التجربة':isAdmin?'مشرف المواد':'مستخدم المنصة'}</strong><span>{demo?'تجربة محلية مؤقتة':session?.email}</span></div></div>
        <button className="side-nav footer-action" onClick={logout}><LogOut size={18}/>{demo?'إنهاء التجربة':'تسجيل الخروج'}</button>
      </div>
    </aside>

    {drawer&&<button className="mobile-shade" onClick={()=>setDrawer(false)} aria-label="إغلاق القائمة"/>}
    <div className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-btn mobile-only" onClick={()=>setDrawer(true)} aria-label="فتح القائمة"><Menu size={22}/></button><span className="topbar-crumb">المكتبة الدراسية</span><ChevronLeft size={15} className="crumb-arrow"/><strong>{screen==='reader'?activeLesson?.title || 'قارئ الدروس':parentTitle(library,subjectId)}</strong></div>
        <div className="topbar-tools">
          {demo&&<span className="demo-pill"><span className="status-dot"/> وضع تجريبي</span>}
          {!demo&&<span className={'role-pill '+(isAdmin?'role-admin':'role-user')}><ShieldCheck size={14}/>{isAdmin?'مشرف':'مستخدم'}</span>}
          <button className="icon-btn" onClick={()=>setTheme(t=>t==='light'?'dark':'light')} aria-label="تغيير المظهر" title="تغيير المظهر">{theme==='light'?<Moon size={19}/>:<Sun size={19}/>}</button>
          {isAdmin&&<button className="top-add" onClick={()=>setDialog('subject')}><Plus size={17}/><span>مادة جديدة</span></button>}
        </div>
      </header>
      <main className="page-content">
        {screen==='home'&&<>
          <div className="home-hero">
            <div className="hero-copy"><span className="hero-kicker"><Sparkles size={16}/> مساحتك للتعلم</span><h1>كل مادة، <span>فهم أعمق.</span></h1><p>دروس مشتركة لجميع الطلاب، شرح واضح بالعربية والإنجليزية، واستماع طبيعي مع متابعة التقدم لكل مستخدم.</p>
            <div className="hero-actions">{isAdmin&&<button className="primary-btn" onClick={()=>setDialog(library.subjects.length?'import':'subject')}><Upload size={18}/> استيراد ملف دراسي</button>}{activeLesson&&<button className="light-btn" onClick={()=>openLesson(activeLesson.id)}>متابعة القراءة <ArrowLeft size={17}/></button>}</div>
            </div>
            <div className="hero-illustration" aria-hidden="true"><div className="hero-paper hero-paper-back"/><div className="hero-paper hero-paper-front"><div className="paper-dot"/><div className="paper-title-line"/><div className="paper-line"/><div className="paper-line short"/><div className="paper-separator"/><div className="paper-title-line cream"/><div className="paper-line"/><div className="paper-line tiny"/></div><div className="floating-headphones"><Headphones size={33}/></div></div>
          </div>
          <div className="metrics"><div className="metric"><div className="metric-icon green"><FolderOpen size={21}/></div><div><span>المواد الدراسية</span><strong>{library.subjects.length}</strong></div></div>
            <div className="metric"><div className="metric-icon blue"><BookText size={21}/></div><div><span>الدروس المضافة</span><strong>{library.lessons.length}</strong></div></div>
            <div className="metric"><div className="metric-icon gold"><FileText size={21}/></div><div><span>الفقرات المتاحة</span><strong>{library.sections.length}</strong></div></div>
            <div className="metric"><div className="metric-icon violet"><CheckCircle2 size={21}/></div><div><span>دروس تابعتها</span><strong>{reviewed}</strong></div></div>
          </div>
          <div className="section-bar"><div><span className="eyebrow">مكتبتي</span><h2>المواد والدروس</h2><p className="subtle">{isAdmin?'استعرض المواد وأدر المحتوى المخصص للطلاب.':'استعرض المواد المعتمدة من المشرف وواصل مذاكرتك.'}</p></div><div className="search-wrap"><Search size={17}/><input aria-label="بحث في المواد والدروس" placeholder="ابحث في مكتبتك..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
          <div className="library-grid">
            {subjects.map(s=><button className={'subject-card '+(subjectId===s.id?'subject-chosen':'')} key={s.id} onClick={()=>setSubjectId(s.id)}>
              <div className="subject-card-top"><span className="subject-card-icon"><BookOpen size={22}/></span><span className="card-count">{library.lessons.filter(l=>l.subject_id===s.id).length} دروس</span></div>
              <strong>{s.title}</strong><p>{s.description||'ملفات وملاحظات المادة الدراسية'}</p><span className="subject-open">استعراض الدروس <ChevronLeft size={16}/></span>
            </button>)}
            {isAdmin&&<button className="create-card" onClick={()=>setDialog('subject')}><span><Plus size={25}/></span><strong>إضافة مادة جديدة</strong><small>أنشئ مادة تظهر للمستخدمين</small></button>}
          </div>
          {subjectId&&<section className="lessons-panel">
            <div className="section-bar compact"><div><h2>دروس {parentTitle(library,subjectId)}</h2><p className="subtle">اختر درسًا للقراءة والاستماع.</p></div>
              {isAdmin&&<div className="admin-actions"><button className="outline-btn" onClick={()=>setDialog('import')}><Upload size={16}/> استيراد درس</button><button className="outline-btn" onClick={()=>startSubjectEdit(library.subjects.find(s=>s.id===subjectId))}><Pencil size={15}/> تعديل المادة</button><button className="outline-btn danger-btn" disabled={saving} onClick={deleteSubject}><Trash2 size={15}/> حذف المادة</button></div>}</div>
            {lessons.length? <div className="lesson-list">{lessons.map((lesson,i)=>{
              const total=library.sections.filter(s=>s.lesson_id===lesson.id).length;
              const p=library.progress.find(p=>p.lesson_id===lesson.id);
              return <button className="lesson-item" key={lesson.id} onClick={()=>openLesson(lesson.id)}>
                <span className="lesson-number">{String(i+1).padStart(2,'0')}</span><div className="lesson-details"><strong dir="auto">{lesson.title}</strong><span>{total} فقرة {p?'• آخر موضع محفوظ':''}</span></div><span className="lesson-read">ابدأ الدراسة <ChevronLeft size={18}/></span>
              </button>})}</div>:<div className="no-lessons"><FileText size={34}/><strong>لا توجد دروس في هذه المادة بعد</strong><p>{isAdmin?'ارفع ملف PDF أو Word أو TXT لتظهر الدروس للطلاب.':'لم ينشر المشرف دروسًا في هذه المادة بعد.'}</p>{isAdmin&&<button className="primary-btn" onClick={()=>setDialog('import')}><Upload size={16}/> استيراد أول درس</button>}</div>}
          </section>}
        </>}

        {screen==='reader'&&activeLesson&&<>
          <div className="reader-breadcrumb"><button onClick={()=>setScreen('home')}>المواد الدراسية</button><ChevronLeft size={15}/><span>{parentTitle(library,activeLesson.subject_id)}</span><ChevronLeft size={15}/><strong dir="auto">{activeLesson.title}</strong></div>
          <div className="reader-top">
            <div><div className="eyebrow">وضع المذاكرة <span className="small-circle"/> {parentTitle(library,activeLesson.subject_id)}</div><h1 dir="auto">{activeLesson.title}</h1><p>تقدّم بالدرس فقرةً فقرة، وبدّل اللغة أو المسار الصوتي في أي وقت.</p></div>
            {isAdmin&&<div className="reader-actions">
              <button className="outline-btn" onClick={()=>{setConsent(false);setDialog('generate')}}><Sparkles size={16}/> توليد شرح تلقائي</button>
              <button className="outline-btn" onClick={editSection} disabled={!current}><Pencil size={16}/> تعديل الفقرة</button>
              <button className="outline-btn" onClick={()=>{setEditingLessonTitle(activeLesson.title);setDialog('lesson-edit')}}><Pencil size={15}/> اسم الدرس</button>
              <button className="outline-btn danger-btn" onClick={deleteLesson}><Trash2 size={15}/> حذف الدرس</button>
            </div>}
          </div>
          <div className="reader-grid">
            <div className="reading-column">
              <div className="reading-controls"><div className="control-heading"><Languages size={19}/><strong>طريقة عرض النص</strong></div><div className="segmented" role="group" aria-label="طريقة عرض النص">
                {[['both','مزدوج'],['en','English'],['ar','العربية']].map(([val,name])=><button key={val} className={mode===val?'is-active':''} onClick={()=>setMode(val)}>{name}</button>)}
              </div></div>
              {current?<div className="reading-paper">
                <div className="paragraph-heading">
                  <div><span className="paragraph-label">{'الفقرة '+(sectionIndex+1)+' من '+activeSections.length}</span><h2>تعلّم الفقرة خطوة بخطوة</h2></div>
                  <div className="paragraph-marker"><BookOpen size={21}/></div>
                </div>
                <section className="study-step">
                  <header className="study-step-header">
                    <span className="study-step-number">١</span>
                    <div><h3>النص العلمي والترجمة</h3><p>هذا نص الملف الأصلي، وتظهر الترجمة منفصلة عنه لتسهيل المقارنة.</p></div>
                  </header>
                  <div className="bilingual stacked-reading">
                    {renderSource('en') && (originalLanguage==='en'
                      ? <article className="text-panel english" dir="ltr"><div className="panel-head"><span className="lang-chip">EN</span><strong>Original English text · النص الأصلي</strong></div><p>{current.content_en}</p></article>
                      : mode==='en' && <div className="empty-translation">المصدر المرفوع عربي. لا تتوفر له نسخة إنجليزية في هذه الفقرة.</div>
                    )}
                    {renderSource('ar') && <article className="text-panel arabic" dir="rtl">
                      <div className="panel-head"><span className="lang-chip">AR</span><strong>{originalLanguage==='ar'?'النص العربي الأصلي':'الترجمة العربية'}</strong></div>
                      {originalLanguage==='ar'||current.content_ar?.trim()
                        ? <p>{originalLanguage==='ar'?current.content_en:current.content_ar}</p>
                        : <div className="empty-copy"><p>لم تُضف الترجمة العربية لهذه الفقرة بعد.</p>{isAdmin&&<button className="outline-btn" onClick={()=>{setConsent(false);setDialog('generate')}}><Sparkles size={16}/> إعداد الترجمة والشرح</button>}</div>}
                    </article>}
                  </div>
                </section>
                <section className="study-step explanation-step">
                  <header className="study-step-header">
                    <span className="study-step-number second-step">٢</span>
                    <div><h3>الشرح المبسّط</h3><p>توضيح الفكرة الأساسية بلغة مفهومة، وليس تكرارًا حرفيًا للنص.</p></div>
                  </header>
                  <div className="explain-languages" role="group" aria-label="لغة الشرح">
                    {[['ar','شرح بالعربية'],['mixed','عربي + مصطلحات إنجليزية'],['en','English']].map(([val,name])=>
                      <button key={val} className={explainMode===val?'explain-active':''} onClick={()=>setExplainMode(val)}>{name}</button>
                    )}
                  </div>
                  {explanationText?.trim()
                    ? <div className="explain-body" dir={explainMode==='en'?'ltr':'rtl'}>
                        <p>{explanationText}</p>
                        <div className="explain-actions" dir="rtl">
                          <button className="primary-btn" onClick={()=>play(explainMode,'explain')}><Headphones size={16}/> استمع للشرح {explainMode==='en'?'بالإنجليزية':explainMode==='ar'?'بالعربية':'باللغتين'}</button>
                          {isAdmin&&<button className="outline-btn" onClick={editSection}><Pencil size={15}/> تعديل الشرح</button>}
                        </div>
                      </div>
                    : <div className="missing-explanation">
                        <div><Info size={18}/><strong>لا يوجد شرح بهذا المسار حتى الآن</strong></div>
                        <p>استيراد الملف يضيف النص الأصلي فقط. تستطيع إنشاء مسودة شرح وترجمة بإذن منك، أو كتابتهما بنفسك.</p>
                        <div className="missing-actions">
                          {isAdmin?<><button className="primary-btn" onClick={()=>{setConsent(false);setDialog('generate')}}><Sparkles size={16}/> إعداد شرح وترجمة</button><button className="outline-btn" onClick={editSection}><Pencil size={16}/> إضافة شرح يدويًا</button></>:<span className="subtle">سيكون الشرح متاحًا بعد إضافته من المشرف.</span>}
                        </div>
                      </div>}
                </section>
                <div className="reading-footer"><span>راجع المصطلحات العلمية والأرقام في المصادر الأصلية.</span>{isAdmin&&<button onClick={editSection}><Pencil size={14}/> تعديل النص والشرح</button>}</div>
              </div>:<div className="no-lessons"><p>لا توجد فقرات في هذا الدرس.</p></div>}
              <div className="navigation-card"><button className="outline-btn" disabled={sectionIndex===0} onClick={()=>changeSection(sectionIndex-1)}><ChevronRight size={17}/> السابقة</button>
                <div className="navigation-progress"><div><span>تقدّمك في الدرس</span><strong>{percentage}%</strong></div><div className="progress-bar"><span style={{width:percentage+'%'}}/></div></div>
                <button className="primary-btn" disabled={sectionIndex>=activeSections.length-1} onClick={()=>changeSection(sectionIndex+1)}>التالية <ChevronLeft size={17}/></button>
              </div>
            </div>
            <aside className="study-panel">
              <div className="audio-panel">
                <div className="audio-icon"><Headphones size={23}/></div>
                <h3>الاستماع إلى الفقرة</h3>
                <p className="subtle">اختر أولًا هل تريد سماع النص كما هو، أم شرح معناه.</p>
                <div className="audio-label">نوع المحتوى الصوتي</div>
                <div className="listen-purpose" role="group" aria-label="نوع المحتوى الصوتي">
                  <button className={purpose==='read'?'listen-selected':''} onClick={()=>setListenPurpose('read')}><BookOpen size={16}/> قراءة النص</button>
                  <button className={purpose==='explain'?'listen-selected':''} onClick={()=>setListenPurpose('explain')}><Sparkles size={16}/> شرح مبسّط</button>
                </div>
                <div className="audio-label">لغة الاستماع</div>
                <div className="audio-tracks">{tracks.map(option=>{
                  const field={mixed:'audio_mixed_path',en:'audio_en_path',ar:'audio_ar_path'}[option.id];
                  const available=speechParts(current,option.id,purpose).length>0 || (purpose==='explain'&&!demo&&Boolean(current?.[field]));
                  return <button key={option.id} className={'track '+(track===option.id?'track-selected':'')} onClick={()=>setAudioTrack(option.id)}>
                    <span className="track-radio"/>
                    <span><strong>{option.label}</strong><small>{purpose==='read'?'قراءة المحتوى دون شرح':option.hint}</small></span>
                    <span className={'availability '+(available?'available':'unavailable')}>{available?'جاهز':'غير جاهز'}</span>
                  </button>;
                })}</div>
                {!canPlayAudio && <div className="audio-unavailable">
                  <Info size={17}/>
                  <div><strong>{purpose==='explain'?'الشرح الصوتي غير جاهز':'لا يوجد نص قابل للقراءة بهذا المسار'}</strong>
                    <p>{purpose==='explain'?'أنشئ نص شرح لهذه الفقرة أولًا ليتمكن المتصفح من قراءته صوتيًا.':'هذه اللغة غير متوفرة للنص المستورد. أضف الترجمة ثم أعد المحاولة.'}</p>
                    {isAdmin&&<button onClick={()=>{setConsent(false);setDialog('generate')}}>إعداد الترجمة والشرح</button>}
                  </div>
                </div>}
                <div className="audio-label">جودة الصوت</div>
                <div className="listen-purpose voice-engine" role="group" aria-label="محرك الصوت">
                  <button className={audioEngine==='device'?'listen-selected':''} onClick={()=>{stop();setAudioEngine('device')}}><Volume2 size={16}/> صوت الجهاز (مجاني)</button>
                  <button className={audioEngine==='natural'?'listen-selected':''} onClick={()=>{stop();setAudioEngine('natural')}}><Sparkles size={16}/> صوت واقعي ذكي</button>
                </div>
                {audioEngine==='natural'&&<div className="natural-settings">
                  <label>اختر صوت الشرح
                    <select value={naturalVoice} onChange={e=>{stop();setNaturalVoice(e.target.value)}}>
                      {NATURAL_VOICES.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                  </label>
                  <label className="checkbox-line"><input type="checkbox" checked={audioConsent} onChange={e=>setAudioConsent(e.target.checked)}/> أوافق على إرسال نص هذه الفقرة إلى مزود الصوت الذكي عند التشغيل. قد يستهلك هذا رصيد الاستضافة.</label>
                  <p className="audio-note"><Info size={14}/> الصوت مُولّد بالذكاء الاصطناعي، وليس صوت شخص حقيقي. يتطلب تفعيل مزود الصوت في Netlify.</p>
                </div>}
                <div className="playback">
                  <div className="playback-header">
                    <span><Volume2 size={16}/>{audioEngine==='natural'?'صوت اصطناعي طبيعي':recordedTrack?'تسجيل صوتي محفوظ':purpose==='read'?'قراءة بواسطة صوت الجهاز':'شرح بواسطة صوت الجهاز'}</span>
                    <span>{audioLength?Math.round(audioPosition)+' / '+Math.round(audioLength)+' ث':'تشغيل عند الطلب'}</span>
                  </div>
                  <div className="audio-progress"><span style={{width:audioLength?(100*audioPosition/audioLength)+'%':(playing?'20%':'0%')}}/></div>
                  <div className="play-row">
                    <button className="skip" onClick={()=>changeSection(sectionIndex-1)} disabled={sectionIndex===0} aria-label="الفقرة السابقة"><SkipForward size={19}/></button>
                    <button className="play-main" onClick={()=>play()} disabled={!current||!canPlayAudio||audioLoading} aria-label={playing?'إيقاف مؤقت':'تشغيل الصوت'}>{audioLoading?<LoaderCircle size={25} className="spin"/>:playing?<Pause size={23} fill="currentColor"/>:<CirclePlay size={27}/>}</button>
                    <button className="skip" onClick={()=>changeSection(sectionIndex+1)} disabled={sectionIndex===activeSections.length-1} aria-label="الفقرة التالية"><SkipBack size={19}/></button>
                    <button className="skip stop-play" onClick={stop} aria-label="إيقاف"><Square size={17}/></button>
                  </div>
                  <div className="speed-row"><span>سرعة التشغيل</span><div className="speed-pills">{speeds.map(n=><button className={speed===n?'speed-selected':''} key={n} onClick={()=>setAudioSpeed(n)}>{n}×</button>)}</div></div>
                </div>
                <p className="audio-note"><Info size={15}/> القراءة الصوتية الفورية تعتمد على الأصوات المثبتة في متصفحك أو نظامك. لالشرح يُكتب أو يُراجع بواسطة المشرف. اختر صوت الجهاز أو الصوت الذكي حسب إعدادات الخدمة.</p>
              </div>
              <div className="chapters-panel"><div className="chapters-heading"><strong>فقرات الدرس</strong><span>{activeSections.length}</span></div>
                <div className="paragraph-list">{activeSections.map((section,i)=><button key={section.id} className={'paragraph-link '+(i===sectionIndex?'paragraph-active':'')} onClick={()=>changeSection(i)}>
                  <span className="paragraph-no">{String(i+1).padStart(2,'0')}</span><span className="paragraph-preview">{section.content_en.slice(0,85)}{section.content_en.length>85?'…':''}</span>{i===sectionIndex&&<span className="active-mini-dot"/>}
                </button>)}</div>
              </div>
            </aside>
          </div>
        </>}
      </main>
      <footer className="main-footer"><span>KAADA Study — منصة تفاعلية للدراسة الثنائية</span><span>صُممت للتركيز على الفهم لا الحفظ فقط</span></footer>
    </div>
    {notification&&<div className="toast"><CheckCircle2 size={18}/>{notification}<button onClick={()=>setNotification('')}><X size={14}/></button></div>}
    {error&&<div className="toast toast-error" role="alert"><AlertTriangle size={18}/>{error}<button onClick={()=>setError('')}><X size={14}/></button></div>}

    {isAdmin&&dialog==='subject-edit'&&<Modal title="تعديل المادة" subtitle="يظهر التعديل لكل مستخدمي المنصة." onClose={()=>setDialog('')}>
      <form className="modal-body form-stack" onSubmit={updateSubject}>
        <label>اسم المادة<input required value={subjectTitle} onChange={e=>setSubjectTitle(e.target.value)}/></label>
        <label>الوصف<textarea rows={3} value={subjectDescription} onChange={e=>setSubjectDescription(e.target.value)}/></label>
        <div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" disabled={saving}><Check size={16}/> حفظ</button></div>
      </form>
    </Modal>}
    {isAdmin&&dialog==='lesson-edit'&&<Modal title="تعديل اسم الدرس" onClose={()=>setDialog('')}>
      <form className="modal-body form-stack" onSubmit={renameLesson}>
        <label>اسم الدرس<input required value={editingLessonTitle} onChange={e=>setEditingLessonTitle(e.target.value)}/></label>
        <div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" disabled={saving}><Check size={16}/> حفظ</button></div>
      </form>
    </Modal>}

    {isAdmin&&dialog==='subject'&&<Modal title="إضافة مادة دراسية" subtitle="اجمع دروس المادة وملفاتها داخل قسم واحد." onClose={()=>setDialog('')}>
      <form className="modal-body form-stack" onSubmit={createSubject}><label>اسم المادة<input value={subjectTitle} onChange={e=>setSubjectTitle(e.target.value)} required maxLength={120} placeholder="مثال: بحوث عمليات"/></label>
        <label>الوصف (اختياري)<textarea rows={3} value={subjectDescription} onChange={e=>setSubjectDescription(e.target.value)} placeholder="وصف مختصر للمادة أو الفصل الدراسي"/></label>
        <div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" disabled={saving}>{saving&&<LoaderCircle size={16} className="spin"/>}<Plus size={16}/> إضافة المادة</button></div>
      </form>
    </Modal>}

    {isAdmin&&dialog==='import'&&<Modal wide title="استيراد درس جديد" subtitle="تستخرج المنصة النص أولًا، ثم تتيح لك مراجعته وتصحيحه قبل الحفظ." onClose={()=>setDialog('')}>
      <div className="modal-body form-stack">
        <label>المادة الدراسية<select value={draft?.subject_id||subjectId||''} onChange={e=>setDraft(d=>d?{...d,subject_id:e.target.value}:d)} disabled={!library.subjects.length}>
          {!library.subjects.length&&<option value="">أنشئ مادة أولًا</option>}
          {library.subjects.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
        </select></label>
        <label className="upload-zone"><input type="file" accept=".pdf,.docx,.txt,.md" onChange={selectFile} disabled={saving} aria-label="اختيار ملف دراسي"/><Upload size={28}/><strong>{saving?'جاري استخراج المحتوى...':'اختر ملف PDF أو Word أو TXT أو MD'}</strong><small>الملف يُفحص على جهازك أولًا، ثم تُراجع الفقرات قبل الحفظ</small></label>
        <div className="import-toolbar"><button type="button" className="outline-btn" onClick={()=>{
          setDraft({file:null,title:'درس جديد',text:'',autoChapters:false,subject_id:subjectId||library.subjects[0]?.id});
          setImportWarnings([]);
        }}><Pencil size={15}/> كتابة أو لصق نص بدل رفع ملف</button></div>
        {draft&&<><label>عنوان الدرس<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
          <div className="import-stats"><FileText size={17}/> {draft.file?.name||'نص أُدخل يدويًا'} — {importPreview.length} دروس — {importPreview.reduce((sum,c)=>sum+c.sections.length,0)} فقرات — لغة المصدر {sourceLanguage(draft.text)==='ar'?'العربية':'الإنجليزية'}</div>
          <label className="checkbox-line"><input type="checkbox" checked={draft.autoChapters} onChange={e=>setDraft({...draft,autoChapters:e.target.checked})}/> اكتشاف الفصول والوحدات والمحاضرات بالعربية أو الإنجليزية تلقائيًا. ويمكن إيقافه لحفظ الملف كدرس واحد.</label>
          {/\brestricted\b|سري|مقيد/i.test(draft.text)&&<p className="restriction"><AlertTriangle size={18}/> الملف يتضمن مؤشرًا على تقييد المحتوى. لا تحفظه في خدمة سحابية إلا بعد التأكد من أن التصريح يسمح بذلك.</p>}
          <label>معاينة النص القابل للتعديل<textarea className="extracted-text" dir="auto" rows={11} value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value})}/></label>
          {importWarnings.map((warning,i)=><p className="restriction" key={i}><AlertTriangle size={16}/>{warning}</p>)}
          {!!importPreview.length&&<section className="import-preview"><h3>معاينة توزيع الدروس والفقرات قبل الحفظ</h3>
            {importPreview.slice(0,6).map((chapter,i)=><div className="import-preview-item" key={i}>
              <strong>{i+1}. {chapter.title||'درس بلا عنوان'} — {chapter.sections.length} فقرة</strong>
              <p dir="auto">{chapter.sections[0]?.slice(0,190)}{(chapter.sections[0]?.length||0)>190?'…':''}</p>
            </div>)}
            {importPreview.length>6&&<p className="helper-text">باقي {importPreview.length-6} دروس أخرى ستُحفظ بعد التأكيد.</p>}
          </section>}
          <p className="helper-text">راجع ترتيب الفصول والأرقام والمعادلات قبل الحفظ. ملفات PDF الممسوحة ضوئيًا تحتاج OCR ولن تُستخرج صورها كنص تلقائيًا.</p>
        </>}
        {demo&&<p className="demo-warning"><Info size={16}/> في وضع التجربة يمكنك استيراد النص وقراءته مؤقتًا، لكن التحديث سيزيله.</p>}
        <div className="modal-actions"><button className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" disabled={!draft?.text?.trim()||!draft.subject_id||saving} onClick={saveImport}>{saving&&<LoaderCircle size={16} className="spin"/>}<Check size={17}/> حفظ الدرس والفقرات</button></div>
      </div>
    </Modal>}

    {isAdmin&&dialog==='generate'&&<Modal title="توليد الشرح تلقائيًا" subtitle="سيظهر الشرح أولًا كمسودة قابلة للتعديل قبل حفظها." onClose={()=>{if(!processing)setDialog('')}}>
      <div className="modal-body form-stack">
        <div className="generation-note">
          <BookOpen size={20}/>
          <div><strong>ماذا سيتم إعداده؟</strong>
            <p>ترجمة أكاديمية باللغة العربية، وشرح واضح بالعربية والإنجليزية، ونص مناسب للقراءة الصوتية. لا تُنشأ ملفات صوتية MP3 تلقائيًا؛ يشغّل المتصفح النص المتاح بصوته.</p>
          </div>
        </div>
        <label>مستوى الشرح<select value={studyLevel} onChange={e=>setStudyLevel(e.target.value)}><option value="basic">مبسّط — للفهم الأولي</option><option value="intermediate">متوسط — شرح متوازن</option><option value="advanced">متقدم — شرح مفصل</option></select></label>
        <label className="checkbox-line"><input type="checkbox" checked={consent} disabled={processing} onChange={e=>setConsent(e.target.checked)}/> أؤكد أن لدي تصريحًا لإرسال هذه الفقرة إلى خدمة ذكاء اصطناعي خارجية، وأوافق على معالجتها.</label>
        {demo&&<p className="demo-warning"><Info size={16}/> ميزة التوليد غير متاحة في الوضع التجريبي. يلزم ربط Supabase وتفعيل خدمة التوليد في Netlify. يمكنك تعديل الشرح يدويًا الآن.</p>}
        <div className="modal-actions">
          <button className="outline-btn" disabled={processing} onClick={editSection}><Pencil size={15}/> تحرير المحتوى يدويًا</button>
          <button className="primary-btn" disabled={processing||!consent||demo} onClick={processTranslation}>{processing&&<LoaderCircle className="spin" size={16}/>}<Sparkles size={16}/> توليد مسودة قابلة للتعديل</button>
        </div>
      </div>
    </Modal>}

    {isAdmin&&dialog==='edit'&&<Modal wide title={generatedDraft?'مراجعة الشرح التلقائي وتعديله':'تعديل الترجمة والشرح'} subtitle="كل تغيير تحفَظه هنا سيظهر في القارئ ويُستخدم عند تشغيل الشرح الصوتي." onClose={()=>setDialog('')}>
      <div className="modal-body form-stack edit-form">
        {generatedDraft&&<div className="review-banner"><CheckCircle2 size={20}/><div><strong>تم إنشاء المسودة بنجاح</strong><p>لم تُحفظ بعد. راجع المصطلحات وعدّل الشرح العربي والإنجليزي كما تريد، ثم اضغط «حفظ الشرح».</p></div></div>}
        <section className="editor-section">
          <h3><Languages size={17}/> الترجمة العربية</h3>
          <p>هذه ترجمة النص الأصلي؛ تختلف عن الشرح المبسط.</p>
          <textarea dir="rtl" rows={4} aria-label="الترجمة العربية" value={editDraft.content_ar||''} onChange={e=>setEditDraft(prev=>({...prev,content_ar:e.target.value}))} placeholder="اكتب الترجمة العلمية للفقرة هنا..."/>
        </section>
        <section className="editor-section">
          <h3><Sparkles size={17}/> الشرح بالعربية</h3>
          <p>اشرح الفكرة بطريقة سهلة. سيُستخدم هذا النص نفسه عند اختيار «شرح صوتي بالعربية».</p>
          <textarea dir="rtl" rows={5} aria-label="الشرح بالعربية" value={editDraft.explanation_ar||''} onChange={e=>setEditDraft(prev=>({...prev,explanation_ar:e.target.value}))} placeholder="اشرح الفكرة العلمية بالعربي بطريقة مبسطة..."/>
        </section>
        <section className="editor-section">
          <h3><Headphones size={17}/> Explanation in English</h3>
          <p>شرح علمي بالإنجليزية، ويُقرأ بالصوت الإنجليزي عند تشغيله.</p>
          <textarea dir="ltr" rows={5} aria-label="English explanation" value={editDraft.explanation_en||''} onChange={e=>setEditDraft(prev=>({...prev,explanation_en:e.target.value}))} placeholder="Write a clear English explanation here..."/>
        </section>
        <section className="editor-section">
          <h3><Languages size={17}/> الشرح المدمج (عربي + English)</h3>
          <p>نسخة اختيارية تجمع المصطلحات الإنجليزية مع شرحها العربي. يمكن الاستماع إليها بصوتين بحسب اللغة المتاحة في الجهاز.</p>
          <textarea dir="rtl" rows={4} aria-label="الشرح المدمج" value={editDraft.explanation_mixed||''} onChange={e=>setEditDraft(prev=>({...prev,explanation_mixed:e.target.value}))} placeholder="مثال: Operations Research هو علم بحوث العمليات..."/>
        </section>
        <details className="editor-advanced"><summary>خيارات إضافية: تعديل النص الأصلي ورفع تسجيل صوتي</summary>
          <div className="editor-extras">
            <label>النص الأصلي<textarea dir={originalLanguage==='ar'?'rtl':'ltr'} rows={4} value={editDraft.content_en||''} onChange={e=>setEditDraft(prev=>({...prev,content_en:e.target.value}))}/></label>
            <p className="helper-text">تعديل النص الأصلي يغيّر ما يُقرأ من الملف في هذا الدرس، لذا استخدمه لتصحيح أخطاء الاستخراج فقط.</p>
            <div className="audio-upload-box"><strong><FileAudio size={17}/> رفع تسجيلات صوتية (اختياري)</strong><p>يمكن رفع تسجيل منفصل لكل لغة. بدون تسجيل، يحاول المتصفح قراءة نص الشرح الذي حفظته.</p>
              <div className="audio-upload-grid">{tracks.map(option=><label key={option.id} className="audio-upload-input">{option.label}<input type="file" accept="audio/*" disabled={demo||saving} onChange={e=>handleAudioFile(e,option.id)}/></label>)}</div>
            </div>
          </div>
        </details>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setDialog('')} disabled={saving}>إلغاء</button>
          <button className="primary-btn" onClick={saveEdit} disabled={saving}>{saving&&<LoaderCircle size={16} className="spin"/>}<Check size={17}/> حفظ الشرح والترجمة</button>
        </div>
      </div>
    </Modal>}

        {dialog==='help'&&<Modal title="دليل المنصة" subtitle="خطوات مختصرة لبدء الدراسة." onClose={()=>setDialog('')}>
      <div className="modal-body help-content">
        {isAdmin?<><div><span className="help-number">01</span><p><strong>أضف مادة</strong> من أعلى الصفحة، ثم حدد اسمها ووصفها.</p></div>
        <div><span className="help-number">02</span><p><strong>استورد درسًا</strong> من PDF أو Word أو TXT أو Markdown. راجع الفصول والفقرات قبل الحفظ.</p></div>
        <div><span className="help-number">03</span><p><strong>حرّر الشرح</strong> بالعربية والإنجليزية أو أنشئ مسودة بالذكاء الاصطناعي ثم راجعها واحفظها.</p></div>
        <div><span className="help-number">04</span><p><strong>انشر المحتوى</strong> عبر حفظه؛ يصبح متاحًا لجميع المستخدمين المسجلين تلقائيًا.</p></div></>
        :<><div><span className="help-number">01</span><p><strong>اختر المادة والدرس</strong> من المكتبة المشتركة التي جهّزها المشرف.</p></div>
        <div><span className="help-number">02</span><p><strong>اقرأ الأصل والترجمة</strong> ثم افتح الشرح المبسط باللغة المناسبة لك.</p></div>
        <div><span className="help-number">03</span><p><strong>استمع</strong> إلى الشرح بالعربية أو الإنجليزية، واختر صوت الجهاز أو الصوت الواقعي الذكي عند تفعيله.</p></div>
        <div><span className="help-number">04</span><p><strong>تابع دراستك</strong> لأن تقدمك محفوظ في حسابك، دون تعديل المادة المشتركة.</p></div></>}
        <p className="helper-text">لا يعني ظهور مسودة مترجمة أنها دقيقة تلقائيًا؛ تحقق من المصطلحات العلمية والأشكال والمعادلات.</p>
      </div>
    </Modal>}
  </div>;
}
