import {useEffect,useMemo,useState} from 'react';
import {Cloud,CloudOff,RefreshCw,AlertTriangle,CheckCircle2,Download,Database,ChevronDown,ShieldCheck} from 'lucide-react';
import {
 OFFLINE_CHANGE_EVENT,listOfflineEdits,resolveOfflineConflict,
 updateOfflineEdit
} from '../lib/offlineStore.js';
import {replayOfflineChanges} from '../lib/offlineSync.js';

const ENTITY_NAMES={
 subjects:'مادة دراسية', 'subjects:create':'إضافة مادة',
 lessons:'عنوان درس', sections:'فقرة وترجمة',site_settings:'إعدادات الموقع'
};
const STATUS_NAMES={pending:'بانتظار المزامنة',conflict:'تعارض يحتاج مراجعة',error:'لم يقبل الخادم التغيير'};
export default function OfflineSyncCenter({userId,onSynced}){
 const [online,setOnline]=useState(()=>navigator.onLine!==false);
 const [queue,setQueue]=useState([]);
 const [working,setWorking]=useState(false);
 const [open,setOpen]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [lastSync,setLastSync]=useState(null);
 const pending=queue.filter(q=>q.status==='pending').length;
 const problems=queue.filter(q=>q.status==='conflict'||q.status==='error').length;
 const refreshQueue=async()=>setQueue(await listOfflineEdits(userId).catch(()=>[]));
 useEffect(()=>{
  let active=true;
  const refresh=()=>{if(active)void refreshQueue()};
  const state=()=>{setOnline(navigator.onLine!==false);refresh()};
  window.addEventListener('online',state);
  window.addEventListener('offline',state);
  window.addEventListener(OFFLINE_CHANGE_EVENT,refresh);
  refresh();
  return()=>{
   active=false;
   window.removeEventListener('online',state);
   window.removeEventListener('offline',state);
   window.removeEventListener(OFFLINE_CHANGE_EVENT,refresh);
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
      result.applied?'تمت مزامنة التعديلات مع قاعدة البيانات بنجاح.':'لا توجد تعديلات جديدة للإرسال.');
   }else if(result.status==='login-required'){
    setFeedback('أعد تسجيل الدخول بحسابك نفسه للتحقق من هوية صاحب التعديلات.');
   }else if(result.status==='offline'){
    setFeedback('تعذّر الاتصال بالخادم. التعديلات محفوظة على جهازك وستبقى بانتظار المزامنة.');
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
   {online?<Cloud size={17}/>:<CloudOff size={17}/>}
   <span>{!online?'بدون إنترنت':working?'جارٍ المزامنة':problems?'تعارض في المزامنة':pending?'تعديلات معلقة':'متصل'}</span>
   {queue.length>0&&<b>{queue.length}</b>}<ChevronDown size={14}/>
  </button>
  {open&&<section className="offline-center-panel" aria-label="حالة الحفظ المحلي والمزامنة">
   <div className="offline-center-heading"><Database size={19}/>
    <div><strong>مركز العمل دون إنترنت</strong><small>{online?'الاتصال متاح حاليًا':'الموقع يعمل ببيانات الجهاز المحفوظة'}</small></div>
   </div>
   <p>القراءة والتقدم يُحفظان على هذا الجهاز. تغييرات الموظفين تبقى محليًا إلى أن يؤكدها الخادم. لا تمسح بيانات المتصفح قبل اكتمال المزامنة.</p>
   {userId?<div className="offline-center-stats">
    <span><b>{pending}</b> بانتظار الإرسال</span>
    <span><b>{problems}</b> تحتاج مراجعة</span>
   </div>:<p className="offline-center-note"><ShieldCheck size={15}/> المزامنة الإدارية تتطلب حساب مشرف أو عضو تدريس.</p>}
   <div className="offline-center-actions">
    {userId&&<button type="button" className="outline-btn" disabled={!online||working||!pending}
     onClick={()=>void sync()}><RefreshCw size={15} className={working?'spin':''}/> مزامنة الآن</button>}
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
