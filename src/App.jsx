import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, BookText, Check, CheckCircle2, ChevronLeft, ChevronRight,
  CirclePlay, Cloud, FileAudio, FileText, FolderOpen, Headphones, Info, Languages,
  LayoutDashboard, LoaderCircle, LogOut, Menu, Moon, Pause, Pencil, Plus, Search,
  Settings2, ShieldCheck, SkipBack, SkipForward, Sparkles, Square, Sun, Upload,
  Volume2, X, AlertTriangle, LockKeyhole
} from 'lucide-react';
import { configured, supabase } from './lib/supabase.js';
import { extractText, splitIntoSections, detectChapters } from './lib/import.js';
import { speechParts, speakParts, stopSpeech, sourceLanguage } from './lib/speech.js';
import * as api from './lib/api.js';

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
      <div className="eyebrow">مرحبًا بك</div><h2>{signup?'إنشاء حساب جديد':'تسجيل الدخول'}</h2><p className="subtle">موادك محفوظة بصورة خاصة في حسابك.</p>
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
  const [sectionIndex,setSectionIndex] = useState(0);
  const [dialog,setDialog] = useState('');
  const [subjectTitle,setSubjectTitle] = useState('');
  const [subjectDescription,setSubjectDescription] = useState('');
  const [draft,setDraft] = useState(null);
  const [editDraft,setEditDraft] = useState({});
  const [consent,setConsent] = useState(false);
  const [batchConsent,setBatchConsent] = useState(false);
  const [studyLevel,setStudyLevel] = useState('intermediate');
  const [batchDone,setBatchDone] = useState(0);
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
    cancelSpeech.current?.(); cancelSpeech.current=null;stopSpeech();
    if(audioRef.current){audioRef.current.pause();audioRef.current.src='';audioRef.current=null;}
    setPlaying(false);setPaused(false);setAudioPosition(0);setAudioLength(0);
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
  const play = async()=>{
    if(!current)return;
    if(!canPlayAudio){
      setError(purpose==='explain'
        ? 'لم يُكتب شرح صوتي لهذا المسار بعد. أضف شرحًا أو أنشئه من زر «إعداد الترجمة والشرح».'
        : 'لا يوجد نص بهذه اللغة بعد. أضف الترجمة أولًا من «إعداد الترجمة والشرح».');
      return;
    }
    if(playing){
      if(audioRef.current){ audioRef.current.pause();setPaused(true);setPlaying(false); }
      else if('speechSynthesis' in window){window.speechSynthesis.pause();setPaused(true);setPlaying(false)}
      return;
    }
    if(paused){
      if(audioRef.current)audioRef.current.play().catch(e=>setError(shortError(e)));
      else window.speechSynthesis.resume();
      setPlaying(true);setPaused(false);return;
    }
    stop();
    try {
      if(recordedTrack){
        const url=await api.signedAudioUrl(current[trackPath]);
        const player=new Audio(url);audioRef.current=player;player.playbackRate=speed;
        player.ontimeupdate=()=>setAudioPosition(player.currentTime);
        player.onloadedmetadata=()=>setAudioLength(player.duration||0);
        player.onended=()=>{setPlaying(false);setPaused(false)};
        player.onerror=()=>{setError('لم يمكن تشغيل الملف الصوتي.');setPlaying(false)};
        await player.play();setPlaying(true);
      } else {
        cancelSpeech.current=speakParts(speechContent,speed,
          ()=>{setPlaying(true);setPaused(false)},
          ()=>{setPlaying(false);setPaused(false)},
          msg=>{setError(msg);setPlaying(false);setPaused(false)}
        );
      }
      await saveLocation(lessonId,current.id);
    }catch(e){setPlaying(false);setError(shortError(e))}
  };
  const setAudioTrack = value=>{stop();setTrack(value);if(current)saveLocation(lessonId,current.id,value,speed)};
  const setListenPurpose = value=>{stop();setPurpose(value)};
  const setAudioSpeed = value=>{const n=Number(value);setSpeed(n);if(audioRef.current)audioRef.current.playbackRate=n;if(current)saveLocation(lessonId,current.id,track,n)};

  const createSubject = async e=>{
    e.preventDefault();
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
  const selectFile = async e=>{
    const file=e.target.files?.[0];e.target.value='';
    if(!file)return;
    setSaving(true);
    try{
      const extracted=await extractText(file);
      if(!extracted)throw Error('تعذّر استخراج نص من الملف. قد يكون صورة ممسوحة تحتاج OCR.');
      setDraft({file,title:file.name.replace(/\.[^.]+$/,''),text:extracted,autoChapters:true,subject_id:subjectId||library.subjects[0]?.id});
      setDialog('import');
    }catch(err){setError(shortError(err))}finally{setSaving(false)}
  };
  const saveImport = async()=>{
    if(!draft?.title.trim()||!draft.subject_id)return setError('أضف مادة أولًا وحدد عنوانًا للدرس.');
    const chapters=draft.autoChapters?detectChapters(draft.text,draft.title):[{title:draft.title,sections:splitIntoSections(draft.text)}];
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
      notify(`تم حفظ ${createdLessons.length} درسًا بإجمالي ${chapters.reduce((sum,ch)=>sum+ch.sections.length,0)} فقرة. راجع المحتوى قبل الاعتماد.`);
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const editSection = ()=>{
    if(!current)return;
    const keys=['content_en','content_ar','explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en'];
    setEditDraft(Object.fromEntries(keys.map(k=>[k,current[k]||''])));
    setConsent(false);setDialog('edit');
  };
  const saveEdit = async()=>{
    if(!current)return;
    setSaving(true);
    try{
      if(demo) setLibrary(prev=>({...prev,sections:prev.sections.map(s=>s.id===current.id?{...s,...editDraft}:s)}));
      else{await api.saveSection(current.id,editDraft);await refresh()}
      setDialog('');notify('تم حفظ تعديلات الفقرة.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const processTranslation = async()=>{
    if(demo)return setError('المعالجة الآلية تحتاج مشروع Supabase وEdge Function.');
    if(!consent)return setError('يلزم الموافقة الصريحة قبل إرسال محتوى الفقرة للمزود الخارجي.');
    if(!current)return;
    setProcessing(true);
    try{
      await api.generateTranslation(current.id, studyLevel);
      const next=await refresh();
      const updated=next.sections.find(s=>s.id===current.id);
      if(updated)setEditDraft({content_en:updated.content_en,content_ar:updated.content_ar,explanation_ar:updated.explanation_ar,explanation_en:updated.explanation_en,explanation_mixed:updated.explanation_mixed,speech_ar:updated.speech_ar,speech_en:updated.speech_en});
      notify('أُنشئت مسودة الترجمة والشرح. يمكنك الاستماع إليها من تبويب «شرح مبسط» بعد مراجعتها.');
      if(dialog==='generate')setDialog('');
    }catch(e){setError(shortError(e))}finally{setProcessing(false)}
  };
  const remainingBatch = activeSections.filter(s=>!s.content_ar?.trim() || !s.explanation_ar?.trim()).slice(0,5);
  const processBatch = async()=>{
    if(demo || !session)return setError('اربط حساب Supabase أولًا.');
    if(!batchConsent)return setError('يلزم التصريح قبل إرسال المحتوى لمزود خارجي.');
    setProcessing(true);setBatchDone(0);
    try {
      for(const section of remainingBatch){
        await api.generateTranslation(section.id,studyLevel);
        setBatchDone(n=>n+1);
      }
      await refresh();
      notify(`تمت معالجة ${remainingBatch.length} فقرات. يجب مراجعتها علميًا قبل الاعتماد.`);
      setDialog('');
    }catch(e){
      await refresh().catch(()=>{});
      setError('توقفت معالجة المجموعة: '+shortError(e));
    }finally{setProcessing(false)}
  };
  const handleAudioFile = async(e,targetTrack)=>{
    const file=e.target.files?.[0];e.target.value='';
    if(!file||!current||demo)return;
    if(!file.type.startsWith('audio/'))return setError('الملف يجب أن يكون صوتيًا.');
    setSaving(true);
    try{await api.uploadAudio(current,targetTrack,file,session.id);await refresh();notify('تم حفظ الملف الصوتي الخاص بهذا المسار.')}
    catch(err){setError(shortError(err))}finally{setSaving(false)}
  };
  const logout=async()=>{
    stop();if(configured&&!demo)await supabase.auth.signOut();
    setSession(null);setDemo(false);setLibrary(emptyData());setScreen('home');
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
        <div className="side-caption">المساحة الشخصية</div>
        <button className={'side-nav '+(screen==='home'?'selected':'')} onClick={()=>{setScreen('home');setDrawer(false)}}><LayoutDashboard size={19}/> لوحة المذاكرة</button>
        <button className={'side-nav '+(screen==='reader'?'selected':'')} disabled={!activeLesson} onClick={()=>{setScreen('reader');setDrawer(false)}}><BookOpen size={19}/> قارئ الدروس</button>
        <div className="side-title"><span>المواد الدراسية</span><button className="icon-btn small-icon" onClick={()=>setDialog('subject')} aria-label="إضافة مادة"><Plus size={19}/></button></div>
        {library.subjects.map(s=><button key={s.id} className={'subject-link '+(subjectId===s.id?'active':'')} onClick={()=>{setSubjectId(s.id);setScreen('home');setDrawer(false)}}>
          <span className="folder-dot"><FolderOpen size={17}/></span><span className="ellipsis">{s.title}</span><span className="item-count">{library.lessons.filter(l=>l.subject_id===s.id).length}</span>
        </button>)}
        {!library.subjects.length&&<p className="sidebar-empty">أنشئ أول مادة لتنظيم دروسك.</p>}
        <div className="side-caption second-caption">المساعدة</div>
        <button className="side-nav" onClick={()=>{setDialog('help');setDrawer(false)}}><Info size={19}/> دليل الاستخدام</button>
      </div>
      <div className="sidebar-footer">
        <div className="account-card"><div className="avatar">{demo?'ت':(session?.email?.[0]||'م').toUpperCase()}</div><div className="account-text"><strong>{demo?'وضع التجربة':'حساب الطالب'}</strong><span>{demo?'تجربة محلية مؤقتة':session?.email}</span></div></div>
        <button className="side-nav footer-action" onClick={logout}><LogOut size={18}/>{demo?'إنهاء التجربة':'تسجيل الخروج'}</button>
      </div>
    </aside>

    {drawer&&<button className="mobile-shade" onClick={()=>setDrawer(false)} aria-label="إغلاق القائمة"/>}
    <div className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-btn mobile-only" onClick={()=>setDrawer(true)} aria-label="فتح القائمة"><Menu size={22}/></button><span className="topbar-crumb">المكتبة الدراسية</span><ChevronLeft size={15} className="crumb-arrow"/><strong>{screen==='reader'?activeLesson?.title || 'قارئ الدروس':parentTitle(library,subjectId)}</strong></div>
        <div className="topbar-tools">
          {demo&&<span className="demo-pill"><span className="status-dot"/> وضع تجريبي</span>}
          <button className="icon-btn" onClick={()=>setTheme(t=>t==='light'?'dark':'light')} aria-label="تغيير المظهر" title="تغيير المظهر">{theme==='light'?<Moon size={19}/>:<Sun size={19}/>}</button>
          <button className="top-add" onClick={()=>setDialog('subject')}><Plus size={17}/><span>مادة جديدة</span></button>
        </div>
      </header>
      <main className="page-content">
        {screen==='home'&&<>
          <div className="home-hero">
            <div className="hero-copy"><span className="hero-kicker"><Sparkles size={16}/> مساحتك للتعلم</span><h1>كل مادة، <span>فهم أعمق.</span></h1><p>رتّب دروسك، اقرأ بلغتين، واستمع للشرح بأسلوب يناسبك. ابدأ من حيث توقفت.</p>
            <div className="hero-actions"><button className="primary-btn" onClick={()=>setDialog(library.subjects.length?'import':'subject')}><Upload size={18}/> إضافة ملف دراسي</button>{activeLesson&&<button className="light-btn" onClick={()=>openLesson(activeLesson.id)}>متابعة القراءة <ArrowLeft size={17}/></button>}</div>
            </div>
            <div className="hero-illustration" aria-hidden="true"><div className="hero-paper hero-paper-back"/><div className="hero-paper hero-paper-front"><div className="paper-dot"/><div className="paper-title-line"/><div className="paper-line"/><div className="paper-line short"/><div className="paper-separator"/><div className="paper-title-line cream"/><div className="paper-line"/><div className="paper-line tiny"/></div><div className="floating-headphones"><Headphones size={33}/></div></div>
          </div>
          <div className="metrics"><div className="metric"><div className="metric-icon green"><FolderOpen size={21}/></div><div><span>المواد الدراسية</span><strong>{library.subjects.length}</strong></div></div>
            <div className="metric"><div className="metric-icon blue"><BookText size={21}/></div><div><span>الدروس المضافة</span><strong>{library.lessons.length}</strong></div></div>
            <div className="metric"><div className="metric-icon gold"><FileText size={21}/></div><div><span>الفقرات المتاحة</span><strong>{library.sections.length}</strong></div></div>
            <div className="metric"><div className="metric-icon violet"><CheckCircle2 size={21}/></div><div><span>دروس تابعتها</span><strong>{reviewed}</strong></div></div>
          </div>
          <div className="section-bar"><div><span className="eyebrow">مكتبتي</span><h2>المواد والدروس</h2><p className="subtle">استعرض المحتوى أو أضف ملفات جديدة إلى أي مادة.</p></div><div className="search-wrap"><Search size={17}/><input aria-label="بحث في المواد والدروس" placeholder="ابحث في مكتبتك..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
          <div className="library-grid">
            {subjects.map(s=><button className={'subject-card '+(subjectId===s.id?'subject-chosen':'')} key={s.id} onClick={()=>setSubjectId(s.id)}>
              <div className="subject-card-top"><span className="subject-card-icon"><BookOpen size={22}/></span><span className="card-count">{library.lessons.filter(l=>l.subject_id===s.id).length} دروس</span></div>
              <strong>{s.title}</strong><p>{s.description||'ملفات وملاحظات المادة الدراسية'}</p><span className="subject-open">استعراض الدروس <ChevronLeft size={16}/></span>
            </button>)}
            <button className="create-card" onClick={()=>setDialog('subject')}><span><Plus size={25}/></span><strong>إضافة مادة جديدة</strong><small>أنشئ مساحة جديدة لتنظيم دروسك</small></button>
          </div>
          {subjectId&&<section className="lessons-panel">
            <div className="section-bar compact"><div><h2>دروس {parentTitle(library,subjectId)}</h2><p className="subtle">اختر درسًا أو استورد ملفًا لبدء الدراسة.</p></div><button className="outline-btn" onClick={()=>setDialog('import')}><Upload size={16}/> إضافة درس</button></div>
            {lessons.length? <div className="lesson-list">{lessons.map((lesson,i)=>{
              const total=library.sections.filter(s=>s.lesson_id===lesson.id).length;
              const p=library.progress.find(p=>p.lesson_id===lesson.id);
              return <button className="lesson-item" key={lesson.id} onClick={()=>openLesson(lesson.id)}>
                <span className="lesson-number">{String(i+1).padStart(2,'0')}</span><div className="lesson-details"><strong dir="auto">{lesson.title}</strong><span>{total} فقرة {p?'• آخر موضع محفوظ':''}</span></div><span className="lesson-read">ابدأ الدراسة <ChevronLeft size={18}/></span>
              </button>})}</div>:<div className="no-lessons"><FileText size={34}/><strong>لا توجد دروس في هذه المادة بعد</strong><p>أضف ملف PDF أو Word أو TXT لتقسيمه إلى فقرات قابلة للقراءة والاستماع.</p><button className="primary-btn" onClick={()=>setDialog('import')}><Upload size={16}/> استيراد أول درس</button></div>}
          </section>}
        </>}

        {screen==='reader'&&activeLesson&&<>
          <div className="reader-breadcrumb"><button onClick={()=>setScreen('home')}>المواد الدراسية</button><ChevronLeft size={15}/><span>{parentTitle(library,activeLesson.subject_id)}</span><ChevronLeft size={15}/><strong dir="auto">{activeLesson.title}</strong></div>
          <div className="reader-top">
            <div><div className="eyebrow">وضع المذاكرة <span className="small-circle"/> {parentTitle(library,activeLesson.subject_id)}</div><h1 dir="auto">{activeLesson.title}</h1><p>تقدّم بالدرس فقرةً فقرة، وبدّل اللغة أو المسار الصوتي في أي وقت.</p></div>
            <div className="reader-actions">
              {!demo&&remainingBatch.length>0&&<button className="outline-btn" onClick={()=>{setBatchConsent(false);setBatchDone(0);setDialog('batch')}}><Sparkles size={16}/> معالجة 5 فقرات</button>}
              <button className="outline-btn" onClick={editSection} disabled={!current}><Pencil size={16}/> تحرير الفقرة</button>
            </div>
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
                        : <div className="empty-copy"><p>لم تُضف الترجمة العربية لهذه الفقرة بعد.</p><button className="outline-btn" onClick={()=>{setConsent(false);setDialog('generate')}}><Sparkles size={16}/> إعداد الترجمة والشرح</button></div>}
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
                    ? <div className="explain-body" dir={explainMode==='en'?'ltr':'rtl'}><p>{explanationText}</p></div>
                    : <div className="missing-explanation">
                        <div><Info size={18}/><strong>لا يوجد شرح بهذا المسار حتى الآن</strong></div>
                        <p>استيراد الملف يضيف النص الأصلي فقط. تستطيع إنشاء مسودة شرح وترجمة بإذن منك، أو كتابتهما بنفسك.</p>
                        <div className="missing-actions">
                          <button className="primary-btn" onClick={()=>{setConsent(false);setDialog('generate')}}><Sparkles size={16}/> إعداد شرح وترجمة</button>
                          <button className="outline-btn" onClick={editSection}><Pencil size={16}/> إضافة شرح يدويًا</button>
                        </div>
                      </div>}
                </section>
                <div className="reading-footer"><span>النص الأصلي محفوظ دون تعديل؛ يُفضّل مراجعة دقة المصطلحات العلمية.</span><button onClick={editSection}><Pencil size={14}/> تعديل النص والترجمة والشرح</button></div>
              </div>:<div className="no-lessons"><p>لا توجد فقرات في هذا الدرس.</p></div>}
              <div className="navigation-card"><button className="outline-btn" disabled={sectionIndex===0} onClick={()=>changeSection(sectionIndex-1)}><ChevronRight size={17}/> السابقة</button>
                <div className="navigation-progress"><div><span>تقدّمك في الدرس</span><strong>{percentage}%</strong></div><div className="progress-bar"><span style={{width:percentage+'%'}}/></div></div>
                <button className="primary-btn" disabled={sectionIndex>=activeSections.length-1} onClick={()=>changeSection(sectionIndex+1)}>التالية <ChevronLeft size={17}/></button>
              </div>
            </div>
            <aside className="study-panel">
              <div className="audio-panel">
                <div className="audio-icon"><Headphones size={23}/></div><h3>استمع إلى الدرس</h3><p className="subtle">اختر اللغة وطريقة الشرح التي تناسب مذاكرتك.</p>
                <div className="audio-label">مسار الاستماع</div>
                <div className="audio-tracks">{tracks.map(option=><button key={option.id} className={'track '+(track===option.id?'track-selected':'')} onClick={()=>setAudioTrack(option.id)}>
                  <span className="track-radio"/><span><strong>{option.label}</strong><small>{option.hint}</small></span>
                </button>)}</div>
                <div className="playback">
                  <div className="playback-header"><span><Volume2 size={16}/> {current?.[({mixed:'audio_mixed_path',en:'audio_en_path',ar:'audio_ar_path'}[track])]?'ملف صوتي مسجل':'صوت المتصفح'}</span><span>{audioLength?Math.round(audioPosition)+' / '+Math.round(audioLength)+' ث':'تشغيل عند الطلب'}</span></div>
                  <div className="audio-progress"><span style={{width:audioLength?(100*audioPosition/audioLength)+'%':(playing?'20%':'0%')}}/></div>
                  <div className="play-row"><button className="skip" onClick={()=>changeSection(sectionIndex-1)} disabled={sectionIndex===0} aria-label="الفقرة السابقة"><SkipForward size={19}/></button>
                    <button className="play-main" onClick={play} disabled={!current} aria-label={playing?'إيقاف مؤقت':'تشغيل'}>{playing?<Pause size={23} fill="currentColor"/>:<CirclePlay size={27}/>}</button>
                    <button className="skip" onClick={()=>changeSection(sectionIndex+1)} disabled={sectionIndex===activeSections.length-1} aria-label="الفقرة التالية"><SkipBack size={19}/></button>
                    <button className="skip stop-play" onClick={stop} aria-label="إيقاف"><Square size={17}/></button>
                  </div>
                  <div className="speed-row"><span>سرعة التشغيل</span><div className="speed-pills">{speeds.map(n=><button className={speed===n?'speed-selected':''} key={n} onClick={()=>setAudioSpeed(n)}>{n}×</button>)}</div></div>
                </div>
                <p className="audio-note"><Info size={15}/> جودة الصوت واللغات المتاحة تعتمد على أصوات نظامك، ما لم ترفع تسجيلًا خاصًا.</p>
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

    {dialog==='subject'&&<Modal title="إضافة مادة دراسية" subtitle="اجمع دروس المادة وملفاتها داخل قسم واحد." onClose={()=>setDialog('')}>
      <form className="modal-body form-stack" onSubmit={createSubject}><label>اسم المادة<input value={subjectTitle} onChange={e=>setSubjectTitle(e.target.value)} required maxLength={120} placeholder="مثال: بحوث عمليات"/></label>
        <label>الوصف (اختياري)<textarea rows={3} value={subjectDescription} onChange={e=>setSubjectDescription(e.target.value)} placeholder="وصف مختصر للمادة أو الفصل الدراسي"/></label>
        <div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" disabled={saving}>{saving&&<LoaderCircle size={16} className="spin"/>}<Plus size={16}/> إضافة المادة</button></div>
      </form>
    </Modal>}

    {dialog==='import'&&<Modal wide title="استيراد درس جديد" subtitle="تستخرج المنصة النص أولًا، ثم تتيح لك مراجعته وتصحيحه قبل الحفظ." onClose={()=>setDialog('')}>
      <div className="modal-body form-stack">
        <label>المادة الدراسية<select value={draft?.subject_id||subjectId||''} onChange={e=>setDraft(d=>d?{...d,subject_id:e.target.value}:d)} disabled={!library.subjects.length}>
          {!library.subjects.length&&<option value="">أنشئ مادة أولًا</option>}
          {library.subjects.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
        </select></label>
        <label className="upload-zone"><input type="file" accept=".pdf,.docx,.txt" onChange={selectFile} disabled={saving} aria-label="اختيار ملف دراسي"/><Upload size={28}/><strong>{saving?'جاري استخراج المحتوى...':'اضغط لاختيار ملف PDF أو Word أو TXT'}</strong><small>حتى 30MB • لا يُرفع إلى السحابة قبل اختيار حفظ الدرس</small></label>
        {draft&&<><label>عنوان الدرس<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
          <div className="import-stats"><FileText size={17}/> {draft.file.name} — {draft.autoChapters?detectChapters(draft.text,draft.title).length:1} فصول/دروس — {draft.autoChapters?detectChapters(draft.text,draft.title).reduce((sum,c)=>sum+c.sections.length,0):splitIntoSections(draft.text).length} فقرات</div>
          <label className="checkbox-line"><input type="checkbox" checked={draft.autoChapters} onChange={e=>setDraft({...draft,autoChapters:e.target.checked})}/> تقسيم الفصول تلقائيًا عند اكتشاف عناوين Chapter / Unit. راجع النتيجة، فقد تختلف تنسيقات الملفات.</label>
          {/\brestricted\b|سري|مقيد/i.test(draft.text)&&<p className="restriction"><AlertTriangle size={18}/> الملف يتضمن مؤشرًا على تقييد المحتوى. لا تحفظه في خدمة سحابية إلا بعد التأكد من أن التصريح يسمح بذلك.</p>}
          <label>معاينة النص القابل للتعديل<textarea className="extracted-text" dir="auto" rows={11} value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value})}/></label>
          <p className="helper-text">الاستخراج من ملفات PDF المعقدة أو الصور قد يكون ناقصًا. راجع الرموز والمعادلات والمصطلحات، لأن التقسيم آلي وتقريبي.</p>
        </>}
        {demo&&<p className="demo-warning"><Info size={16}/> في وضع التجربة يمكنك استيراد النص وقراءته مؤقتًا، لكن التحديث سيزيله.</p>}
        <div className="modal-actions"><button className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" disabled={!draft||!draft.subject_id||saving} onClick={saveImport}>{saving&&<LoaderCircle size={16} className="spin"/>}<Check size={17}/> حفظ الدرس والفقرات</button></div>
      </div>
    </Modal>}

    {dialog==='edit'&&<Modal wide title={`تحرير الفقرة ${sectionIndex+1}`} subtitle="الأصل الإنجليزي منفصل عن الترجمة والشرح؛ بإمكانك تعديل كل مسار مستقلًا." onClose={()=>setDialog('')}>
      <div className="modal-body form-stack edit-form">
        {[
          ['content_en','النص الإنجليزي الأصلي'],['content_ar','الترجمة الأكاديمية العربية'],
          ['explanation_mixed','شرح مدمج عربي + مصطلحات إنجليزية'],['explanation_en','شرح باللغة الإنجليزية'],
          ['explanation_ar','شرح باللغة العربية'],['speech_en','نص المسار الصوتي الإنجليزي'],
          ['speech_ar','نص المسار الصوتي العربي'],
        ].map(([key,label])=><label key={key}>{label}<textarea dir={key==='content_en'||key==='speech_en'||key==='explanation_en'?'ltr':'rtl'} rows={key==='content_en'?4:3} value={editDraft[key]||''} onChange={e=>setEditDraft(prev=>({...prev,[key]:e.target.value}))}/></label>)}
        <div className="generator-box"><div className="generator-title"><Sparkles size={18}/><strong>ترجمة وشرح بالذكاء الاصطناعي (اختياري)</strong></div><p>هذه الميزة تتطلب نشر وظيفة المعالجة وإعداد مفتاح الخدمة. ستُرسل الفقرة الإنجليزية فقط إلى مزود خارجي عند الضغط على المعالجة.</p>
          <label>مستوى الشرح<select value={studyLevel} onChange={e=>setStudyLevel(e.target.value)}><option value="basic">مبسّط — للمبتدئين</option><option value="intermediate">متوسط — شرح متوازن</option><option value="advanced">متقدم — شرح علمي معمّق</option></select></label>
          <label className="checkbox-line"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> أؤكد أن المادة مسموح بإرسالها لمعالج خارجي، وأوافق على معالجة هذه الفقرة.</label>
          <button className="outline-btn" disabled={processing||!consent||demo} onClick={processTranslation}>{processing&&<LoaderCircle className="spin" size={16}/>}<Sparkles size={16}/> إعداد مسودة ترجمة وشرح</button>
        </div>
        <div className="audio-upload-box"><strong><FileAudio size={17}/> ملفات صوتية مسجلة (اختياري)</strong><p>إذا رفعت ملفًا لهذا المسار فسيُشغَّل بدل الصوت المولد من المتصفح.</p>
          <div className="audio-upload-grid">{tracks.map(option=><label key={option.id} className="audio-upload-input">{option.label}<input type="file" accept="audio/*" disabled={demo||saving} onChange={e=>handleAudioFile(e,option.id)}/></label>)}</div>
        </div>
        <div className="modal-actions"><button className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" onClick={saveEdit} disabled={saving}>{saving&&<LoaderCircle size={16} className="spin"/>}<Check size={17}/> حفظ التغييرات</button></div>
      </div>
    </Modal>}

    {dialog==='batch'&&<Modal title="معالجة مجموعة من الفقرات" subtitle="بحد أقصى خمس فقرات في كل دفعة، لتجنب تنفيذ طلبات غير مقصودة." onClose={()=>{if(!processing)setDialog('')}}>
      <div className="modal-body form-stack">
        <p className="subtle">ستنشئ الخدمة مسودات للترجمة والشرح باللغتين للفقرات غير المكتملة في هذا الدرس. قد تُحتسب رسوم من مزود الذكاء الاصطناعي.</p>
        <div className="import-stats"><Sparkles size={17}/> فقرات الدفعة: {remainingBatch.length} {processing?' — اكتمل '+batchDone:''}</div>
        <label>المستوى العلمي<select value={studyLevel} onChange={e=>setStudyLevel(e.target.value)}><option value="basic">مبسّط</option><option value="intermediate">متوسط</option><option value="advanced">متقدم</option></select></label>
        <label className="checkbox-line"><input type="checkbox" checked={batchConsent} disabled={processing} onChange={e=>setBatchConsent(e.target.checked)}/> أؤكد أن لدي صلاحية مشاركة محتوى هذه الفقرات مع مزود ذكاء اصطناعي خارجي، وأوافق على معالجة الدفعة المحددة.</label>
        <div className="modal-actions"><button className="outline-btn" disabled={processing} onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" disabled={processing||!batchConsent||remainingBatch.length===0} onClick={processBatch}>{processing&&<LoaderCircle size={16} className="spin"/>}<Sparkles size={16}/> بدء معالجة الدفعة</button></div>
      </div>
    </Modal>}
    {dialog==='help'&&<Modal title="دليل المنصة" subtitle="خطوات مختصرة لبدء الدراسة." onClose={()=>setDialog('')}>
      <div className="modal-body help-content">
        <div><span className="help-number">01</span><p><strong>أنشئ المادة</strong><br/>سمِّ المادة التي ترغب بدراستها، ثم اخترها من القائمة.</p></div>
        <div><span className="help-number">02</span><p><strong>استورد ملفًا</strong><br/>ارفع PDF أو DOCX أو TXT، وافحص النص المستخرج قبل حفظه.</p></div>
        <div><span className="help-number">03</span><p><strong>اعتمد الترجمة</strong><br/>أدخل الترجمة يدويًا أو فعّل خدمة المعالجة الاختيارية بعد تهيئتها.</p></div>
        <div><span className="help-number">04</span><p><strong>ابدأ المذاكرة</strong><br/>اقرأ باللغتين، بدّل المسار الصوتي، وانتقل بين الفقرات.</p></div>
        <p className="helper-text">لا يعني ظهور مسودة مترجمة أنها دقيقة تلقائيًا؛ تحقق من المصطلحات العلمية والأشكال والمعادلات.</p>
      </div>
    </Modal>}
  </div>;
}
