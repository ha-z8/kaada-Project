import {useCallback,useEffect,useState} from 'react';
import {Activity,RefreshCw,ExternalLink,AlertTriangle} from 'lucide-react';
import {supabase} from '../lib/supabase.js';
import {flushIncidents,pendingIncidents,recordIncident} from '../lib/incidents.js';
const labels={database:'قاعدة البيانات',hosting:'الاستضافة',accounts:'الحسابات',audio:'الصوت',network:'الاتصال',frontend:'واجهة الموقع',storage:'التخزين',ai:'الذكاء الاصطناعي'};
const kinds={http:'طلب HTTP غير ناجح',network:'تعذّر الاتصال',runtime:'خطأ أثناء التشغيل',operation:'تعذّر تنفيذ العملية',health:'فحص الخدمة'};
const pageNames={home:'المكتبة',reader:'قارئ الدروس',about:'عن المنصة',accounts:'إدارة الحسابات','site-settings':'الإعدادات','my-account':'حسابي',incidents:'مركز الأخطاء',unknown:'غير محددة'};
export default function IncidentCenter(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[filter,setFilter]=useState('all'),[health,setHealth]=useState(null);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{await flushIncidents();const {data,error}=await supabase.from('platform_incidents').select('id,created_at,source,kind,status,page').order('created_at',{ascending:false}).limit(200);if(error)throw error;setRows(data||[])}
  catch{setError('تعذّر تحميل سجل الخادم. تحقق من اتصال الإنترنت وصلاحية المشرف.')}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);
 const check=async()=>{
  setHealth({hosting:'جارٍ الفحص',database:'جارٍ الفحص'});
  const [web,db]=await Promise.allSettled([fetch('/.netlify/functions/platform-health',{cache:'no-store'}).then(async r=>r.ok&&(await r.json()).service==='hsa-hosting'),supabase.from('platform_incidents').select('id',{head:true,count:'exact'}).limit(1).then(r=>!r.error)]);
  const result={hosting:web.status==='fulfilled'&&web.value?'استجاب الطلب':'تعذّر الطلب',database:db.status==='fulfilled'&&db.value?'استجاب الطلب':'تعذّر الطلب'};
  setHealth(result);for(const [source,value] of Object.entries(result))if(value==='تعذّر الطلب')recordIncident(source,'health');void load();
 };
 const local=pendingIncidents(),shown=rows.filter(x=>filter==='all'||x.source===filter);
 return <div className="accounts-page incident-page">
  <header className="accounts-head"><div><div className="eyebrow"><Activity size={17}/> مراقبة المنصة</div><h1>مركز الأخطاء</h1><p>السجل المشترك للمشرفين: الطلبات الفاشلة والأخطاء الفنية المرصودة أثناء استخدام المنصة.</p></div><button className="outline-btn" disabled={loading} onClick={load}><RefreshCw size={16}/> تحديث السجل</button></header>
  <div className="accounts-summary"><div><Activity size={20}/><span>آخر السجلات المحمّلة</span><strong>{rows.length}</strong></div><div><AlertTriangle size={20}/><span>أخطاء الخادم (5xx)</span><strong>{rows.filter(x=>x.status>=500).length}</strong></div><div><Activity size={20}/><span>بانتظار الإرسال من جهازك</span><strong>{local.length}</strong></div></div>
  <section className="accounts-panel"><h2>فحص الاتصال بالخدمات</h2><p className="subtle">فحص الطلبات من جهازك، وليس مراقبة تشغيل شاملة أو سجلًا مباشرًا لمزوّد الاستضافة.</p><button className="outline-btn" onClick={check}>فحص الآن</button>{health&&<p>الاستضافة: {health.hosting} · قاعدة البيانات: {health.database}</p>}<div className="incident-links"><a href="https://app.netlify.com/projects/kaada-pro/deploys" target="_blank" rel="noreferrer">سجل نشر Netlify <ExternalLink size={14}/></a><a href="https://supabase.com/dashboard/project/oaihjgmmoxvunuxtucin/logs/explorer" target="_blank" rel="noreferrer">سجلات Supabase <ExternalLink size={14}/></a></div></section>
  <section className="accounts-panel"><div className="section-bar compact"><div><h2>السجل الفني</h2><p className="subtle">آخر ٢٠٠ حادثة مسجلة. لا يُحفظ محتوى الطلب أو معلومات الدخول.</p></div><select aria-label="مصدر الخطأ" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">جميع المصادر</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
  {error&&<p role="alert" className="inline-alert">{error}</p>}{loading?<p>جارٍ التحميل…</p>:!shown.length?<p className="subtle">{error?'السجل غير متاح حاليًا.':'لا توجد حوادث مسجلة تطابق التصفية.'}</p>:<div className="incident-table-wrap"><table className="incident-table"><thead><tr><th>المصدر</th><th>الخطأ</th><th>الرمز</th><th>الصفحة</th><th>الوقت</th></tr></thead><tbody>{shown.map(row=><tr key={row.id}><td>{labels[row.source]}</td><td>{kinds[row.kind]}</td><td>{row.status||'—'}</td><td>{pageNames[row.page]}</td><td>{new Date(row.created_at).toLocaleString('ar-SA')}</td></tr>)}</tbody></table></div>}
  </section>
 </div>;
}
