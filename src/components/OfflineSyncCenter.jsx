import HsaLoader from './HsaLoader.jsx';
import InstallStudyApp from './InstallStudyApp.jsx';
import VoiceCompatibilitySetup from './VoiceCompatibilitySetup.jsx';
import LocalTranslationSetup from './LocalTranslationSetup.jsx';
import {prepareOfflineDocuments} from '../lib/studyDocuments.js';
import {useNotice} from '../lib/notifications.js';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Cloud,CloudOff,RefreshCw,AlertTriangle,CheckCircle2,Download,Database,ChevronDown,ShieldCheck} from 'lucide-react';
import {
 OFFLINE_CHANGE_EVENT,listOfflineEdits,resolveOfflineConflict,
 updateOfflineEdit,readOfflineSnapshot,libraryCacheKey
} from '../lib/offlineStore.js';
import {cacheStudyAudio} from '../lib/api.js';
import {replayOfflineChanges} from '../lib/offlineSync.js';

const ENTITY_NAMES={
 subjects:'مادة دراسية', 'subjects:create':'إضافة مادة',
 lessons:'عنوان درس', sections:'فقرة وترجمة',site_settings:'إعدادات الموقع'
};
const STATUS_NAMES={pending:'بانتظار المزامنة',conflict:'تعارض يحتاج مراجعة',error:'لم يقبل الخادم التغيير'};
export default function OfflineSyncCenter({userId,library,onSynced,onPrepareLibrary}){
 const [online,setOnline]=useState(()=>navigator.onLine!==false);
 const [hasCatalog,setHasCatalog]=useState(false);
 const [shellReady,setShellReady]=useState(Boolean(navigator.serviceWorker?.controller));
 const [queue,setQueue]=useState([]);
 const [working,setWorking]=useState(false);
 const [open,setOpen]=useState(false);
 const [feedback,setFeedback]=useState('');
 useNotice(feedback,'info');
 const [lastSync,setLastSync]=useState(null);
 const [audioProgress,setAudioProgress]=useState(null);
 const [documentProgress,setDocumentProgress]=useState(null),[confirmPrepare,setConfirmPrepare]=useState(false),[lastPreparation,setLastPreparation]=useState(null);
 const cancelPreparation=useRef(false);
 useEffect(()=>()=>{cancelPreparation.current=true},[userId]);
 const prepare=async()=>{if(!online||documentProgress)return;setConfirmPrepare(false);setLastPreparation(null);cancelPreparation.current=false;setDocumentProgress({done:0,total:0});try{const next=await onPrepareLibrary?.();const snapshot=await readOfflineSnapshot(libraryCacheKey(userId,Boolean(userId)));if(!snapshot||next&&(['subjects','lessons','sections'].some(key=>JSON.stringify(snapshot[key]||[])!==JSON.stringify(next[key]||[]))))throw Error('لم يتم التحقق من حفظ النسخة الحالية للمكتبة. تحقق من مساحة التخزين أو التعديلات المعلقة.');const result=await prepareOfflineDocuments(next?.lessons||snapshot.lessons||[],userId,setDocumentProgress,()=>cancelPreparation.current);setLastPreparation(result);setFeedback(result.cancelled?'توقف التنزيل. الملفات المكتملة محفوظة.':result.failed?'حُفظ '+result.saved+' ملفًا، وتعذّر حفظ '+result.failed+'.':'اكتمل حفظ المكتبة و'+result.saved+' ملف PDF على الجهاز.');}catch(e){setFeedback(e?.message||'تعذّر تجهيز المكتبة.');}finally{setDocumentProgress(null);void refreshStorage();}};
 const [storage,setStorage]=useState(null);
 const recordingPaths=useMemo(()=>[...new Set((library?.sections||[])
  .flatMap(section=>[section.audio_ar_path,section.audio_en_path,section.audio_mixed_path])
  .filter(path=>typeof path==='string'&&path.length>0))],[library?.sections]);
 const refreshStorage=async()=>{
  try{
   const info=await navigator.storage?.estimate?.();
   if(info?.quota)setStorage({used:info.usage||0,quota:info.quota});
  }catch{}
 };
 const pending=queue.filter(q=>q.status==='pending').length;
 const problems=queue.filter(q=>q.status==='conflict'||q.status==='error').length;
 const refreshQueue=async()=>setQueue(await listOfflineEdits(userId).catch(()=>[]));
 useEffect(()=>{
  let active=true;
  const refresh=()=>{
   if(!active)return;
   void refreshQueue();
   void (async()=>{
    const key=libraryCacheKey(userId,Boolean(userId));
    const value=await readOfflineSnapshot(key).catch(()=>null)
     ||await readOfflineSnapshot('library:public').catch(()=>null);
    if(active)setHasCatalog(Boolean(value));
   })();
   void refreshStorage();
   setShellReady(Boolean(navigator.serviceWorker?.controller));
  };
  const state=()=>{setOnline(navigator.onLine!==false);refresh()};
  window.addEventListener('online',state);
  window.addEventListener('offline',state);
  window.addEventListener(OFFLINE_CHANGE_EVENT,refresh);
  navigator.serviceWorker?.addEventListener('controllerchange',refresh);
  refresh();
  return()=>{
   active=false;
   window.removeEventListener('online',state);
   window.removeEventListener('offline',state);
   window.removeEventListener(OFFLINE_CHANGE_EVENT,refresh);
   navigator.serviceWorker?.removeEventListener('controllerchange',refresh);
  };
 },[userId]);
 const sync=async()=>{
  if(!userId||navigator.onLine===false||working)return;
  setWorking(true);setFeedback('');
  try{
   const result=await replayOfflineChanges(userId);
   if(result.status==='done'){
    if(result.applied)await onSynced?.();
    setLastSync(new Date());
    setFeedback(result.conflicts||result.errors?
      'اكتملت العمليات المقبولة، وبعض التعديلات تحتاج مراجعتك.':
      result.applied?'تمت المزامنة بنجاح.':'');
   }else if(result.status==='login-required'){
    setFeedback('أعد تسجيل الدخول بحسابك نفسه للتحقق من هوية صاحب التعديلات.');
   }else if(result.status==='offline'){
    setFeedback('تعذّر الاتصال. تعديلاتك محفوظة.');
   }
  }catch(error){setFeedback('المزامنة لم تكتمل: '+(error?.message||'فشل الاتصال'))}
  finally{setWorking(false);await refreshQueue()}
 };
 useEffect(()=>{
  if(!userId||!online)return;
  // Retry when connection returns, tab becomes visible, or pending data changes.
  let active=true;
  const kick=()=>{if(active&&document.visibilityState!=='hidden')void sync()};
  kick();
  window.addEventListener('online',kick);
  const visible=()=>{if(document.visibilityState==='visible')kick()};
  document.addEventListener('visibilitychange',visible);
  const timer=setInterval(kick,60000);
  return()=>{
   active=false;
   window.removeEventListener('online',kick);
   document.removeEventListener('visibilitychange',visible);
   clearInterval(timer);
  };
 },[userId,online,pending]);
 const manage=async(item,action)=>{
  if(action==='discard'&&!confirm('ستحذف هذه النسخة المحلية نهائيًا ولن تُرسل للخادم. هل أنت متأكد؟'))return;
  if(action==='retry'&&!confirm('سيتم اعتماد نصك المحلي فوق أحدث نسخة للخادم لهذه الحقول فقط. هل تريد المتابعة؟'))return;
  if(action==='retry'&&item.status==='error'){
   await updateOfflineEdit({...item,status:'pending',lastError:''});
  }else{
   await resolveOfflineConflict(userId,item.operationId,action);
  }
  await refreshQueue();
 };
 const downloadRecordedAudio=async()=>{
  if(!userId||!recordingPaths.length||!online||working||audioProgress)return;
  setAudioProgress({done:0,total:recordingPaths.length,errors:0});
  let done=0,errors=0;
  for(const path of recordingPaths){
   if(navigator.onLine===false)break;
   try{await cacheStudyAudio(path,userId)}catch{errors++}
   done++;
   setAudioProgress({done,total:recordingPaths.length,errors});
  }
  setFeedback(done===recordingPaths.length&&!errors
   ?'تم تنزيل التسجيلات المسموح بها وحفظها على الجهاز.'
   :'اكتمل تحميل '+done+' من '+recordingPaths.length+' تسجيلًا، مع '+errors+' تعذّر حفظها. قد تكون المساحة أو صلاحيات الوصول السبب.');
  setAudioProgress(null);void refreshStorage();
 };
 const exportQueue=()=>{
  const payload={app:'HSA 4 Study',exportedAt:new Date().toISOString(),
   note:'نسخة احتياطية لتعديلات لم تؤكدها قاعدة البيانات. احفظها في مكان آمن.',edits:queue};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');
  a.href=url;a.download='hsa-pending-edits-'+new Date().toISOString().slice(0,10)+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
 };
 return <div className="offline-center">
  <button type="button" className={'offline-center-trigger'+(!online?' offline-center-disconnected':'')}
   onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label="مركز الاتصال والمزامنة">
   {online?(working?<HsaLoader size={20}/>:<Cloud size={17}/>):<CloudOff size={17}/>}
   <span>{!online?'بدون إنترنت':working?'جارٍ المزامنة':problems?'تعارض في المزامنة':pending?'تعديلات معلقة':'متصل'}</span>
   {queue.length>0&&<b>{queue.length}</b>}<ChevronDown size={14}/>
  </button>
  {open&&<section className="offline-center-panel" aria-label="حالة الحفظ المحلي والمزامنة">
   <div className="offline-center-heading"><Database size={19}/>
    <div><strong>مركز العمل دون إنترنت</strong><small>{online?'الاتصال متاح حاليًا':'الموقع يعمل ببيانات الجهاز المحفوظة'}</small></div>
   </div>
   <p>احفظ المناهج على هذا الجهاز قبل انقطاع الإنترنت.</p><InstallStudyApp/>
   {storage&&<small className="offline-center-last">
    المساحة المستخدمة للموقع: {(storage.used/1048576).toFixed(1)} م.ب
    من {(storage.quota/1048576).toFixed(0)} م.ب متاحة تقريبًا
   </small>}
   <div className="offline-center-readiness">
    <span className={shellReady?'ok':'warning'}>{shellReady?'ملفات الموقع جاهزة دون إنترنت':'ملفات الموقع لم تجهز بالكامل بعد'}</span>
    <span className={hasCatalog?'ok':'warning'}>{hasCatalog?'مكتبة الدروس محفوظة على هذا الجهاز':'مكتبة الدروس لم تُحمّل محليًا بعد'}</span>
   </div>
   {userId?<div className="offline-center-stats">
    <span><b>{pending}</b> بانتظار الإرسال</span>
    <span><b>{problems}</b> تحتاج مراجعة</span>
   </div>:<p className="offline-center-note"><ShieldCheck size={15}/> المزامنة الإدارية تتطلب حساب مشرف أو عضو تدريس.</p>}
   <div className="offline-center-actions">
    <button className="outline-btn" disabled={!online||!!documentProgress||!shellReady} onClick={()=>setConfirmPrepare(v=>!v)}><Download size={15}/> تنزيل المناهج للعمل دون إنترنت</button>
    {confirmPrepare&&<div className="offline-download-confirm"><p>سيتم تنزيل جميع ملفات المناهج المتاحة لحسابك، وقد يستغرق ذلك بحسب الحجم والاتصال.</p><button className="primary-btn" onClick={prepare}>بدء التنزيل</button><button className="outline-btn" onClick={()=>setConfirmPrepare(false)}>إلغاء</button></div>}
    {documentProgress&&<div className="offline-download-progress"><HsaLoader size={22} progress={documentProgress.total?100*documentProgress.done/documentProgress.total:undefined}/><small>{documentProgress.total?documentProgress.done+' / '+documentProgress.total:'جارٍ حفظ المكتبة'}</small><button className="outline-btn" onClick={()=>{cancelPreparation.current=true}}>إيقاف التنزيل</button></div>}
    {lastPreparation&&<small>{lastPreparation.saved} PDF محفوظ · {lastPreparation.noPdf} دون PDF · {lastPreparation.failed} لم يُحفظ</small>}
    <details className="offline-voice-details"><summary>تجهيز أصوات تعمل دون إنترنت</summary><VoiceCompatibilitySetup/><LocalTranslationSetup/></details>
    {userId&&<button type="button" className="outline-btn" disabled={!online||working||!pending}
     onClick={()=>void sync()}>{working?<HsaLoader size={18}/>:<RefreshCw size={15}/>} مزامنة الآن</button>}
    {userId&&recordingPaths.length>0&&<button type="button" className="outline-btn"
      disabled={!online||Boolean(audioProgress)}
      onClick={()=>void downloadRecordedAudio()}>
      {audioProgress?<HsaLoader size={22} progress={100*audioProgress.done/audioProgress.total} label="تقدّم التنزيل"/>:<Download size={15}/>} {audioProgress?'تنزيل '+audioProgress.done+' / '+audioProgress.total:
       'تنزيل جميع التسجيلات ('+recordingPaths.length+')'}
    </button>}
    {!!queue.length&&<button type="button" className="outline-btn" onClick={exportQueue}>
     <Download size={15}/> حفظ نسخة احتياطية</button>}
   </div>
   {feedback&&<p role="status" className="offline-center-feedback">{feedback}</p>}
   {!!queue.length&&<div className="offline-center-queue">
    {queue.map(item=><div key={item.operationId} className="offline-center-operation">
     <strong>{ENTITY_NAMES[item.entity]||item.entity}</strong>
     <small>{STATUS_NAMES[item.status]||item.status} · {new Date(item.createdAt).toLocaleString('ar-SA')}</small>
     <p>{Object.keys(item.patch).join('، ')}</p>
     {item.lastError&&<p className="offline-center-error"><AlertTriangle size={14}/>{item.lastError}</p>}
     {item.status!=='pending'&&<div className="offline-center-review-actions">
      {item.status==='error'||item.server?
       <button type="button" onClick={()=>void manage(item,'retry')}>محاولة جديدة بعد المراجعة</button>:null}
      <button type="button" onClick={()=>void manage(item,'discard')}>إلغاء هذا التعديل</button>
     </div>}
    </div>)}
   </div>}
   {!queue.length&&<div className="offline-center-clean"><CheckCircle2 size={17}/> لا توجد تغييرات محلية تنتظر الخادم.</div>}
   {lastSync&&<small className="offline-center-last">آخر فحص: {lastSync.toLocaleTimeString('ar-SA')}</small>}
  </section>}
 </div>;
}
