import {useEffect,useState} from 'react';
import {Check,Eye,Globe2,LoaderCircle,Plus,Save,Settings2,Trash2,Users,Info,ArrowLeft,Link2} from 'lucide-react';
import AboutPage from './AboutPage.jsx';
import {DEFAULT_SITE_SETTINGS,normalizeSiteSettings,SOCIAL_PLATFORMS,socialHref,saveSiteSettings} from '../lib/siteSettings.js';

const newId=()=>crypto.randomUUID();
const newLink=()=>({id:newId(),platform:'website',url:''});
const copy=value=>JSON.parse(JSON.stringify(value));
function SocialEditor({title,items,onChange}){
 const set=(index,field,value)=>onChange(items.map((s,i)=>i===index?{...s,[field]:value}:s));
 return <div className="site-social-editor">
  <div className="settings-inline-heading"><h3><Link2 size={17}/>{title}</h3><button type="button" className="outline-btn" disabled={items.length>=24} onClick={()=>onChange([...items,newLink()])}><Plus size={16}/> إضافة حساب</button></div>
  {!items.length&&<p className="helper-text">لا توجد روابط بعد. أضف الحسابات التي تملك رابطها الرسمي فقط.</p>}
  {items.map((link,i)=><div className="social-edit-row" key={link.id||i}>
   <label>المنصة<select value={link.platform} onChange={e=>set(i,'platform',e.target.value)}>
    {SOCIAL_PLATFORMS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
   </select></label>
   <label>رابط الحساب أو البريد<input dir="ltr" type="text" value={link.url} maxLength={500}
      placeholder={link.platform==='email'?'name@example.com':'https://example.com/account'}
      onChange={e=>set(i,'url',e.target.value)}/></label>
   <button type="button" className="icon-btn social-remove" title="إزالة الرابط" aria-label="إزالة الرابط" onClick={()=>onChange(items.filter((_,j)=>i!==j))}><Trash2 size={18}/></button>
  </div>)}
 </div>;
}
function Field({label,value,onChange,maxLength=160,large=false,description}){
 return <label className="site-settings-field">{label}
  {large?<textarea rows={4} maxLength={maxLength} value={value||''} onChange={e=>onChange(e.target.value)}/>:
   <input maxLength={maxLength} value={value||''} onChange={e=>onChange(e.target.value)}/>}
  {description&&<small>{description}</small>}
 </label>;
}
export default function SiteSettingsPage({settings=DEFAULT_SITE_SETTINGS,onSaved,onBack,demo=false}){
 const [draft,setDraft]=useState(()=>copy(normalizeSiteSettings(settings)));
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [preview,setPreview]=useState(false);
 useEffect(()=>{setDraft(copy(normalizeSiteSettings(settings)))},[settings]);
 const update=(key,value)=>setDraft(prev=>({...prev,[key]:value}));
 const setTeam=(i,key,value)=>setDraft(prev=>({...prev,team:prev.team.map((p,j)=>j===i?{...p,[key]:value}:p)}));
 const addMember=()=>setDraft(prev=>({...prev,team:[...prev.team,{id:newId(),name:'',role:'',bio:'',socials:[]}]}));
 const removeMember=i=>setDraft(prev=>({...prev,team:prev.team.filter((_,j)=>i!==j)}));
 const validate=()=>{
  if(!draft.siteName.trim()||!draft.aboutTitle.trim()||!draft.heroLead.trim()||!draft.heroAccent.trim())throw Error('أكمل اسم المنصة والعنوان الرئيسي وعنوان التعريف.');
  if(draft.team.some(m=>!m.name.trim()))throw Error('اكتب اسم كل عضو بالفريق أو احذف البطاقة الفارغة.');
  const links=[...draft.socials,...draft.team.flatMap(m=>m.socials)];
  if(links.some(link=>!link.url.trim()||!socialHref(link.platform,link.url)))throw Error('تحقق من روابط التواصل: استخدم روابط HTTPS صحيحة أو عنوان بريد إلكتروني صالحًا.');
  if(draft.team.length>25)throw Error('الحد الأقصى 25 عضوًا.');
 };
 const submit=async e=>{
  e.preventDefault();setMessage('');
  try{
   validate();
   if(demo){setMessage('التجربة لا تحفظ التغييرات في قاعدة البيانات.');return;}
   setBusy(true);
   const saved=await saveSiteSettings(draft);
   onSaved(saved);
   setMessage('تم حفظ التعديلات ونشرها في صفحة التعريف وبقية الأجزاء المرتبطة بها.');
  }catch(err){setMessage(err?.message||'تعذّر حفظ الإعدادات.')}
  finally{setBusy(false);}
 };
 if(preview)return <div className="settings-preview-wrap">
   <div className="settings-preview-toolbar"><span><Eye size={17}/> معاينة التعديلات قبل الحفظ (لن تُنشر إلا بعد الحفظ)</span><button className="outline-btn" type="button" onClick={()=>setPreview(false)}><ArrowLeft size={16}/> العودة للإعدادات</button></div>
   <AboutPage settings={draft} preview onBack={()=>setPreview(false)}/>
 </div>;
 return <div className="site-settings-page">
  <header className="accounts-head"><div><div className="eyebrow"><Settings2 size={16}/> إعدادات إدارة المنصة</div><h1>تخصيص الموقع وصفحة التعريف</h1><p>عدّل الهوية والنصوص التعريفية وأعضاء فريق العمل وروابط التواصل. تظهر التغييرات للجميع بعد الحفظ.</p></div></header>
  <form className="site-settings-form" onSubmit={submit}>
   <section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Globe2 size={22}/><div><h2>الهوية العامة والصفحة الرئيسية</h2><p>نصوص تُستخدم في الواجهة الرئيسية والتذييل، دون تغيير الشعار والملفات التقنية للموقع.</p></div></div>
    <div className="site-settings-grid">
     <Field label="اسم المنصة" value={draft.siteName} maxLength={80} onChange={v=>update('siteName',v)}/>
     <Field label="الاسم المختصر" value={draft.shortName} maxLength={30} onChange={v=>update('shortName',v)}/>
     <Field label="مقدمة عنوان الصفحة الرئيسية" value={draft.heroLead} maxLength={80} onChange={v=>update('heroLead',v)}/>
     <Field label="الكلمة البارزة في العنوان" value={draft.heroAccent} maxLength={80} onChange={v=>update('heroAccent',v)}/>
     <Field label="الشعار النصي" value={draft.tagline} maxLength={160} onChange={v=>update('tagline',v)}/>
     <Field label="التذييل الرئيسي" value={draft.footerText} maxLength={200} onChange={v=>update('footerText',v)}/>
     <Field label="السطر الثاني بالتذييل" value={draft.footerNote} maxLength={200} onChange={v=>update('footerNote',v)}/>
    </div>
   </section>

   <section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Info size={22}/><div><h2>محتوى «عن المنصة»</h2><p>يظهر في مقدمة صفحة التعريف ورسالتها. تفاصيل الخدمات وطريقة العمل مبنية على الميزات الفعلية للموقع.</p></div></div>
    <Field label="عنوان صفحة التعريف" value={draft.aboutTitle} maxLength={160} onChange={v=>update('aboutTitle',v)}/>
    <Field label="النص التعريفي" value={draft.aboutIntro} maxLength={1600} large onChange={v=>update('aboutIntro',v)}/>
    <Field label="الرسالة والفائدة من المنصة" value={draft.mission} maxLength={1600} large onChange={v=>update('mission',v)}/>
   </section>

   <section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Link2 size={22}/><div><h2>حسابات المنصة الرسمية</h2><p>تظهر كأيقونات وروابط في نهاية صفحة التعريف والتذييل، ولا يُضاف أي حساب تلقائيًا.</p></div></div>
    <SocialEditor title="روابط المنصة" items={draft.socials} onChange={v=>update('socials',v)}/>
   </section>

   <section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Users size={22}/><div><h2>فريق العمل والمشاركون</h2><p>أضف كل شخص باسمه ودوره ووصفه، ثم روابط حساباته الشخصية. يمكنك التعديل والحذف وإعادة ترتيب البطاقات.</p></div></div>
    {draft.team.map((member,i)=><div className="settings-member-editor" key={member.id||i}>
      <div className="settings-member-top"><strong>عضو الفريق {i+1}</strong><div>
       <button type="button" className="outline-btn settings-tiny-btn" disabled={i===0} onClick={()=>setDraft(prev=>{const arr=[...prev.team];[arr[i-1],arr[i]]=[arr[i],arr[i-1]];return {...prev,team:arr}})}>أعلى</button>
       <button type="button" className="outline-btn settings-tiny-btn" disabled={i===draft.team.length-1} onClick={()=>setDraft(prev=>{const arr=[...prev.team];[arr[i+1],arr[i]]=[arr[i],arr[i+1]];return {...prev,team:arr}})}>أسفل</button>
       <button type="button" className="icon-btn social-remove" title="حذف العضو" aria-label="حذف العضو" onClick={()=>removeMember(i)}><Trash2 size={17}/></button>
      </div></div>
      <div className="site-settings-grid">
       <Field label="الاسم" value={member.name} maxLength={100} onChange={v=>setTeam(i,'name',v)}/>
       <Field label="الصفة أو الدور" value={member.role} maxLength={120} onChange={v=>setTeam(i,'role',v)}/>
      </div>
      <Field label="نبذة عن المشاركة" value={member.bio} maxLength={500} large onChange={v=>setTeam(i,'bio',v)}/>
      <SocialEditor title={'حسابات '+(member.name||'العضو')} items={member.socials} onChange={v=>setTeam(i,'socials',v)}/>
    </div>)}
    <button type="button" className="outline-btn" disabled={draft.team.length>=25} onClick={addMember}><Plus size={17}/> إضافة شخص إلى الفريق</button>
   </section>

   {message&&<p className="inline-alert" role="status">{message}</p>}
   <div className="settings-save-actions">
     <span><Info size={17}/> لا يمكن تعديل هذه الإعدادات إلا بحساب المشرف. يتم حفظها في قاعدة البيانات.</span>
     <div><button type="button" className="outline-btn" onClick={()=>{setPreview(true);setMessage('')}}><Eye size={18}/> معاينة الصفحة</button>
     <button className="primary-btn" disabled={busy||demo}>{busy?<LoaderCircle className="spin" size={17}/>:<Save size={17}/>} حفظ ونشر التغييرات</button></div>
   </div>
  </form>
 </div>;
}
