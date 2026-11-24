import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, BookText, Check, CheckCircle2, ChevronLeft, ChevronRight,
  CirclePlay, Cloud, FileAudio, FileText, FolderOpen, Headphones, Info, Languages,
  LayoutDashboard, LoaderCircle, LogOut, Menu, Moon, Pause, Pencil, Plus, Search,
  Settings2, ShieldCheck, SkipBack, SkipForward, Sparkles, Square, Sun, Upload,
  Volume2, X, AlertTriangle, LockKeyhole, Trash2, UserRound, SlidersHorizontal, ArrowRight, Eye, EyeOff
} from 'lucide-react';
import { configured, supabase } from './lib/supabase.js';
import { extractText, splitIntoSections, detectChapters } from './lib/import.js';
import { speechParts, speakParts, stopSpeech, pauseSpeech, resumeSpeech, sourceLanguage, getAvailableVoices, retryOnlineVoices, ONLINE_VOICE_UNAVAILABLE_EVENT } from './lib/speech.js';
import {cleanupRetiredVoiceDownloads} from './lib/retiredVoiceCleanup.js';
import * as api from './lib/api.js';
import { lockVoiceCatalog, FIXED_VOICE_CATALOG_KEY } from './lib/systemVoices.js';
import { lessonPlaybackPlan } from './lib/lessonPlayback.js';
import { synchronizedSectionUpdate } from './lib/explanationSync.js';
import AccountManager from './components/AccountManager.jsx';
import {listAccountsWithCache} from './lib/accounts.js';
import {loadSiteEditPermissions} from './lib/siteEditPermissions.js';
import AccountAvatar from './components/AccountAvatar.jsx';
import MyAccountSettings from './components/MyAccountSettings.jsx';
import StudyAudioPanel from './components/StudyAudioPanel.jsx';
import ReaderAdvancedSearch from './components/ReaderAdvancedSearch.jsx';
import OfflineSyncCenter from './components/OfflineSyncCenter.jsx';
import {saveOrQueueEdit,isOfflineNetworkError} from './lib/offlineSync.js';
import {queueOfflineEdit,clearStaffSnapshots,readOfflineSnapshot,saveOfflineSnapshot,listOfflineEdits} from './lib/offlineStore.js';
import AboutPage from './components/AboutPage.jsx';
import SiteSettingsPage from './components/SiteSettingsPage.jsx';
import SidebarNav from './components/SidebarNav.jsx';
import {sidebarLabel} from './lib/sidebarMenu.js';
import {readDeviceProgress,writeDeviceProgress} from './lib/deviceProgress.js';
import {DEFAULT_SITE_SETTINGS,loadSiteSettings,isCurrentSiteOwner} from './lib/siteSettings.js';
import {getMyProfile,normalizeUsername,usernameLoginEmail} from './lib/accounts.js';
import {teamAvatarPublicUrl} from './lib/teamAvatars.js';

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
  { id: 'mixed', label:'الإنجليزية ثم العربية', hint:'الفقرة بالإنجليزية، ثم ترجمتها، وبعدها الفقرة التالية' },
  { id: 'en', label:'الإنجليزية فقط', hint:'الاستماع إلى النص الإنجليزي' },
  { id: 'ar', label:'العربية فقط', hint:'الاستماع إلى النص العربي' },
];
const shortError = e => e?.message || 'حدث خطأ غير متوقع.';
const parentTitle = (d,id) => d.subjects.find(x=>x.id===id)?.title || 'المكتبة';
const makeId = () => crypto.randomUUID();

function AuthScreen({onBack,site}){
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [message,setMessage]=useState('');
  const submit=async e=>{
    e.preventDefault();setBusy(true);setMessage('');
    try{
      const email=usernameLoginEmail(normalizeUsername(username));
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw Error('اسم المستخدم أو كلمة المرور غير صحيح.');
      const staffRole=await api.loadMyRole(data?.user?.id);
      if(!['admin','teacher'].includes(staffRole)){
       await supabase.auth.signOut();
       throw Error('الدخول مخصّص للمشرفين وأعضاء هيئة التدريس فقط.');
      }
      setPassword('');onBack();
    }catch(error){setMessage(error?.message||'تعذّر تسجيل الدخول.')}
    finally{setBusy(false)}
  };
  return <div className="staff-auth-shell">
   <div className="staff-auth-card">
    <button type="button" className="staff-auth-back" onClick={onBack}><ArrowRight size={17}/> العودة للمذاكرة</button>
    <img src="/hsa-logo.svg" className="staff-auth-logo brand-logo-auth" alt="شعار HSA 4 Study"/>
    <div className="staff-auth-eyebrow"><ShieldCheck size={16}/> بوابة إدارة المنصة</div>
    <h1>دخول المشرفين وهيئة التدريس</h1>
    <p>تسجيل الدخول مخصّص للمشرفين وأعضاء هيئة التدريس. الدراسة متاحة للجميع دون حساب.</p>
    <form className="form-stack" onSubmit={submit}>
     <label>اسم المستخدم<input type="text" required minLength={3} maxLength={24}
      autoComplete="username" dir="ltr" placeholder="اسم المستخدم"
      value={username} onChange={e=>setUsername(e.target.value)}/></label>
     <label>كلمة المرور<div className="staff-password-input">
      <input type={showPassword?'text':'password'} required autoComplete="current-password"
       dir="ltr" value={password} onChange={e=>setPassword(e.target.value)}
       placeholder="كلمة المرور"/>
      <button type="button" onClick={()=>setShowPassword(x=>!x)}
       aria-label={showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button>
     </div></label>
     {message&&<div className="inline-alert" role="alert">{message}</div>}
     <button className="primary-btn wide" disabled={busy}>{busy&&<LoaderCircle className="spin" size={17}/>}<ShieldCheck size={17}/> دخول الموظفين</button>
    </form>
    <div className="staff-auth-note"><Info size={16}/> إنشاء الحسابات وإدارة الصلاحيات من لوحة المشرفين فقط.</div>
   </div>
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
  const [ownerAccess,setOwnerAccess] = useState(false);
  const [profile,setProfile] = useState(null);
  const [demo,setDemo] = useState(!configured);
  const [staffLogin,setStaffLogin] = useState(false);
  const [booting,setBooting] = useState(configured);
  const [library,setLibrary] = useState(configured ? emptyData() : structuredClone(sample));
  const [subjectId,setSubjectId] = useState(configured ? null : 'demo-subject');
  const [lessonId,setLessonId] = useState(configured ? null : 'demo-lesson');
  const [screen,setScreen] = useState('home');
  const [siteSettings,setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [siteSettingsError,setSiteSettingsError] = useState('');
  const [drawer,setDrawer] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed] = useState(()=>localStorage.getItem('hsa-sidebar-collapsed')==='true');
  const [search,setSearch] = useState('');
  const [theme,setTheme] = useState(() => localStorage.getItem('kaada-study-theme') || 'light');
  const [mode,setMode] = useState('both');
  const [track,setTrack] = useState('mixed');
  const [purpose,setPurpose] = useState('read');
  const [explainMode,setExplainMode] = useState('ar');
  const [speed,setSpeed] = useState(1);
  const [continueListening,setContinueListening] = useState(()=>localStorage.getItem('kaada-continue-listening')!=='false');
  const [speakingLanguage,setSpeakingLanguage] = useState('');
  const [previewingVoice,setPreviewingVoice] = useState('');
  const [listeningVolume,setListeningVolume] = useState(()=>{const saved=Number(localStorage.getItem('kaada-listening-volume'));return saved>=0.2&&saved<=1?saved:1});
  const [recordingUrl,setRecordingUrl] = useState('');
  const [installedVoices,setInstalledVoices] = useState([]);
  const [voiceAssignments,setVoiceAssignments] = useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(FIXED_VOICE_CATALOG_KEY)||'{}');
      return saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
    }catch{return {}}
  });
  // The failed neural-model experiment saved piper: ids in browser storage.
  // Only browser-provided SpeechSynthesis voices are valid again.
  const [selectedArVoice,setSelectedArVoice] = useState(()=>{
    const saved=localStorage.getItem('kaada-device-ar')||'';
    return /^piper:|saba|sabah|سبا|صبا/i.test(saved)?'':saved;
  });
  const [selectedEnVoice,setSelectedEnVoice] = useState(()=>{
    const saved=localStorage.getItem('kaada-device-en')||'';
    return /^piper:/i.test(saved)?'':saved;
  });
  const [sectionIndex,setSectionIndex] = useState(0);
  const [dialog,setDialog] = useState('');
  const [subjectTitle,setSubjectTitle] = useState('');
  const [subjectDescription,setSubjectDescription] = useState('');
  const [editingSubjectId,setEditingSubjectId] = useState(null);
  const [editingLessonTitle,setEditingLessonTitle] = useState('');
  const [importWarnings,setImportWarnings] = useState([]);
  const [aiReadiness,setAiReadiness] = useState({checked:false,ready:false,message:''});
  const [autoProgress,setAutoProgress] = useState(null);
  const [bulkReplaceTranslation,setBulkReplaceTranslation] = useState(false);
  const [bulkIncludeExplanations,setBulkIncludeExplanations] = useState(false);
  const [translationApproved,setTranslationApproved] = useState(false);
  const [translationWarnings,setTranslationWarnings] = useState([]);
  const [draft,setDraft] = useState(null);
  const [editDraft,setEditDraft] = useState({});
  const [generatedDraft,setGeneratedDraft] = useState(false);
  const [consent,setConsent] = useState(false);
  const [studyLevel,setStudyLevel] = useState('intermediate');
  const [saving,setSaving] = useState(false);
  const [processing,setProcessing] = useState(false);
  const [playing,setPlaying] = useState(false);
  const [paused,setPaused] = useState(false);
  const [error,setError] = useState('');
  const [notification,setNotification] = useState('');
  const cancelSpeech = useRef(null);
  const playbackRunRef=useRef(0);
  const recordingRef=useRef(null);
  const generationJobRef=useRef(0);
  const manuallyEditedRef=useRef(new Set());

  useEffect(()=>{
    localStorage.setItem('kaada-device-ar',selectedArVoice);
    localStorage.setItem('kaada-device-en',selectedEnVoice);
    localStorage.setItem('kaada-continue-listening',String(continueListening));
    localStorage.setItem('kaada-listening-volume',String(listeningVolume));
  },[selectedArVoice,selectedEnVoice,continueListening,listeningVolume]);
  useEffect(()=>{
    // Never expose localService=true or unknown voices from this browser.
    if(!('speechSynthesis' in window))return;
    const update=()=>setInstalledVoices(getAvailableVoices());
    update();
    window.speechSynthesis.addEventListener?.('voiceschanged',update);
    window.addEventListener(ONLINE_VOICE_UNAVAILABLE_EVENT,update);
    window.addEventListener('online',update);
    return()=>{
      window.speechSynthesis.removeEventListener?.('voiceschanged',update);
      window.removeEventListener(ONLINE_VOICE_UNAVAILABLE_EVENT,update);
      window.removeEventListener('online',update);
    };
  },[]);
  useEffect(()=>{
    // Delete ONLY old HSA Piper voice downloads; preserve all lessons and
    // other offline PWA data without requiring any UI interaction.
    void cleanupRetiredVoiceDownloads();
  },[]);
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    localStorage.setItem('kaada-study-theme',theme);
  },[theme]);

  useEffect(()=>{
    if(!configured) return;
    let mounted=true;
    // Never leave public study pages behind an indefinite Supabase auth lock.
    // If the network or browser storage is unavailable, visitors still reach
    // the library safely; staff permissions remain ungranted until verified.
    const bootstrapTimeout=setTimeout(()=>{
      if(mounted)setBooting(false);
    },5000);
    if(navigator.onLine===false)setBooting(false);
    supabase.auth.getSession().then(async({data})=>{
      if(!mounted)return;
      if(navigator.onLine===false){
       setSession(data?.session?.user||null);
       setBooting(false);
       return;
      }
      try{
       const result=await supabase.auth.getUser();
       const safeUser=result.error&&isOfflineNetworkError(result.error)
        ?data?.session?.user:null;
       if(mounted){setSession(safeUser||result.data?.user||null);setBooting(false)}
      }catch{
       if(mounted){setSession(data?.session?.user||null);setBooting(false)}
      }
    }).catch(()=>{if(mounted)setBooting(false)});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,current)=>{
      if(!mounted)return;
      if(current?.user){setSession(current.user);setDemo(false)}
      else setSession(null);
    });
    return ()=>{mounted=false;clearTimeout(bootstrapTimeout);subscription.unsubscribe()};
  },[]);

  const isAdmin=Boolean(session)&&role==='admin'&&!demo;
  const isTeacher=Boolean(session)&&role==='teacher'&&!demo;
  const isStaff=isAdmin||isTeacher;
  const canReview=isStaff;
  const isSiteOwner=isAdmin&&ownerAccess;
  const publicPages=siteSettings.publicPages;
  const publicAllowed=page=>isStaff||publicPages.includes(page);
  useEffect(()=>{
    // Direct navigation and stale saved state must never expose hidden staff screens to visitors.
    if(isStaff)return;
    if(['site-settings','accounts','my-account'].includes(screen)||
       (['home','reader','about'].includes(screen)&&!publicPages.includes(screen))){
      setScreen(siteSettings.homePage);
    }
  },[screen,isStaff,publicPages,siteSettings.homePage]);
  useEffect(()=>{
    if(!session?.id||demo){setRole('user');return;}
    let active=true;
    api.loadMyRole(session.id).then(next=>{if(active){setRole(next);if(!['admin','teacher'].includes(next))void supabase.auth.signOut();}}).catch(e=>{if(active)setError(shortError(e))});
    return()=>{active=false};
  },[session?.id,demo]);
  useEffect(()=>{
    if(!session?.id||!isAdmin){setOwnerAccess(false);return;}
    let active=true;
    setOwnerAccess(false);
    isCurrentSiteOwner().then(value=>{if(active)setOwnerAccess(value)})
      .catch(()=>{if(active)setOwnerAccess(false)});
    return ()=>{active=false};
  },[session?.id,isAdmin]);
  useEffect(()=>{
    if(!session?.id||demo){setProfile(null);return;}
    let active=true;
    getMyProfile(session.id).then(next=>{
     if(active){setProfile(next);void saveOfflineSnapshot('profile:'+session.id,next).catch(()=>{})}
    }).catch(async e=>{
     const cached=await readOfflineSnapshot('profile:'+session.id).catch(()=>null);
     if(active&&cached)setProfile(cached);
     else if(active&&navigator.onLine!==false)setError(shortError(e));
    });
    return()=>{active=false};
  },[session?.id,demo]);

  const refresh = async()=>{
    if(demo||!configured)return;
    const next = await api.loadLibrary({includePrivate:isStaff,userId:session?.id});
    next.progress=readDeviceProgress();
    setLibrary(next);
    setSubjectId(current=>next.subjects.some(s=>s.id===current)?current:next.subjects[0]?.id||null);
    setLessonId(current=>next.lessons.some(l=>l.id===current)?current:next.lessons[0]?.id||null);
    return next;
  };
  useEffect(()=>{if(!demo&&configured)refresh().catch(e=>setError(shortError(e)))},[session?.id,demo,isStaff]);
  useEffect(()=>{
   // Warm every authorised, actively displayed dataset while online. An
   // administrator should not have to visit each screen before disconnecting.
   if(!isStaff||!session?.id||demo||navigator.onLine===false)return;
   const tasks=[
    getMyProfile(session.id),
    loadSiteEditPermissions(),
   ];
   if(isAdmin)tasks.push(listAccountsWithCache(session.id));
   void Promise.allSettled(tasks);
  },[session?.id,isStaff,isAdmin,demo]);
  useEffect(()=>{
    if(demo||!configured)return undefined;
    let active=true;
    const reconnect=async()=>{
      if(!active)return;
      try{
       await refresh();
       const pending=await listOfflineEdits(session?.id);
       if(!pending.some(item=>item.entity==='site_settings')){
        const saved=await loadSiteSettings();
        if(active)setSiteSettings(saved);
       }
      }catch(error){
       if(active)setError('تعذّر تحديث المكتبة بعد عودة الإنترنت: '+shortError(error));
      }
    };
    window.addEventListener('online',reconnect);
    return()=>{active=false;window.removeEventListener('online',reconnect)};
  },[session?.id,isStaff,demo]);

  useEffect(()=>{ if(notification){const timer=setTimeout(()=>setNotification(''),4700);return()=>clearTimeout(timer)} },[notification]);
  useEffect(()=>{ if(error){const timer=setTimeout(()=>setError(''),7500);return()=>clearTimeout(timer)} },[error]);

  useEffect(()=>{document.title=siteSettings.siteName+' — المنصة التعليمية'},[siteSettings.siteName]);
  useEffect(()=>{
    if(navigator.onLine===false||!('caches' in window))return;
    let cancelled=false;
    const prefetch=async()=>{
      try{
        const cache=await caches.open('hsa-public-images-v1');
        for(const person of siteSettings.team||[]){
          if(cancelled)return;
          const url=teamAvatarPublicUrl(person.avatarPath);
          if(!url||await cache.match(url))continue;
          const response=await fetch(url,{mode:'cors'});
          if(response.ok)await cache.put(url,response).catch(()=>{});
        }
      }catch{/* Image cache is optional; educational text remains the priority. */}
    };
    void prefetch();
    return()=>{cancelled=true};
  },[siteSettings.team]);

  useEffect(()=>{localStorage.setItem('hsa-sidebar-collapsed',String(sidebarCollapsed))},[sidebarCollapsed]);
  useEffect(()=>{
    const onSearchKey=event=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey||event.shiftKey||event.key.toLowerCase()!=='f'||event.isComposing)return;
      if(staffLogin||document.querySelector('.team-image-lightbox-backdrop')||(dialog&&dialog!=='global-search'))return;
      event.preventDefault();
      if(dialog==='global-search'){
       document.querySelector('.global-search-modal-body input[aria-label="ابحث في محتوى الدروس"]')?.focus();
       return;
      }
      if(screen==='site-settings'&&isAdmin){
       const input=document.querySelector('input[aria-label="بحث سريع في إعدادات الموقع"]');
       if(input){input.scrollIntoView({behavior:'smooth',block:'center'});input.focus();input.select();return;}
      }
      setDialog('global-search');
    };
    document.addEventListener('keydown',onSearchKey);
    return()=>document.removeEventListener('keydown',onSearchKey);
  },[screen,dialog,staffLogin,isAdmin]);
  useEffect(()=>{
    if(dialog!=='global-search')return undefined;
    const onEscape=e=>{if(e.key==='Escape'){e.preventDefault();setDialog('')}};
    document.addEventListener('keydown',onEscape);
    return()=>document.removeEventListener('keydown',onEscape);
  },[dialog]);
  useEffect(()=>{
    let alive=true;
    loadSiteSettings().then(settings=>{if(alive){setSiteSettings(settings);setSiteSettingsError('');setScreen(current=>current==='home'?settings.homePage:current)}})
      .catch(error=>{if(alive)setSiteSettingsError(
       navigator.onLine===false?'إعدادات المنصة غير محفوظة على هذا الجهاز بعد؛ اتصل بالإنترنت لتحميلها.':
       'تعذّر تحميل الإعدادات: '+shortError(error)
      )});
    return()=>{alive=false};
  },[session?.id]);

  const subjects = library.subjects.filter(s=>!search||s.title.toLowerCase().includes(search.toLowerCase()));
  const lessons = library.lessons.filter(l=>l.subject_id===subjectId&&(!search||l.title.toLowerCase().includes(search.toLowerCase())));
  const activeLesson = library.lessons.find(x=>x.id===lessonId);
  const activeSections = useMemo(()=>library.sections.filter(s=>s.lesson_id===lessonId).sort((a,b)=>a.position-b.position),[library.sections,lessonId]);
  useEffect(()=>{
    if((!['import','generate-lesson','generate'].includes(dialog)&&screen!=='reader')||demo||!isAdmin)return;
    let active=true;
    setAiReadiness({checked:false,ready:false,message:'جارٍ فحص خدمة الشرح الذكي...'});
    api.getGeneratorStatus().then(status=>{
      if(active)setAiReadiness({checked:true,...status});
    }).catch(()=>{if(active)setAiReadiness({checked:true,ready:false,message:'تعذر التحقق من خدمة الشرح.'})});
    return()=>{active=false};
  },[dialog,demo,screen]);

  const importPreview=useMemo(()=>{
    if(!draft?.text?.trim())return [];
    return draft.autoChapters?detectChapters(draft.text,draft.title):[{title:draft.title||'درس',sections:splitIntoSections(draft.text)}];
  },[draft?.text,draft?.title,draft?.autoChapters]);
  const current = activeSections[sectionIndex];
  const originalLanguage = sourceLanguage(current?.content_en || '');
  const currentRecordedPath=purpose==='explain'&&!demo&&session?current?.[{mixed:'audio_mixed_path',en:'audio_en_path',ar:'audio_ar_path'}[track]]:null;
  useEffect(()=>{
    recordingRef.current?.pause();
    setRecordingUrl(previous=>{
      if(previous?.startsWith?.('blob:'))URL.revokeObjectURL(previous);
      return '';
    });
  },[current?.id,track,purpose]);
  const speechContent = speechParts(current, track, purpose);

  const pairedExplanationReady=Boolean(current?.explanation_en?.trim()&&current?.explanation_ar?.trim());
  const explanationText = explainMode==='ar' ? current?.explanation_ar
    : explainMode==='en' ? current?.explanation_en
    : pairedExplanationReady ? current?.explanation_en+'\n'+current?.explanation_ar : '';
  // If the visitor's chosen starting page is the reader, open the first available lesson.
  useEffect(()=>{
    if(screen==='reader'&&!activeLesson&&library.lessons.length)setLessonId(library.lessons[0].id);
  },[screen,activeLesson,library.lessons]);
  const percentage = activeSections.length ? Math.round(((sectionIndex+1)/activeSections.length)*100) : 0;
  const reviewed = library.progress.length;
  const notify = s=>setNotification(s);
  const stop = () => {
    playbackRunRef.current+=1;
    cancelSpeech.current?.(); cancelSpeech.current=null;stopSpeech();
    if(recordingRef.current){recordingRef.current.pause();recordingRef.current.currentTime=0;}
    setPlaying(false);setPaused(false);setSpeakingLanguage('');setPreviewingVoice('');
  };
  useEffect(()=>()=>{stopSpeech()},[]);
  useEffect(()=>{
    if(screen!=='reader')stop();
  },[screen]);

  const saveLocation=(lesson,section,lang=track,r=speed)=>{
    if(!lesson||!section||demo)return;
    const progress=writeDeviceProgress(lesson,section,lang,r);
    setLibrary(prev=>({...prev,progress}));
  };
  const openLesson = (id, targetSectionId=null) => {
    stop();
    const item=library.lessons.find(l=>l.id===id);
    const p=library.progress.find(p=>p.lesson_id===id);
    const list=library.sections.filter(s=>s.lesson_id===id).sort((a,b)=>a.position-b.position);
    setLessonId(id);setSubjectId(item?.subject_id||subjectId);
    // A search hit overrides device resume and opens its exact matching paragraph.
    const targetIndex=targetSectionId?list.findIndex(section=>section.id===targetSectionId):-1;
    const resumeIndex=targetIndex>=0?targetIndex:Math.max(0,list.findIndex(s=>s.id===p?.section_id));
    setSectionIndex(resumeIndex);
    const resumed=list[resumeIndex];
    const preferred=p?.audio_track||'mixed';
    setTrack(speechParts(resumed,preferred,'read').length?preferred:(sourceLanguage(resumed?.content_en)==='ar'?'ar':'en'));
    setPurpose('read');
    setSpeed(Number(p?.speed||1));
    // Opening the lesson counts as starting it, even before navigating to another paragraph.
    if(resumed?.id&&!demo){
      const progress=writeDeviceProgress(id,resumed.id,preferred,Number(p?.speed||1));
      setLibrary(prev=>({...prev,progress}));
    }
    setScreen('reader');setDrawer(false);
  };
  const changeSection = i => {
    if(i<0||i>=activeSections.length)return;
    stop();setSectionIndex(i);saveLocation(lessonId,activeSections[i]?.id);
  };
  // Voice labels and their first matched native speaker are stable in this browser.
  // Adding a new system voice never changes an already-assigned KAADA alias.
  const lockedVoices=useMemo(()=>lockVoiceCatalog(installedVoices,voiceAssignments),[installedVoices,voiceAssignments]);
  const arVoiceGroups=lockedVoices.groups.ar;
  const enVoiceGroups=lockedVoices.groups.en;
  useEffect(()=>{
    if(JSON.stringify(lockedVoices.assignments)!==JSON.stringify(voiceAssignments)){
      setVoiceAssignments(lockedVoices.assignments);
    }
  },[lockedVoices,voiceAssignments]);
  useEffect(()=>{
    try{localStorage.setItem(FIXED_VOICE_CATALOG_KEY,JSON.stringify(voiceAssignments))}catch{/* Private browser storage disabled */}
  },[voiceAssignments]);
  const listedVoices=groups=>[...groups.female,...groups.male].filter(Boolean);
  const arChoices=listedVoices(arVoiceGroups);
  const enChoices=listedVoices(enVoiceGroups);
  // No locally installed voices and no fake aliases: the saved value must
  // match a real currently exposed online provider voice.
  const hasInstalledVoice=(name,language)=>installedVoices.some(v=>
    v.localService===false&&v.name===name
    &&v.lang?.toLowerCase().startsWith(language));
  const firstOnline=lang=>installedVoices.find(v=>
    v.localService===false&&v.lang?.toLowerCase().startsWith(lang))?.name||'';
  const effectiveArVoice=hasInstalledVoice(selectedArVoice,'ar')
    ?selectedArVoice:(arChoices[0]?.id||firstOnline('ar'));
  const effectiveEnVoice=hasInstalledVoice(selectedEnVoice,'en')
    ?selectedEnVoice:(enChoices[0]?.id||firstOnline('en'));
  useEffect(()=>{
    // A missing, duplicate or local old speaker must never leave Play
    // permanently disabled. Move the selection only to a real online voice.
    if(effectiveArVoice&&selectedArVoice!==effectiveArVoice)setSelectedArVoice(effectiveArVoice);
    if(effectiveEnVoice&&selectedEnVoice!==effectiveEnVoice)setSelectedEnVoice(effectiveEnVoice);
  },[selectedArVoice,selectedEnVoice,effectiveArVoice,effectiveEnVoice]);
  const onlineVoiceMissing=navigator.onLine===false||speechContent.some(part=>{
    const lang=part.lang.slice(0,2);
    return lang==='ar'?!effectiveArVoice:lang==='en'?!effectiveEnVoice:true;
  });
  const canPlayAudio=!onlineVoiceMissing&&Boolean(speechContent.length);

  const play = async(targetTrack=track,targetPurpose=purpose)=>{
    if(!current)return;
    const changed=targetTrack!==track||targetPurpose!==purpose;
    if(playing&&!changed){
      pauseSpeech();
      setPaused(true);setPlaying(false);return;
    }
    if(paused&&!changed){
      resumeSpeech();
      setPaused(false);setPlaying(true);return;
    }
    const plan=lessonPlaybackPlan(activeSections,sectionIndex,targetTrack,targetPurpose,continueListening);
    if(!plan.queue.length){
      const number=(plan.stopAt??sectionIndex)+1;
      setError(targetTrack==='mixed'
        ? 'الفقرة '+number+' تحتاج النسختين الإنجليزية والعربية '+(targetPurpose==='explain'?'للشرح':'للقراءة')+' قبل بدء الاستماع المزدوج.'
        : 'لا يوجد نص '+(targetPurpose==='explain'?'للشرح':'للقراءة')+' بهذه اللغة في الفقرة '+number+'.');
      return;
    }
    stop();
    if(changed){setTrack(targetTrack);setPurpose(targetPurpose)}
    const runId=playbackRunRef.current;
    const names={ar:effectiveArVoice,en:effectiveEnVoice};
    const runSection=(at)=>{
      if(runId!==playbackRunRef.current)return;
      if(at>=plan.queue.length){
        setPlaying(false);setPaused(false);setSpeakingLanguage('');
        if(plan.stopAt!==null)setError('توقف الاستماع عند الفقرة '+(plan.stopAt+1)+' لأنها لا تحتوي على النص الإنجليزي والعربي المتطابقين. راجع ترجمتها ثم أكمل.');
        else notify('اكتمل الاستماع إلى '+plan.queue.length+' فقرة.');
        return;
      }
      const item=plan.queue[at];
      setSectionIndex(item.sectionIndex);
      void saveLocation(lessonId,item.sectionId,targetTrack,speed);
      cancelSpeech.current=speakParts(item.parts,speed,
        ()=>{if(runId===playbackRunRef.current){setPlaying(true);setPaused(false)}},
        ()=>{if(runId===playbackRunRef.current)runSection(at+1)},
        msg=>{if(runId!==playbackRunRef.current)return;setPlaying(false);setPaused(false);setSpeakingLanguage('');setError(msg)},
        names,
        chunk=>{if(runId===playbackRunRef.current)setSpeakingLanguage(chunk.lang.startsWith('ar')?'ar':'en')},listeningVolume
      );
    };
    runSection(0);
  };
  const previewVoice=(language,name)=>{
    const key=language+':'+name;
    if(previewingVoice===key){stop();return;}
    stop();
    const runId=playbackRunRef.current;
    setPreviewingVoice(key);
    const example=language==='ar'
      ?'مرحبًا بك في كادا. هنا تبدأ رحلة تعليمية واضحة وسهلة.'
      :'Welcome to HSA 4 Study. Your next learning journey starts right here.';
    cancelSpeech.current=speakParts([{lang:language==='ar'?'ar-SA':'en-US',text:example}],
      .94,()=>{},()=>{if(runId===playbackRunRef.current)setPreviewingVoice('')},
      message=>{if(runId===playbackRunRef.current){setPreviewingVoice('');setError(message)}},
      {[language]:name},undefined,listeningVolume);
  };
  const loadRecording=async()=>{
    if(!currentRecordedPath)return;
    stop();
    setRecordingUrl('');
    const id=playbackRunRef.current;
    try{
      const url=await api.signedAudioUrl(currentRecordedPath,session?.id);
      if(id===playbackRunRef.current)setRecordingUrl(url);
    }catch(err){if(id===playbackRunRef.current)setError(shortError(err))}
  };
  const setAudioTrack=value=>{
    stop();setTrack(value);
    if(current)void saveLocation(lessonId,current.id,value,speed);
  };
  const setListenPurpose=value=>{stop();setPurpose(value)};
  const setAudioSpeed=value=>{
    const n=Number(value);if(!Number.isFinite(n))return;
    stop();setSpeed(n);
    if(current)void saveLocation(lessonId,current.id,track,n);
  };

  const createSubject = async e=>{
    e.preventDefault();
    if(!isAdmin)return setError('إدارة المواد متاحة للمشرف فقط.');
    if(!subjectTitle.trim())return;
    setSaving(true);
    try {
      let queued=false;
      let subject;
      if(demo)subject={id:makeId(),title:subjectTitle.trim(),description:subjectDescription.trim()};
      else if(navigator.onLine===false){
       subject={id:crypto.randomUUID(),title:subjectTitle.trim(),description:subjectDescription.trim()};
       await queueOfflineEdit({userId:session.id,entity:'subjects:create',recordId:subject.id,
        patch:{title:subject.title,description:subject.description},base:{}});
       queued=true;
      }else subject=await api.addSubject(subjectTitle.trim(),subjectDescription.trim());
      if(demo||queued)setLibrary(prev=>({...prev,subjects:[...prev.subjects,{...subject,offline_pending:queued}]}));
      else await refresh();
      setSubjectId(subject.id);setSubjectTitle('');setSubjectDescription('');setDialog('');setScreen('home');
      notify(queued?'تم حفظ المادة محليًا، وستُضاف إلى قاعدة البيانات بعد عودة الاتصال.':'تمت إضافة المادة بنجاح.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const startSubjectEdit=(item)=>{
    if(!canReview)return;
    setEditingSubjectId(item.id);setSubjectTitle(item.title);setSubjectDescription(item.description||'');setDialog('subject-edit');
  };
  const updateSubject = async e=>{
    e.preventDefault();if(!canReview||!editingSubjectId)return;
    setSaving(true);
    try{
      const patch={title:subjectTitle.trim(),description:subjectDescription.trim()};
      const base=library.subjects.find(x=>x.id===editingSubjectId);
      const result=demo?{status:'applied'}:await saveOrQueueEdit({
       userId:session?.id,entity:'subjects',recordId:editingSubjectId,patch,base,
       send:()=>api.updateSubject(editingSubjectId,patch)
      });
      if(result.status==='queued')setLibrary(prev=>({...prev,subjects:prev.subjects.map(x=>
       x.id===editingSubjectId?{...x,...patch,offline_pending:true}:x)}));
      else if(!demo)await refresh();
      setDialog('');notify(result.status==='queued'?'تم حفظ تعديل المادة على هذا الجهاز وبانتظار المزامنة.':'تم تعديل المادة.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const deleteSubject = async()=>{
    if(!isAdmin||!subjectId)return;
    if(navigator.onLine===false)return setError('حذف المواد يحتاج اتصالًا بالخادم حتى لا تُفقد البيانات أو تتعارض التعديلات.');
    const count=library.lessons.filter(l=>l.subject_id===subjectId).length;
    if(!window.confirm('هل تريد حذف هذه المادة و'+count+' من دروسها وفقراتها نهائيًا؟ لا يمكن التراجع.'))return;
    setSaving(true);
    try{await api.deleteSubject(subjectId);setSubjectId(null);setLessonId(null);
      await refresh();notify('حُذفت المادة ودروسها من المكتبة.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const renameLesson=async e=>{
    e.preventDefault();if(!canReview||!activeLesson)return;
    setSaving(true);try{
      const patch={title:editingLessonTitle.trim()};
      const result=await saveOrQueueEdit({userId:session?.id,entity:'lessons',
       recordId:activeLesson.id,patch,base:activeLesson,
       send:()=>api.updateLesson(activeLesson.id,editingLessonTitle)});
      if(result.status==='queued')setLibrary(prev=>({...prev,lessons:prev.lessons.map(x=>
       x.id===activeLesson.id?{...x,...patch,offline_pending:true}:x)}));
      else await refresh();
      setDialog('');notify(result.status==='queued'?'تم حفظ عنوان الدرس محليًا بانتظار المزامنة.':'تم تعديل اسم الدرس.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const deleteLesson=async()=>{
    if(!isAdmin||!activeLesson)return;
    if(navigator.onLine===false)return setError('حذف الدروس يحتاج اتصالًا بالخادم.');
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
      setDraft({file,title:file.name.replace(/\.[^.]+$/,''),text:extracted,autoChapters:true,autoTranslate:true,autoExplain:true,aiConsent:false,subject_id:subjectId||library.subjects[0]?.id});
      setImportWarnings(extracted.length<80?['النص المستخرج قصير. قد يحتوي الملف على صور أو صفحات ممسوحة لا تقرؤها هذه الأداة.']:[]);
      setDialog('import');
    }catch(err){setError(shortError(err))}finally{setSaving(false)}
  };
  const automaticallyGenerateCourse = async(lessonIds,level,options={translate:true,explain:true,replace:false})=>{
    const jobId=++generationJobRef.current;
    const failures=[];
    let done=0,total=0,phase='translation';
    // Do not make hundreds of requests at once; the model provider has rate limits.
    const rest=()=>new Promise(resolve=>setTimeout(resolve,6100));
    const reflect=(id,changes)=>setLibrary(prev=>({
      ...prev,sections:prev.sections.map(s=>s.id===id?{...s,...changes}:s),
    }));
    const showProgress=()=>setAutoProgress({status:'running',done,total,phase,failures:failures.length});
    const limited=err=>/429|quota|credit|الرصيد|حد استخدام|rate.?limit/i.test(shortError(err));
    try{
      const sections=await api.getNewSections(lessonIds);
      total=sections.length;
      if(total>500)throw Error('الحد الأقصى للمعالجة التلقائية 500 مقطع. قسّم الدرس إلى أجزاء أصغر.');
      // Pass 1: translate ALL source passages. Never begin explanations while
      // any English passage lacks its matching Arabic translation.
      showProgress();
      for(const section of sections){
        if(jobId!==generationJobRef.current)return;
        try{
          const isArabicSource=sourceLanguage(section.content_en)==='ar';
          const shouldTranslate=options.translate&&!isArabicSource
            && !section.translation_reviewed_at
            && (!section.content_ar?.trim()||options.replace===true)
            && !manuallyEditedRef.current.has(section.id);
          if(shouldTranslate){
            const translated=await api.translateSection(section.id);
            if(jobId!==generationJobRef.current)return;
            if(!translated.auto_save)throw Error('تحتاج الترجمة إلى مراجعة بشرية قبل اعتماد هذا المقطع.');
            if(!manuallyEditedRef.current.has(section.id)){
              const changes=synchronizedSectionUpdate(section,{content_ar:translated.translation});
              const saved={...changes,translated_at:new Date().toISOString(),translation_reviewed_at:null};
              await api.saveSection(section.id,saved);
              Object.assign(section,saved);
              reflect(section.id,saved);
              await rest();
            }
          }
          if(!isArabicSource&&!section.content_ar?.trim()){
            throw Error('لم تُجهّز الترجمة العربية المطابقة لهذا المقطع بعد.');
          }
        }catch(err){
          failures.push({section:done+1,phase,reason:shortError(err)});
          if(limited(err)){done++;showProgress();break;}
        }
        done++;showProgress();
      }
      if(jobId!==generationJobRef.current)return;
      if(failures.length||done<total){
        await refresh();
        setAutoProgress({status:'partial',done,total,phase,failures});
        notify('لم تكتمل ترجمة جميع المقاطع؛ توقف إعداد الشرح حتى تكتمل الترجمات المتطابقة. يمكنك إعادة المحاولة من الدرس.');
        return;
      }
      // Pass 2: prepare bilingual explanations only after the entire lesson
      // has its English/Arabic text pairs. The original translation is never
      // replaced by the separate explanatory model.
      if(options.explain){
        phase='explanation';done=0;showProgress();
        for(const section of sections){
          if(jobId!==generationJobRef.current)return;
          try{
            const shouldExplain=!manuallyEditedRef.current.has(section.id)
              && !section.reviewed_at
              && !(section.processed_at&&section.explanation_ar?.trim()&&section.explanation_en?.trim());
            if(shouldExplain){
              const generated=await api.generateTranslation(section.id,level);
              if(jobId!==generationJobRef.current)return;
              if(!manuallyEditedRef.current.has(section.id)){
                const {content_ar:_notTheSourceTranslation,...explanation}=generated;
                const updated=synchronizedSectionUpdate(section,explanation);
                const saved={...updated,processed_at:new Date().toISOString(),reviewed_at:null};
                await api.saveSection(section.id,saved);
                Object.assign(section,saved);
                reflect(section.id,saved);
                await rest();
              }
            }
          }catch(err){
            failures.push({section:done+1,phase,reason:shortError(err)});
            if(limited(err)){done++;showProgress();break;}
          }
          done++;showProgress();
        }
      }
      if(jobId!==generationJobRef.current)return;
      await refresh();
      const complete=!failures.length&&done===total;
      setAutoProgress({status:complete?'done':'partial',done,total,phase,failures});
      notify(complete
        ? 'اكتملت الترجمة العربية للمقاطع ثم الشروح الثنائية. القراءة المدمجة: إنجليزي ثم عربي لنفس المقطع.'
        : 'الترجمات محفوظة، لكن بعض الشروح لم تكتمل. أعد المحاولة لإكمال الناقص.');
    }catch(err){
      if(jobId===generationJobRef.current){
        setAutoProgress({status:'error',done,total,phase,error:shortError(err),failures});
        setError('تعذرت المعالجة التلقائية: '+shortError(err));
      }
    }
  };
  const saveImport = async()=>{
    if(!isAdmin)return setError('الاستيراد متاح للمشرف فقط.');
    if(navigator.onLine===false)return setError(
     'تقدر تستخرج نص الملف محليًا، لكن نشر درس جديد ورفع ملفه الأصلي يحتاج الاتصال بالخادم. احتفظ بالملف حتى يعود الإنترنت.'
    );
    if(!draft?.title.trim()||!draft.subject_id)return setError('أضف مادة أولًا وحدد عنوانًا للدرس.');
    const chapters=importPreview;
    const count=chapters.reduce((sum,chapter)=>sum+chapter.sections.length,0);
    if(count>500)return setError('المادة تحتوي '+count+' فقرة. قسّمها إلى ملفات أصغر قبل الاستيراد، حتى لا يُفقد أي نص.');
    if(draft.text.length>800000)return setError('الملف كبير جدًا من حيث النص. يُفضّل استيراد فصل واحد في كل مرة.');
    if(!chapters.length || !chapters.some(chapter=>chapter.sections.length))return setError('لا توجد فقرات قابلة للحفظ.');
    if(!demo&&aiReadiness.ready&&(draft.autoTranslate||draft.autoExplain)&&!draft.aiConsent)
      return setError('الترجمة التلقائية تتطلب الموافقة على معالجة النص خارجيًا. فعّل خانة الموافقة مرة واحدة، أو ألغِ الترجمة والشرح التلقائيين لحفظ الملف دون إرساله.');
    const shouldGenerate=Boolean((draft.autoTranslate||draft.autoExplain)&&draft.aiConsent&&aiReadiness.ready&&!demo);
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
      stop();
      setPurpose('read');setTrack(sourceLanguage(chapters[0]?.sections[0])==='ar'?'ar':'mixed');setScreen('reader');
      notify(shouldGenerate
        ? 'حُفظت الدروس بمقاطع قصيرة مترابطة. بدأت ترجمة جميع المقاطع أولًا، ثم سيُجهّز الشرح باللغتين.'
        : 'حُفظت الدروس بمقاطع قصيرة. يمكنك الاستماع إلى النص الأصلي، وتحتاج القراءة المدمجة إلى ترجمة عربية لكل مقطع.');
      if(shouldGenerate) void automaticallyGenerateCourse(createdLessons.map(l=>l.id),studyLevel,{
        translate:draft.autoTranslate!==false,explain:draft.autoExplain!==false,replace:false,
      });
      else if((draft.autoTranslate||draft.autoExplain) && draft.aiConsent && !aiReadiness.ready)
        setAutoProgress({status:'error',done:0,total:count,error:'لم يُولّد الشرح الآلي؛ '+(aiReadiness.message||'خدمة الذكاء الاصطناعي غير مفعّلة.')});
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const translateCurrent = async()=>{
    if(!isAdmin||!current)return;
    if(navigator.onLine===false)return setError('الترجمة الآلية تحتاج الإنترنت؛ عدّل النص والترجمة يدويًا وسيُحفظان محليًا.');
    if(!aiReadiness.ready)return setError('تعذر الاتصال بخدمة الترجمة العلمية.');
    if(!consent)return setError('وافق على إرسال الفقرة لخدمة الترجمة أولًا.');
    setProcessing(true);
    try{
      const {translation,warnings,auto_save}=await api.translateSection(current.id);
      const keys=['content_en','content_ar','explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en'];
      const existing=Object.fromEntries(keys.map(key=>[key,current[key]||'']));
      setEditDraft({...existing,content_ar:translation});
      setTranslationWarnings(auto_save===false?(warnings||[]):[]);
      setTranslationApproved(false);
      setGeneratedDraft(true);
      setDialog('edit');
      notify(auto_save===false?'الترجمة تحتاج مراجعة معادلات وأرقام قبل الحفظ.':'تم إعداد ترجمة عربية جديدة. قارنها بالأصل ثم احفظها بعد المراجعة.');
    }catch(err){setError(shortError(err))}
    finally{setProcessing(false)}
  };
  const editSection = ()=>{
    if(!canReview)return setError('تصحيح النصوص والترجمة متاح لأعضاء هيئة التدريس والمشرفين فقط.');
    if(!current)return;
    const keys=['content_en','content_ar','explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en'];
    setEditDraft(Object.fromEntries(keys.map(k=>[k,current[k]||''])));
    setConsent(false);setGeneratedDraft(false);setTranslationWarnings([]);setTranslationApproved(Boolean(current.translation_reviewed_at));setDialog('edit');
  };
  const saveEdit = async()=>{
    if(!canReview)return setError('لا تملك صلاحية تدقيق المادة.');
    if(!current)return;
    if(translationWarnings.length&&!translationApproved)return setError('هذه الترجمة تحتوي اختلافًا محتملًا في أرقام أو رموز علمية. صححها وقارنها بالمصدر ثم فعّل خانة مراجعة الترجمة قبل الحفظ.');
    setSaving(true);
    try{
      stop();
      if(demo) {
        manuallyEditedRef.current.add(current.id);
        setLibrary(prev=>({...prev,sections:prev.sections.map(s=>s.id===current.id?{...s,...editDraft}:s)}));
      }
      else{
        const sourceChanged=String(editDraft.content_en||'')!==String(current.content_en||'');
        const arChanged=String(editDraft.content_ar||'')!==String(current.content_ar||'');
        const merged={...editDraft};
        // If the original was corrected but the translation wasn't, never keep a stale translation silently.
        if(sourceChanged&&!arChanged&&sourceLanguage(editDraft.content_en)==='en'){
          if(!window.confirm('تم تعديل النص الإنجليزي دون تعديل ترجمته. سيتم إفراغ الترجمة القديمة لتجنب عدم التطابق؛ هل تريد المتابعة؟'))return;
          merged.content_ar='';
        }
        manuallyEditedRef.current.add(current.id);
        const updated=synchronizedSectionUpdate(current,merged);
        if(isTeacher)for(const field of ['audio_ar_path','audio_en_path','audio_mixed_path'])delete updated[field];
        const explanations=['explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en'];
        const explanationChanged=explanations.some(key=>String(merged[key]||'')!==String(current[key]||''));
        const approval={
          ...(sourceChanged?{processed_at:null,reviewed_at:null}:explanationChanged?{
            reviewed_at:new Date().toISOString(),
          }:{})
        };
        const reviewedTranslation=merged.content_ar?.trim()&&translationApproved?new Date().toISOString():null;
        if(arChanged||sourceChanged){
          approval.translated_at=merged.content_ar?.trim()?new Date().toISOString():null;
          approval.translation_reviewed_at=reviewedTranslation;
        }else if(Boolean(current.translation_reviewed_at)!==Boolean(translationApproved)){
          approval.translation_reviewed_at=reviewedTranslation;
        }
        const patch={...updated,...approval};
        // Only record changed fields; the server checks their original values atomically.
        const changed=Object.fromEntries(Object.entries(patch).filter(([key,value])=>
         Object.hasOwn(current,key)&&JSON.stringify(current[key]??null)!==JSON.stringify(value??null)));
        const result=Object.keys(changed).length?
         await saveOrQueueEdit({userId:session?.id,entity:'sections',recordId:current.id,
          patch:changed,base:current,send:()=>api.saveSection(current.id,patch)}):{status:'applied'};
        if(result.status==='queued')setLibrary(prev=>({...prev,sections:prev.sections.map(x=>
         x.id===current.id?{...x,...changed,offline_pending:true}:x)}));
        else await refresh();
        if(result.status==='queued')notify('حُفظت الترجمة والشرح محليًا وستُزامن بعد الاتصال.');
      }
      setGeneratedDraft(false);setTranslationWarnings([]);setDialog('');
      if(navigator.onLine!==false)notify('تم حفظ الترجمة والشرح، ويمكن الآن الاستماع إلى النص المعدّل.');
    }catch(e){setError(shortError(e))}finally{setSaving(false)}
  };
  const processTranslation = async()=>{
    if(!isAdmin)return setError('المشرف فقط يستطيع توليد شرح للمادة المشتركة.');
    if(navigator.onLine===false)return setError('التوليد الذكي يحتاج الإنترنت؛ يمكنك تعديل الشرح يدويًا وحفظه محليًا.');
    if(demo || !configured || !session) {
      setError('التوليد التلقائي يحتاج ربط Supabase وتسجيل الدخول، ثم تفعيل خدمة Netlify AI Gateway. يمكنك كتابة شرحك وتعديله يدويًا الآن.');
      return;
    }
    if(!aiReadiness.ready)return setError('خدمة الشرح العلمي غير متاحة حاليًا. يمكنك تعديل النص يدويًا.');
    if(!consent)return setError('يلزم تأكيد السماح بإرسال هذه الفقرة إلى مزود الذكاء الاصطناعي.');
    if(!current)return;
    setProcessing(true);
    try{
      const result=await api.generateTranslation(current.id,studyLevel);
      let arabicTranslation=current.content_ar?.trim()||'';
      let newTranslationWarnings=[];
      // The academic translation is prepared independently; the teaching explanation
      // model must never supply or overwrite the authoritative translated paragraph.
      if(!arabicTranslation&&sourceLanguage(current.content_en)==='en'){
        const translated=await api.translateSection(current.id);
        arabicTranslation=translated.translation;
        if(!translated.auto_save)newTranslationWarnings=translated.warnings||[];
      }
      const keys=['content_en','content_ar','explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en'];
      const present=Object.fromEntries(keys.map(k=>[k,current[k]||'']));
      setEditDraft({...present,...result,content_ar:arabicTranslation||result.content_ar});
      setTranslationWarnings(newTranslationWarnings);
      setTranslationApproved(Boolean(current.translation_reviewed_at));
      setGeneratedDraft(true);
      setDialog('edit');
      notify('تم إنشاء مسودة بالعربي والإنجليزي. راجعها وعدّلها قبل الضغط على «حفظ الشرح».');
    }catch(e){setError(shortError(e))}
    finally{setProcessing(false)}
  };
  const handleAudioFile = async(e,targetTrack)=>{
    const file=e.target.files?.[0];e.target.value='';
    if(!isAdmin||!file||!current||demo)return;
    if(navigator.onLine===false)return setError('رفع التسجيلات يحتاج اتصالًا بالخادم؛ احتفظ بالملف على جهازك.');
    if(!file.type.startsWith('audio/'))return setError('الملف يجب أن يكون صوتيًا.');
    setSaving(true);
    try{await api.uploadAudio(current,targetTrack,file,session.id);await refresh();notify('تم حفظ الملف الصوتي الخاص بهذا المسار.')}
    catch(err){setError(shortError(err))}finally{setSaving(false)}
  };
  const logout=async()=>{
    generationJobRef.current+=1;stop();
    const oldUserId=session?.id;
    if(configured&&!demo)await supabase.auth.signOut({scope:'local'}).catch(()=>{});
    if(oldUserId)await clearStaffSnapshots(oldUserId).catch(()=>{});
    setSession(null);setRole('user');setProfile(null);setDemo(false);setStaffLogin(false);setScreen(siteSettings.homePage);
  };
  const renderSource=type=>mode==='both'||mode===type;

  if(booting)return <div className="loading-page"><LoaderCircle className="spin" size={36}/><p>جاري تهيئة المنصة...</p></div>;
  if(staffLogin&&!session&&!demo)return <AuthScreen site={siteSettings} onBack={()=>setStaffLogin(false)}/>;

  return <div className={'app-shell'+(sidebarCollapsed?' app-sidebar-minimized':'')}>
    <aside className={'sidebar '+(drawer?'sidebar-open ':'')+(sidebarCollapsed?'sidebar-condensed':'')}>
      <div className="sidebar-head">
        <div className="brand"><img className="brand-logo brand-logo-sidebar"
          src={sidebarCollapsed&&!drawer?'/favicon.svg':'/hsa-logo.svg'}
          width="190" height="118" alt="HSA 4 Study" loading="eager"/></div>
        <button type="button" className="sidebar-collapse-toggle" onClick={()=>setSidebarCollapsed(v=>!v)}
          aria-label={sidebarCollapsed?'فتح القائمة الجانبية':'طي القائمة الجانبية'}
          aria-expanded={!sidebarCollapsed} title={sidebarCollapsed?'فتح القائمة':'طي القائمة'}>
          {sidebarCollapsed?<ChevronLeft size={19}/>:<ChevronRight size={18}/>}
        </button>
        <button className="icon-btn mobile-only" onClick={()=>setDrawer(false)} aria-label="إغلاق القائمة"><X size={20}/></button>
      </div>
      <div className="side-scroll">
        <SidebarNav
          menu={siteSettings.sidebarMenu}
          isAdmin={isAdmin} isStaff={isStaff} publicPages={publicPages} activeLesson={activeLesson}
          library={library} subjectId={subjectId} screen={screen}
          onNavigate={pageId=>{
            if(!publicAllowed(pageId))return;
            if(pageId==='about'||pageId==='site-settings')stop();
            setScreen(pageId);setDrawer(false);
          }}
          onSubject={id=>{setSubjectId(id);setScreen('home');setDrawer(false)}}
          onNewSubject={()=>{setDialog('subject');setDrawer(false)}}
        />
      </div>
      <div className="sidebar-footer">
        <div className="account-card"><AccountAvatar path={isStaff?profile?.avatar_path:''} name={isStaff?profile?.display_name||profile?.username:'زائر المنصة'} size="small"/><div className="account-text"><strong>{isStaff?profile?.display_name||profile?.username:'زائر المنصة'}</strong><span>{isStaff?'@'+(profile?.username||''): 'تقدّمك محفوظ على هذا الجهاز'}</span></div></div>
        {isStaff?<button className="side-nav footer-action" onClick={logout}><LogOut size={18}/> تسجيل الخروج</button>:
         <button className="side-nav footer-action" onClick={()=>{setStaffLogin(true);setDrawer(false)}}><ShieldCheck size={18}/> دخول المشرفين وهيئة التدريس</button>}
      </div>
    </aside>

    {drawer&&<button className="mobile-shade" onClick={()=>setDrawer(false)} aria-label="إغلاق القائمة"/>}
    <div className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-btn mobile-only" onClick={()=>setDrawer(true)} aria-label="فتح القائمة"><Menu size={22}/></button><span className="topbar-crumb">المكتبة الدراسية</span><ChevronLeft size={15} className="crumb-arrow"/><strong>{screen==='reader'?activeLesson?.title||sidebarLabel(siteSettings.sidebarMenu,'reader'):['about','site-settings','accounts','my-account'].includes(screen)?sidebarLabel(siteSettings.sidebarMenu,screen):parentTitle(library,subjectId)}</strong></div>
        <div className="topbar-tools">
          <OfflineSyncCenter userId={isStaff?session?.id:null} library={library}
           onSynced={async()=>{
            await refresh();
            const pending=await listOfflineEdits(session?.id);
            if(!pending.some(item=>item.entity==='site_settings')){
             try{setSiteSettings(await loadSiteSettings())}catch{/* Keep last valid local settings. */}
            }
           }}/>
          <button type="button" className="site-global-search-btn" onClick={()=>{
            if(screen==='site-settings'&&isAdmin){
             const field=document.querySelector('input[aria-label="بحث سريع في إعدادات الموقع"]');
             field?.scrollIntoView({behavior:'smooth',block:'center'});field?.focus();
            }else setDialog('global-search');
          }} aria-label="بحث داخل الموقع" title="البحث داخل الموقع (Ctrl+F)">
           <Search size={18}/><span>بحث</span><kbd>Ctrl F</kbd>
          </button>
          {demo&&<span className="demo-pill"><span className="status-dot"/> وضع تجريبي</span>}
          {isStaff&&<span className={'role-pill '+(isAdmin?'role-admin':'role-teacher')}><ShieldCheck size={14}/>{isAdmin?'مشرف':'عضو هيئة التدريس'}</span>}
          {!isStaff&&configured&&<button type="button" className="staff-entry-btn" onClick={()=>setStaffLogin(true)} aria-label="دخول المشرفين وهيئة التدريس" title="دخول المشرفين وهيئة التدريس"><ShieldCheck size={15}/><span>دخول المشرفين وهيئة التدريس</span></button>}
          <button className="icon-btn" onClick={()=>setTheme(t=>t==='light'?'dark':'light')} aria-label="تغيير المظهر" title="تغيير المظهر">{theme==='light'?<Moon size={19}/>:<Sun size={19}/>}</button>
          {isAdmin&&<button className="top-add" onClick={()=>setDialog('subject')}><Plus size={17}/><span>مادة جديدة</span></button>}
        </div>
      </header>
      <main className="page-content">
        {isAdmin&&screen==='accounts'&&<AccountManager currentUserId={session?.id} isSiteOwner={isSiteOwner} onNotify={notify}
          teamPhotos={siteSettings.team}
          onOwnAccountUpdated={async()=>{if(session?.id)setProfile(await getMyProfile(session.id))}}/>}
        {isStaff&&screen==='my-account'&&<MyAccountSettings profile={profile} role={role} teamPhotos={siteSettings.team} onAvatarUpdated={setProfile}/>}
        {publicAllowed('about')&&screen==='about'&&<AboutPage settings={siteSettings}
          narrationVoice={effectiveArVoice} narrationVoices={arVoiceGroups}
          onNarrationVoiceChange={setSelectedArVoice}
          narrationSpeed={speed} onNarrationSpeedChange={setSpeed}
          narrationVolume={listeningVolume}
          onBack={publicAllowed('home')?()=>setScreen('home'):undefined}
          backLabel="العودة إلى المكتبة"
          onSettings={isAdmin?()=>setScreen('site-settings'):undefined}/>}
        {isAdmin&&screen==='site-settings'&&<><SiteSettingsPage settings={siteSettings} isSiteOwner={isSiteOwner} onSaved={value=>{setSiteSettings(value);setSiteSettingsError('');
         notify(value.__offline_queued?'تم حفظ إعدادات المنصة محليًا، وستُنشر بعد المزامنة.':
          'تم تحديث إعدادات المنصة وصفحة التعريف للجميع.')}} onBack={()=>setScreen('about')} demo={demo}/>{siteSettingsError&&<p className="inline-alert" role="alert">{siteSettingsError}</p>}</>}

        {autoProgress&&<div className={'auto-progress '+(autoProgress.status==='error'?'auto-progress-error':'')} role="status">
          <div><Languages size={18}/><strong>{autoProgress.status==='running'?(autoProgress.phase==='translation'?'ترجمة الفقرات ومراجعة الأرقام':'إعداد الشرح بعد الترجمة'):autoProgress.status==='done'?'اكتملت معالجة المادة':autoProgress.status==='partial'?'بعض الفقرات تحتاج إعادة محاولة':'توقفت المعالجة التلقائية'}</strong></div>
          <p>{autoProgress.done} / {autoProgress.total} مقطع — {autoProgress.error||(autoProgress.failures?.length?'تعذر معالجة '+autoProgress.failures.length+' مقطع؛ أعد المحاولة من صفحة الدرس.':autoProgress.phase==='translation'?'تُترجم جميع المقاطع قبل إعداد أي شرح. أبقِ الصفحة مفتوحة حتى انتهاء المعالجة.':'اكتملت الترجمة، ويجري إعداد الشرح الإنجليزي والعربي لكل مقطع. أبقِ الصفحة مفتوحة.')}</p>
          {autoProgress.status==='running'&&<div className="auto-progress-track"><span style={{width:(autoProgress.total?100*autoProgress.done/autoProgress.total:0)+'%'}}/></div>}
        </div>}
        {publicAllowed('home')&&screen==='home'&&<>
          <div className="home-hero">
            <div className="hero-copy"><span className="hero-kicker"><Sparkles size={16}/> مساحتك للتعلم</span><h1>{siteSettings.heroLead} <span>{siteSettings.heroAccent}</span></h1><p>{siteSettings.tagline} — دروس مشتركة وشرح بلغتين واستماع صوتي، مع حفظ تقدم الدراسة على جهازك دون تسجيل.</p>
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
              {canReview&&<div className="admin-actions">{isAdmin&&<button className="outline-btn" onClick={()=>setDialog('import')}><Upload size={16}/> استيراد درس</button>}<button className="outline-btn" onClick={()=>startSubjectEdit(library.subjects.find(s=>s.id===subjectId))}><Pencil size={15}/> تدقيق بيانات المادة</button>{isAdmin&&<button className="outline-btn danger-btn" disabled={saving} onClick={deleteSubject}><Trash2 size={15}/> حذف المادة</button>}</div>}</div>
            {lessons.length? <div className="lesson-list">{lessons.map((lesson,i)=>{
              const total=library.sections.filter(s=>s.lesson_id===lesson.id).length;
              const p=library.progress.find(p=>p.lesson_id===lesson.id);
              return <button className="lesson-item" key={lesson.id} onClick={()=>openLesson(lesson.id)}>
                <span className="lesson-number">{String(i+1).padStart(2,'0')}</span><div className="lesson-details"><strong dir="auto">{lesson.title}</strong><span>{total} فقرة {p?'• آخر موضع محفوظ':''}</span></div><span className="lesson-read">ابدأ الدراسة <ChevronLeft size={18}/></span>
              </button>})}</div>:<div className="no-lessons"><FileText size={34}/><strong>لا توجد دروس في هذه المادة بعد</strong><p>{isAdmin?'ارفع ملف PDF أو Word أو TXT لتظهر الدروس للطلاب.':'لم ينشر المشرف دروسًا في هذه المادة بعد.'}</p>{isAdmin&&<button className="primary-btn" onClick={()=>setDialog('import')}><Upload size={16}/> استيراد أول درس</button>}</div>}
          </section>}
        </>}

        {publicAllowed('reader')&&screen==='reader'&&!activeLesson&&<div className="no-lessons">
          <BookOpen size={34}/><h2>لا توجد دروس متاحة حاليًا</h2>
          <p>ستظهر هنا الدروس المنشورة من المشرف. يمكنك العودة إلى المكتبة أو صفحة التعريف.</p>
          {publicAllowed('home')&&<button className="outline-btn" onClick={()=>setScreen('home')}>العودة إلى المكتبة</button>}
        </div>}
        {publicAllowed('reader')&&screen==='reader'&&activeLesson&&<>
          <div className="reader-breadcrumb"><button onClick={()=>setScreen('home')}>المواد الدراسية</button><ChevronLeft size={15}/><span>{parentTitle(library,activeLesson.subject_id)}</span><ChevronLeft size={15}/><strong dir="auto">{activeLesson.title}</strong></div>
          <div className="reader-top">
            <div><div className="eyebrow">وضع المذاكرة <span className="small-circle"/> {parentTitle(library,activeLesson.subject_id)}</div><h1 dir="auto">{activeLesson.title}</h1><p>تقدّم بالدرس فقرةً فقرة، وبدّل اللغة أو المسار الصوتي في أي وقت.</p></div>
            {canReview&&<div className="reader-actions">
              {isAdmin&&<button className="outline-btn" onClick={()=>{setConsent(false);setDialog('generate')}}><Sparkles size={16}/> توليد شرح تلقائي</button>}
              
              {isAdmin&&<button className="outline-btn" onClick={()=>{setConsent(false);setBulkIncludeExplanations(false);setBulkReplaceTranslation(false);setDialog('generate-lesson')}}><Languages size={16}/> ترجمة الدرس كاملًا</button>}
              {isAdmin&&<button className="outline-btn" onClick={()=>{setConsent(false);setBulkIncludeExplanations(true);setBulkReplaceTranslation(false);setDialog('generate-lesson')}}><Sparkles size={16}/> شرح فقرات الدرس</button>}
              {isAdmin&&<button className="outline-btn" onClick={()=>{setConsent(false);setDialog('translate-one')}} disabled={!current}><Languages size={16}/> تحسين ترجمة الفقرة</button>}
              <button className="outline-btn" onClick={editSection} disabled={!current}><Pencil size={16}/> تعديل الفقرة</button>
              {canReview&&<button className="outline-btn" onClick={()=>{setEditingLessonTitle(activeLesson.title);setDialog('lesson-edit')}}><Pencil size={15}/> اسم الدرس</button>}
              {isAdmin&&<button className="outline-btn danger-btn" onClick={deleteLesson}><Trash2 size={15}/> حذف الدرس</button>}
            </div>}
          </div>
          <ReaderAdvancedSearch library={library} activeLessonId={lessonId}
           onOpenResult={(targetLessonId,targetSectionId)=>{
            openLesson(targetLessonId,targetSectionId);
            window.requestAnimationFrame(()=>{
             document.querySelector('.reading-paper, .no-lessons')?.scrollIntoView({behavior:'smooth',block:'start'});
            });
           }}/>
          <div className="reader-grid">
            <div className="reading-column">
              <div className="reading-controls"><div className="control-heading"><Languages size={19}/><strong>طريقة عرض النص</strong></div><div className="segmented" role="group" aria-label="طريقة عرض النص">
                {[['both','مزدوج'],['en','English'],['ar','العربية']].map(([val,name])=><button key={val} className={mode===val?'is-active':''} onClick={()=>setMode(val)}>{name}</button>)}
              </div></div>
              {current?<div className="reading-paper">
                <div className="paragraph-heading">
                  <div><span className="paragraph-label">{'المقطع '+(sectionIndex+1)+' من '+activeSections.length}</span><h2>تعلّم المقطع خطوة بخطوة</h2></div>
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
                        ? <><p>{originalLanguage==='ar'?current.content_en:current.content_ar}</p>{originalLanguage!=='ar'&&<span className="translation-review-label">{current.translation_reviewed_at?'ترجمة تمت مراجعتها':'ترجمة أولية: تأكد من المصطلحات والمعادلات'}</span>}</>
                        : <div className="empty-copy"><p>لم تُضف الترجمة العربية لهذه الفقرة بعد.</p>{isAdmin&&<button className="outline-btn" onClick={()=>{setConsent(false);setDialog('generate')}}><Sparkles size={16}/> إعداد الترجمة والشرح</button>}</div>}
                    </article>}
                  </div>
                </section>
                <section className="study-step explanation-step">
                  <header className="study-step-header">
                    <span className="study-step-number second-step">٢</span>
                    <div><h3>الشرح المبسّط</h3><p>توضيح الفكرة الأساسية بلغة مفهومة، وليس تكرارًا حرفيًا للنص.</p></div>
                  </header>
                  {current?.processed_at&&!current?.reviewed_at&&<p className="ai-review-warning"><AlertTriangle size={15}/> مسودة شرح آلي لم تُراجع بعد؛ تحقق من صحة الأرقام والمصطلحات.{canReview&&<button onClick={editSection}>مراجعة وتعديل</button>}</p>}
                  <div className="explain-languages" role="group" aria-label="لغة الشرح">
                    {[['ar','شرح بالعربية'],['mixed','إنجليزي ثم عربي'],['en','English']].map(([val,name])=>
                      <button key={val} className={explainMode===val?'explain-active':''} onClick={()=>setExplainMode(val)}>{name}</button>
                    )}
                  </div>
                  {explanationText?.trim()
                    ? <div className="explain-body" dir={explainMode==='en'?'ltr':'rtl'}>
                        {explainMode==='mixed'?<div className="paired-explanation">
                          <div className="paired-text-part" dir="ltr"><strong><span>1</span> English explanation</strong><p>{current.explanation_en}</p></div>
                          <div className="paired-text-part" dir="rtl"><strong><span>2</span> الشرح بالعربية</strong><p>{current.explanation_ar}</p></div>
                        </div>:<p>{explanationText}</p>}
                        <div className="explain-actions" dir="rtl">
                          <button className="primary-btn" onClick={()=>play(explainMode,'explain')}><Headphones size={16}/> استمع للشرح {explainMode==='en'?'بالإنجليزية':explainMode==='ar'?'بالعربية':'باللغتين'}</button>
                          {canReview&&<button className="outline-btn" onClick={editSection}><Pencil size={15}/> تعديل الشرح</button>}
                        </div>
                      </div>
                    : <div className="missing-explanation">
                        <div><Info size={18}/><strong>لا يوجد شرح بهذا المسار حتى الآن</strong></div>
                        <p>استيراد الملف يضيف النص الأصلي فقط. تستطيع إنشاء مسودة شرح وترجمة بإذن منك، أو كتابتهما بنفسك.</p>
                        <div className="missing-actions">
                          {isAdmin?<><button className="primary-btn" onClick={()=>{setConsent(false);setDialog('generate')}}><Sparkles size={16}/> إعداد شرح وترجمة</button><button className="outline-btn" onClick={editSection}><Pencil size={16}/> إضافة شرح يدويًا</button></>:isTeacher?<button className="outline-btn" onClick={editSection}><Pencil size={16}/> تدقيق وإضافة شرح</button>:<span className="subtle">سيكون الشرح متاحًا بعد إضافته من هيئة التدريس.</span>}
                        </div>
                      </div>}
                </section>
                <div className="reading-footer"><span>راجع المصطلحات العلمية والأرقام في المصادر الأصلية.</span>{canReview&&<button onClick={editSection}><Pencil size={14}/> تعديل النص والشرح</button>}</div>
              </div>:<div className="no-lessons"><p>لا توجد فقرات في هذا الدرس.</p></div>}
              <div className="navigation-card"><button className="outline-btn" disabled={sectionIndex===0} onClick={()=>changeSection(sectionIndex-1)}><ChevronRight size={17}/> السابقة</button>
                <div className="navigation-progress"><div><span>تقدّمك في الدرس</span><strong>{percentage}%</strong></div><div className="progress-bar"><span style={{width:percentage+'%'}}/></div></div>
                <button className="primary-btn" disabled={sectionIndex>=activeSections.length-1} onClick={()=>changeSection(sectionIndex+1)}>التالية <ChevronLeft size={17}/></button>
              </div>
            </div>
            <aside className="study-panel">
              <StudyAudioPanel current={current} sectionIndex={sectionIndex} sectionCount={activeSections.length}
                purpose={purpose} track={track} onPurposeChange={setListenPurpose} onTrackChange={setAudioTrack}
                playing={playing} paused={paused} speakingLanguage={speakingLanguage} canPlayAudio={canPlayAudio} onlineVoiceMissing={onlineVoiceMissing}
                onPlay={()=>play()} onStop={stop} onSectionChange={changeSection}
                continueListening={continueListening} onContinueChange={value=>{stop();setContinueListening(value)}}
                speed={speed} onSpeedChange={setAudioSpeed}
                arVoices={arVoiceGroups} enVoices={enVoiceGroups} localVoices={installedVoices}
                onRefreshVoices={()=>{retryOnlineVoices();setInstalledVoices(getAvailableVoices())}}
                selectedArVoice={effectiveArVoice} selectedEnVoice={effectiveEnVoice}
                onArabicVoiceChange={v=>{stop();setSelectedArVoice(v)}}
                onEnglishVoiceChange={v=>{stop();setSelectedEnVoice(v)}}
                onPreviewVoice={previewVoice} previewingVoice={previewingVoice}
                volume={listeningVolume} onVolumeChange={v=>{stop();setListeningVolume(v)}}
                recordingAvailable={Boolean(currentRecordedPath)} recordingUrl={recordingUrl}
                recordingRef={recordingRef} onLoadRecording={loadRecording}/>
              <details className="chapters-panel chapters-collapsible">
                <summary className="chapters-heading"><strong><BookOpen size={16}/> مقاطع الدرس</strong><span>{activeSections.length} مقطع <ChevronRight size={15}/></span></summary>
                <div className="paragraph-list">{activeSections.map((section,i)=><button key={section.id} className={'paragraph-link '+(i===sectionIndex?'paragraph-active':'')} onClick={()=>changeSection(i)}>
                  <span className="paragraph-no">{String(i+1).padStart(2,'0')}</span>
                   <span className="paragraph-preview"><strong>المقطع {i+1}</strong><small dir="auto">{section.content_en.slice(0,76)}{section.content_en.length>76?'…':''}</small></span>
                   <span className={'paragraph-translation-state '+(section.content_ar?.trim()||sourceLanguage(section.content_en)==='ar'?'translated':'untranslated')}>
                     {section.content_ar?.trim()||sourceLanguage(section.content_en)==='ar'?'عربي ✓':'تحتاج ترجمة'}
                   </span>{i===sectionIndex&&<span className="active-mini-dot"/>}
                </button>)}</div>
              </details>
            </aside>
          </div>
        </>}
      </main>
      <footer className="main-footer site-brand-footer"><span>{siteSettings.footerText}</span><span>{siteSettings.footerNote}</span>{publicAllowed('about')&&<button className="footer-about-link" type="button" onClick={()=>{stop();setScreen('about')}}>عن المنصة وفريق العمل</button>}</footer>
    </div>
    {notification&&<div className="toast"><CheckCircle2 size={18}/>{notification}<button onClick={()=>setNotification('')}><X size={14}/></button></div>}
    {error&&<div className="toast toast-error" role="alert"><AlertTriangle size={18}/>{error}<button onClick={()=>setError('')}><X size={14}/></button></div>}

    {canReview&&dialog==='subject-edit'&&<Modal title="تعديل المادة" subtitle="يظهر التعديل لكل مستخدمي المنصة." onClose={()=>setDialog('')}>
      <form className="modal-body form-stack" onSubmit={updateSubject}>
        <label>اسم المادة<input required value={subjectTitle} onChange={e=>setSubjectTitle(e.target.value)}/></label>
        <label>الوصف<textarea rows={3} value={subjectDescription} onChange={e=>setSubjectDescription(e.target.value)}/></label>
        <div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" disabled={saving}><Check size={16}/> حفظ</button></div>
      </form>
    </Modal>}
    {canReview&&dialog==='lesson-edit'&&<Modal title="تعديل اسم الدرس" onClose={()=>setDialog('')}>
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
          setDraft({file:null,title:'درس جديد',text:'',autoChapters:false,autoTranslate:true,autoExplain:true,aiConsent:false,subject_id:subjectId||library.subjects[0]?.id});
          setImportWarnings([]);
        }}><Pencil size={15}/> كتابة أو لصق نص بدل رفع ملف</button></div>
        {draft&&<>{draft.fromLessonId&&<div className="short-copy-banner"><BookOpen size={18}/><span><strong>تجهيز نسخة بمقاطع قصيرة</strong> — سيبقى الدرس الأصلي وتعديلاته كما هي. راجع المقاطع أدناه قبل الحفظ.</span></div>}
          <label>عنوان الدرس<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
          <div className="import-stats"><FileText size={17}/> {draft.file?.name||'نص أُدخل يدويًا'} — {importPreview.length} دروس — {importPreview.reduce((sum,c)=>sum+c.sections.length,0)} فقرات — لغة المصدر {sourceLanguage(draft.text)==='ar'?'العربية':'الإنجليزية'}</div>
          <label className="checkbox-line"><input type="checkbox" checked={draft.autoChapters} onChange={e=>setDraft({...draft,autoChapters:e.target.checked})}/> اكتشاف الفصول والوحدات والمحاضرات بالعربية أو الإنجليزية تلقائيًا. ويمكن إيقافه لحفظ الملف كدرس واحد.</label>
          <section className="auto-explanation-box">
            <div className="auto-explanation-title"><Languages size={18}/><strong>ترجمة علمية تلقائية مع الشرح</strong></div>
            <p>بعد رفع الملف، يُقسّم النص إلى مقاطع قصيرة متصلة بالمعنى وتُترجم جميع المقاطع إلى العربية تلقائيًا، مع الاحتفاظ بالنص الإنجليزي حرفيًا وبترتيبه. بعد اكتمال الترجمة يبدأ إعداد الشرح باللغتين. في الوضع المدمج تسمع كل مقطع إنجليزيًا، ثم ترجمته العربية مباشرة، ثم المقطع التالي. الترجمات الآلية تحتاج مراجعة للمصطلحات العلمية.</p>
            <div className={'ai-service-status '+(aiReadiness.ready?'ai-service-ready':'ai-service-offline')}>
              {aiReadiness.checked?(aiReadiness.ready?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>):<LoaderCircle size={16} className="spin"/>}
              {aiReadiness.message||'جارٍ فحص الخدمة...'}
            </div>
            <label className="checkbox-line"><input type="checkbox" checked={!!draft.autoTranslate&&aiReadiness.ready} disabled={!aiReadiness.ready} onChange={e=>setDraft({...draft,autoTranslate:e.target.checked})}/> <strong>ترجمة عربية تلقائية للملف كاملًا</strong> لكل مقطع مطابق، قبل بدء توليد الشرح</label>
            <label className="checkbox-line"><input type="checkbox" checked={!!draft.autoExplain&&aiReadiness.ready} disabled={!aiReadiness.ready} onChange={e=>setDraft({...draft,autoExplain:e.target.checked})}/> إنشاء شرح علمي عربي وإنجليزي بعد الترجمة</label>
            {aiReadiness.ready&&(draft.autoTranslate||draft.autoExplain)&&<label className="checkbox-line"><input type="checkbox" checked={!!draft.aiConsent} onChange={e=>setDraft({...draft,aiConsent:e.target.checked})}/> أقرّ بامتلاك تصريح معالجة المادة خارجيًا، وأوافق على إرسال الفقرات لخدمة الذكاء الاصطناعي واستهلاك الرصيد المحتمل لمعالجة {importPreview.reduce((n,ch)=>n+ch.sections.length,0)} مقطع. قد تتوقف المعالجة عند انتهاء الحد اليومي.</label>}
            <p className="helper-text">إذا كان الملف مقيدًا أو سريًا، لا تفعّل المعالجة الخارجية دون تصريح. يمكنك الاستماع إلى النص الأصلي حتى عند عدم تفعيل الخدمة الذكية.</p>
          </section>
          {/\brestricted\b|سري|مقيد/i.test(draft.text)&&<p className="restriction"><AlertTriangle size={18}/> الملف يتضمن مؤشرًا على تقييد المحتوى. لا تحفظه في خدمة سحابية إلا بعد التأكد من أن التصريح يسمح بذلك.</p>}
          <label>معاينة النص القابل للتعديل<textarea className="extracted-text" dir="auto" rows={11} value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value})}/></label>
          {importWarnings.map((warning,i)=><p className="restriction" key={i}><AlertTriangle size={16}/>{warning}</p>)}
          {!!importPreview.length&&<section className="import-preview"><h3>معاينة توزيع الدروس والفقرات قبل الحفظ</h3>
            {importPreview.slice(0,6).map((chapter,i)=><div className="import-preview-item" key={i}>
              <strong>{i+1}. {chapter.title||'درس بلا عنوان'} — {chapter.sections.length} فقرة</strong>
              <div className="short-passage-preview">{chapter.sections.slice(0,3).map((passage,j)=>
                <div key={j}><span>المقطع {j+1}</span><p dir="auto">{passage.slice(0,255)}{passage.length>255?'…':''}</p></div>)}
                {chapter.sections.length>3&&<small>… وبقية المقاطع بنفس الطول التقريبي</small>}
              </div>
            </div>)}
            {importPreview.length>6&&<p className="helper-text">باقي {importPreview.length-6} دروس أخرى ستُحفظ بعد التأكيد.</p>}
          </section>}
          <p className="helper-text">راجع ترتيب الفصول والأرقام والمعادلات قبل الحفظ. ملفات PDF الممسوحة ضوئيًا تحتاج OCR ولن تُستخرج صورها كنص تلقائيًا.</p>
        </>}
        {demo&&<p className="demo-warning"><Info size={16}/> في وضع التجربة يمكنك استيراد النص وقراءته مؤقتًا، لكن التحديث سيزيله.</p>}
        <div className="modal-actions"><button className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button><button className="primary-btn" disabled={!draft?.text?.trim()||!draft.subject_id||saving} onClick={saveImport}>{saving&&<LoaderCircle size={16} className="spin"/>}<Check size={17}/> حفظ الدرس والفقرات</button></div>
      </div>
    </Modal>}

    {isAdmin&&dialog==='generate-lesson'&&<Modal title="ترجمة الدرس وتحسين المصطلحات" subtitle="ترجمة جميع الفقرات دفعة واحدة دون توليد يدوي لكل فقرة." onClose={()=>setDialog('')}>
      <div className="modal-body form-stack">
        <p className="helper-text">تُترجم الفقرات غير المترجمة تلقائيًا. تُحفظ النسخة الإنجليزية كما هي، ويجري التحقق من الأرقام والرموز. الترجمات التي اعتمدها المشرف يدويًا لن تُمس.</p>
        <div className={'ai-service-status '+(aiReadiness.ready?'ai-service-ready':'ai-service-offline')}>
          {aiReadiness.ready?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>} {aiReadiness.message||'جارٍ فحص خدمة الترجمة'}
        </div>
        <label className="checkbox-line"><input type="checkbox" checked={bulkReplaceTranslation} onChange={e=>setBulkReplaceTranslation(e.target.checked)}/> تحسين الترجمات الآلية أو القديمة غير المعتمدة، وليس الاكتفاء بالفقرات الناقصة</label>
        <label className="checkbox-line"><input type="checkbox" checked={bulkIncludeExplanations} onChange={e=>setBulkIncludeExplanations(e.target.checked)}/> تجهيز شرح عربي وإنجليزي بعد الترجمة (اختياري)</label>
        {bulkIncludeExplanations&&<label>مستوى الشرح<select value={studyLevel} onChange={e=>setStudyLevel(e.target.value)}>
          <option value="basic">مبسط</option><option value="intermediate">متوسط</option><option value="advanced">متقدم</option>
        </select></label>}
        <label className="checkbox-line"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> أقر بامتلاك تصريح إرسال نص هذا الدرس لخدمة معالجة خارجية، وأوافق على معالجة {activeSections.length} مقطع واستهلاك الرصيد المحتمل، مع احتمال توقف الخدمة عند انتهاء الحد اليومي.</label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setDialog('')}>إلغاء</button>
          <button className="primary-btn" disabled={!aiReadiness.ready||!consent||!activeLesson||autoProgress?.status==='running'} onClick={()=>{
            if(activeSections.length>500)return setError('الحد الأقصى 500 مقطع في الدفعة.');
            setDialog('');
            void automaticallyGenerateCourse([activeLesson.id],studyLevel,{translate:true,explain:bulkIncludeExplanations,replace:bulkReplaceTranslation});
          }}><Languages size={16}/> ترجمة الدرس كاملًا</button>
        </div>
      </div>
    </Modal>}

    {isAdmin&&dialog==='translate-one'&&<Modal title="تحسين الترجمة العربية" subtitle="تُرجع خدمة الترجمة مسودة مستقلة عن الشرح. راجعها ثم احفظ ما توافق عليه." onClose={()=>{if(!processing)setDialog('')}}>
      <div className="modal-body form-stack">
        <p className="helper-text">ستُقارن المعادلات والأرقام بالإنجليزية ويُراجع النص العربي مرة ثانية. الترجمة الأصلية الموجودة لن تتغيّر إلا بعد حفظك للمسودة في شاشة التعديل.</p>
        <div className={'ai-service-status '+(aiReadiness.ready?'ai-service-ready':'ai-service-offline')}>{aiReadiness.message||'جارٍ فحص الخدمة'}</div>
        <label className="checkbox-line"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> أوافق على إرسال الفقرة المحددة للمعالجة الخارجية، ولدي تصريح بذلك.</label>
        <div className="modal-actions"><button className="outline-btn" disabled={processing} onClick={()=>setDialog('')}>إلغاء</button>
          <button className="primary-btn" disabled={!consent||!aiReadiness.ready||processing} onClick={translateCurrent}>{processing&&<LoaderCircle size={16} className="spin"/>}<Languages size={16}/> إعداد ترجمة دقيقة للمراجعة</button>
        </div>
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
        {!aiReadiness.ready&&<div className="generation-service-status" role="status">
          <strong><Info size={15}/> الشرح الذكي غير مفعل حتى الآن</strong>
          <span>المواد محفوظة ويمكن قراءتها صوتيًا، لكن إنشاء شرح عربي وإنجليزي جديد يحتاج تفعيل خدمة التوليد من إعدادات الاستضافة. يمكنك تحريره يدويًا الآن.</span>
          <a href="https://app.netlify.com/projects/kaada-pro" target="_blank" rel="noreferrer">فتح إعدادات الموقع للمشرف</a>
        </div>}
        <label>مستوى الشرح<select value={studyLevel} onChange={e=>setStudyLevel(e.target.value)}><option value="basic">مبسّط — للفهم الأولي</option><option value="intermediate">متوسط — شرح متوازن</option><option value="advanced">متقدم — شرح مفصل</option></select></label>
        <label className="checkbox-line"><input type="checkbox" checked={consent} disabled={processing} onChange={e=>setConsent(e.target.checked)}/> أؤكد أن لدي تصريحًا لإرسال هذه الفقرة إلى خدمة ذكاء اصطناعي خارجية، وأوافق على معالجتها.</label>
        {demo&&<p className="demo-warning"><Info size={16}/> ميزة التوليد غير متاحة في الوضع التجريبي. يلزم ربط Supabase وتفعيل خدمة التوليد في Netlify. يمكنك تعديل الشرح يدويًا الآن.</p>}
        <div className="modal-actions">
          <button className="outline-btn" disabled={processing} onClick={editSection}><Pencil size={15}/> تحرير المحتوى يدويًا</button>
          <button className="primary-btn" disabled={processing||!consent||demo||!aiReadiness.ready} onClick={processTranslation}>{processing&&<LoaderCircle className="spin" size={16}/>}<Sparkles size={16}/> توليد مسودة قابلة للتعديل</button>
        </div>
      </div>
    </Modal>}

    {canReview&&dialog==='edit'&&<Modal wide title={generatedDraft?'مراجعة الشرح التلقائي وتعديله':'تعديل الترجمة والشرح'} subtitle="كل تغيير تحفَظه هنا سيظهر في القارئ ويُستخدم عند تشغيل الشرح الصوتي." onClose={()=>setDialog('')}>
      <div className="modal-body form-stack edit-form">
        {generatedDraft&&<div className="review-banner"><CheckCircle2 size={20}/><div><strong>تم إنشاء المسودة بنجاح</strong><p>لم تُحفظ بعد. راجع المصطلحات وعدّل الشرح العربي والإنجليزي كما تريد، ثم اضغط «حفظ الشرح».</p></div></div>}
        <section className="editor-section">
          <h3><Languages size={17}/> الترجمة العربية</h3>
          <p>هذه ترجمة النص الأصلي؛ تختلف عن الشرح المبسط.</p>
          {translationWarnings.length>0&&<div className="translation-quality-warning" role="alert"><AlertTriangle size={18}/><span>قد تختلف أرقام أو معادلات في الترجمة الآلية. راجع النص الإنجليزي وقارن جميع القيم والرموز، ثم صحح النص واعتمده يدويًا قبل الحفظ.</span></div>}
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
          <p>نسخة نصية تجمع المصطلحات الإنجليزية مع الشرح العربي. أما الاستماع المزدوج فيقرأ الشرح الإنجليزي أولًا ثم الشرح العربي المقابل لنفس الفقرة.</p>
          <textarea dir="rtl" rows={4} aria-label="الشرح المدمج" value={editDraft.explanation_mixed||''} onChange={e=>setEditDraft(prev=>({...prev,explanation_mixed:e.target.value}))} placeholder="مثال: Operations Research هو علم بحوث العمليات..."/>
        </section>
        <details className="editor-advanced"><summary>خيارات إضافية: تعديل النص الأصلي ورفع تسجيل صوتي</summary>
          <div className="editor-extras">
            <label>النص الأصلي<textarea dir={originalLanguage==='ar'?'rtl':'ltr'} rows={4} value={editDraft.content_en||''} onChange={e=>setEditDraft(prev=>({...prev,content_en:e.target.value}))}/></label>
            <p className="helper-text">تعديل النص الأصلي يغيّر ما يُقرأ من الملف في هذا الدرس، لذا استخدمه لتصحيح أخطاء الاستخراج فقط.</p>
            {isAdmin&&<div className="audio-upload-box"><strong><FileAudio size={17}/> رفع تسجيلات صوتية (اختياري)</strong><p>يمكن رفع تسجيل منفصل لكل لغة. بدون تسجيل، يحاول المتصفح قراءة نص الشرح الذي حفظته.</p>
              <div className="audio-upload-grid">{tracks.map(option=><label key={option.id} className="audio-upload-input">{option.label}<input type="file" accept="audio/*" disabled={demo||saving} onChange={e=>handleAudioFile(e,option.id)}/></label>)}</div>
            </div>}
          </div>
        </details>
        <label className="checkbox-line translation-approval"><input type="checkbox" checked={translationApproved} onChange={e=>setTranslationApproved(e.target.checked)} disabled={!editDraft.content_ar?.trim()}/> راجعت الترجمة العربية وقارنت المصطلحات العلمية والأرقام بالنص الأصلي (اعتماد بشري).</label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setDialog('')} disabled={saving}>إلغاء</button>
          <button className="primary-btn" onClick={saveEdit} disabled={saving}>{saving&&<LoaderCircle size={16} className="spin"/>}<Check size={17}/> حفظ الشرح والترجمة</button>
        </div>
      </div>
    </Modal>}


    {dialog==='global-search'&&<Modal wide title="البحث داخل المنصة" subtitle="ابحث في جميع المواد والدروس والفقرات وترجماتها وشروحها من أي صفحة." onClose={()=>setDialog('')}>
      <div className="modal-body global-search-modal-body">
       {publicAllowed('reader')
        ?<ReaderAdvancedSearch library={library} activeLessonId={lessonId} autoFocus
          onOpenResult={(targetLessonId,targetSectionId)=>{
           setDialog('');openLesson(targetLessonId,targetSectionId);
           requestAnimationFrame(()=>document.querySelector('.reading-paper')?.scrollIntoView({behavior:'smooth',block:'start'}));
          }}/>
        :<div className="inline-alert" role="status">تم إخفاء قارئ الدروس عن الزوار من إعدادات المنصة؛ البحث في محتواه غير متاح حاليًا.</div>}
      </div>
     </Modal>}
  </div>;
}
