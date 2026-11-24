import HsaLoader from './HsaLoader.jsx';
import {useNotice} from '../lib/notifications.js';
import {useEffect,useMemo,useState} from 'react';
import {Eye,Globe2,Plus,Save,Settings2,Trash2,Users,Info,ArrowLeft,Link2,Layers3,MoveUp,MoveDown,CheckCircle2,BookOpen,Headphones,ImagePlus,ImageOff,LockKeyhole,ShieldCheck} from 'lucide-react';
import AboutPage from './AboutPage.jsx';
import TeamPhotoFrameEditor from './TeamPhotoFrameEditor.jsx';
import SidebarMenuEditor from './SidebarMenuEditor.jsx';
import SettingsNavigator,{SettingsAccordion} from './SettingsNavigator.jsx';
import {SETTINGS_PANELS,DEVELOPER_PANEL,findSettingsPanels,findSettingsTargets} from '../lib/settingsNavigation.js';
import {PUBLIC_PAGE_IDS,START_PAGE_IDS,SIDEBAR_PAGES} from '../lib/sidebarMenu.js';
import {uploadTeamAvatar} from '../lib/teamAvatars.js';
import {DEFAULT_SITE_EDIT_PERMISSIONS,loadSiteEditPermissions,saveSiteEditPermissions} from '../lib/siteEditPermissions.js';
import {DEFAULT_SITE_SETTINGS,normalizeSiteSettings,SOCIAL_PLATFORMS,socialHref,saveSiteSettings,ABOUT_SECTION_IDS,FEATURE_ICON_OPTIONS} from '../lib/siteSettings.js';

const newId=()=>crypto.randomUUID();
const newLink=()=>({id:newId(),platform:'website',url:''});
const copy=value=>JSON.parse(JSON.stringify(value));
const PARTS=[
 {id:'mission',label:'الفائدة من المنصة'},
 {id:'features',label:'مميزات الدراسة'},
 {id:'steps',label:'خطوات الاستخدام'},
 {id:'sample',label:'مثال القراءة المدمجة'},
 {id:'notes',label:'ملاحظات للطلاب'},
 {id:'team',label:'فريق العمل وحساباتهم'},
];
function Field({label,value,onChange,maxLength=160,large=false,description,settingKey}){
 return <label className="site-settings-field" data-setting-key={settingKey}>{label}
  {large?<textarea rows={4} maxLength={maxLength} value={value??''} onChange={e=>onChange(e.target.value)}/>:
   <input maxLength={maxLength} value={value??''} onChange={e=>onChange(e.target.value)}/>}
  {description&&<small>{description}</small>}
 </label>;
}
function SocialEditor({title,items,onChange}){
 const set=(index,field,value)=>onChange(items.map((s,i)=>i===index?{...s,[field]:value}:s));
 return <div className="site-social-editor">
  <div className="settings-inline-heading"><h3><Link2 size={17}/>{title}</h3><button type="button" className="outline-btn" disabled={items.length>=24} onClick={()=>onChange([...items,newLink()])}><Plus size={16}/> إضافة حساب</button></div>
  {!items.length&&<p className="helper-text">يمكنك إضافة حسابات هذا الشخص فقط. الروابط تظهر تحت اسمه في صفحة «عن المنصة».</p>}
  {items.map((link,i)=><div className="social-edit-row" key={link.id||i}>
   <label>التطبيق<select value={link.platform} onChange={e=>set(i,'platform',e.target.value)}>
    {SOCIAL_PLATFORMS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
   </select></label>
   <label>الرابط أو البريد<input dir="ltr" type="text" value={link.url} maxLength={500}
     placeholder={link.platform==='email'?'name@example.com':'https://example.com/account'}
     onChange={e=>set(i,'url',e.target.value)}/></label>
   <button type="button" className="icon-btn social-remove" aria-label="إزالة حساب الشخص" title="إزالة الحساب" onClick={()=>onChange(items.filter((_,j)=>i!==j))}><Trash2 size={18}/></button>
  </div>)}
 </div>;
}
function ItemEditor({title,items,onChange,type,maximum=20}){
 const set=(i,key,value)=>onChange(items.map((item,n)=>n===i?{...item,[key]:value}:item));
 const move=(i,delta)=>{const next=[...items];[next[i],next[i+delta]]=[next[i+delta],next[i]];onChange(next)};
 const add=()=>onChange([...items,type==='features'?{id:newId(),icon:'book',title:'ميزة جديدة',text:''}
  :type==='steps'?{id:newId(),title:'خطوة جديدة',text:''}:{id:newId(),text:''}]);
 return <div className="site-editable-list">
  <div className="settings-inline-heading"><h3><Layers3 size={17}/>{title}</h3><button className="outline-btn" type="button" disabled={items.length>=maximum} onClick={add}><Plus size={16}/> إضافة</button></div>
  {!items.length&&<p className="helper-text">لا توجد عناصر. اضغط «إضافة» لكتابة عنصر جديد.</p>}
  {items.map((item,i)=><div className="settings-member-editor site-list-item" key={item.id||i}>
   <div className="settings-member-top">
    <strong>{(type==='features'?'ميزة':type==='steps'?'خطوة':'عبارة')+' '+(i+1)}</strong>
    <div>
     <button type="button" className="outline-btn settings-tiny-btn" disabled={i===0} onClick={()=>move(i,-1)}><MoveUp size={14}/> أعلى</button>
     <button type="button" className="outline-btn settings-tiny-btn" disabled={i===items.length-1} onClick={()=>move(i,1)}><MoveDown size={14}/> أسفل</button>
     <button type="button" className="icon-btn social-remove" aria-label="حذف العنصر" title="حذف العنصر" onClick={()=>onChange(items.filter((_,j)=>j!==i))}><Trash2 size={18}/></button>
    </div>
   </div>
   {type==='features'&&<label className="site-settings-field">أيقونة الميزة
    <select value={item.icon} onChange={e=>set(i,'icon',e.target.value)}>{FEATURE_ICON_OPTIONS.map(ic=><option value={ic.id} key={ic.id}>{ic.label}</option>)}</select>
   </label>}
   {type!=='highlights'&&type!=='notes'&&<Field label="العنوان" value={item.title} maxLength={140} onChange={v=>set(i,'title',v)}/>}
   <Field label={type==='steps'?'شرح الخطوة':type==='features'?'وصف الميزة':'النص'} value={item.text} maxLength={type==='highlights'?180:900} large={type!=='highlights'} onChange={v=>set(i,'text',v)}/>
  </div>)}
 </div>;
}
export default function SiteSettingsPage({settings=DEFAULT_SITE_SETTINGS,onSaved,onBack,demo=false,isSiteOwner=false}){
 const [draft,setDraft]=useState(()=>copy(normalizeSiteSettings(settings)));
 const [busy,setBusy]=useState(false);
 const [uploadingMemberId,setUploadingMemberId]=useState(null);
 const [photoStatus,setPhotoStatus]=useState(null);
 const [message,setMessage]=useState('');
 const [preview,setPreview]=useState(false);
 const [settingsQuery,setSettingsQuery]=useState('');
 const [settingsGroup,setSettingsGroup]=useState('all');
 const [openPanels,setOpenPanels]=useState([]);
 const [editPermissions,setEditPermissions]=useState(DEFAULT_SITE_EDIT_PERMISSIONS);
 const [permissionDraft,setPermissionDraft]=useState(DEFAULT_SITE_EDIT_PERMISSIONS);
 const [permissionLoaded,setPermissionLoaded]=useState(false);
 const [permissionSaving,setPermissionSaving]=useState(false);
 const [permissionError,setPermissionError]=useState('');
 const [permissionNotice,setPermissionNotice]=useState('');
 useNotice(message,/^تم/.test(message)?'success':/تعذّر|تعذر|فشل/.test(message)?'error':'info');useNotice(permissionNotice,'success');useNotice(permissionError,'error');
 const canEditIdentity=isSiteOwner||(permissionLoaded&&editPermissions.allow_admin_identity);
 const canEditTeam=isSiteOwner||(permissionLoaded&&editPermissions.allow_admin_team);
 useEffect(()=>{
  let mounted=true;
  setPermissionLoaded(false);
  loadSiteEditPermissions().then(next=>{
   if(!mounted)return;
   setEditPermissions(next);setPermissionDraft(next);
   setPermissionError('');setPermissionLoaded(true);
  }).catch(error=>{
   if(!mounted)return;
   setPermissionError('تعذّر تحميل صلاحيات المطور. بقيت الأقسام المحمية مقفلة: '+error.message);
   setPermissionLoaded(true);
  });
  return()=>{mounted=false};
 },[isSiteOwner]);
 const saveDeveloperPermissions=async()=>{
  if(!isSiteOwner||!permissionLoaded||permissionSaving||demo)return;
  setPermissionSaving(true);setPermissionError('');setPermissionNotice('');
  try{
   const next=await saveSiteEditPermissions(permissionDraft);
   setEditPermissions(next);setPermissionDraft(next);
   setPermissionNotice('تم اعتماد الصلاحيات. تُطبّق على المشرفين مباشرة وتظهر عند تحديث صفحة الإعدادات.');
  }catch(error){setPermissionError(error?.message||'تعذّر حفظ صلاحيات المطور.')}
  finally{setPermissionSaving(false)}
 };
 const searchSource=useMemo(()=>({...draft,...permissionDraft}),[draft,permissionDraft]);
 const visiblePanels=useMemo(
  ()=>findSettingsPanels(searchSource,settingsQuery,settingsGroup,isSiteOwner),
  [searchSource,settingsQuery,settingsGroup,isSiteOwner]);
 const searchTargets=useMemo(()=>findSettingsTargets(
  searchSource,settingsQuery,settingsGroup,isSiteOwner
 ).map(target=>({...target,locked:target.panelId==='identity'?!canEditIdentity:
  target.panelId==='team'?!canEditTeam:false})),
  [searchSource,settingsQuery,settingsGroup,isSiteOwner,canEditIdentity,canEditTeam]);
 const visiblePanelIds=new Set(visiblePanels.map(panel=>panel.id));
 const togglePanel=id=>setOpenPanels(current=>current.includes(id)?current.filter(p=>p!==id):[...current,id]);
 const goToSetting=target=>{
  setSettingsQuery('');
  setSettingsGroup('all');
  setOpenPanels(current=>current.includes(target.panelId)?current:[...current,target.panelId]);
  // Wait for the selected accordion to render before scrolling/focusing its editable control.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const panel=document.getElementById('settings-panel-'+target.panelId);
   if(!panel)return;
   const node=target.key?panel.querySelector('[data-setting-key="'+target.key+'"]'):null;
   (node||panel).scrollIntoView({behavior:'smooth',block:'center'});
   const input=node?.querySelector('input:not(:disabled),textarea:not(:disabled),select:not(:disabled)');
   if(input)input.focus({preventScroll:true});
   else panel.querySelector('.settings-accordion-trigger')?.focus({preventScroll:true});
  }));
 };
 useEffect(()=>{setDraft(copy(normalizeSiteSettings(settings)))},[settings]);
 const update=(key,value)=>setDraft(prev=>({...prev,[key]:value}));
 const updateMember=(i,key,value)=>setDraft(prev=>({...prev,team:prev.team.map((p,j)=>j===i?{...p,[key]:value}:p)}));
 const updateMemberFrame=(id,changes)=>setDraft(prev=>({...prev,team:prev.team.map(p=>{
  if(p.id!==id)return p;
  const patch=typeof changes==='function'?changes(p):changes;
  return {...p,...patch};
 })}));
 const uploadMemberPhoto=async(memberId,file)=>{
  if(!file||!canEditTeam)return;
  setMessage('');setPhotoStatus({memberId,message:'جارٍ معالجة الصورة ورفعها...',error:false});setUploadingMemberId(memberId);
  try{
   const path=await uploadTeamAvatar(file);
   setDraft(prev=>({...prev,team:prev.team.map(p=>p.id===memberId?{...p,avatarPath:path}:p)}));
   setPhotoStatus({memberId,message:'نجح رفع الصورة. اضغط «حفظ ونشر التعديلات» لاعتمادها للزوار.',error:false});
  }catch(error){setPhotoStatus({memberId,message:error?.message||'تعذّر رفع الصورة. تحقق من الصيغة والصلاحيات وحاول مجددًا.',error:true})}
  finally{setUploadingMemberId(null)}
 };

 const updateList=(key,values)=>setDraft(prev=>({...prev,[key]:values}));
 const moveSection=(i,direction)=>setDraft(prev=>{
  const order=[...prev.sectionOrder];[order[i],order[i+direction]]=[order[i+direction],order[i]];return {...prev,sectionOrder:order};
 });
 const toggleSection=id=>setDraft(prev=>({...prev,
  hiddenSections:prev.hiddenSections.includes(id)?prev.hiddenSections.filter(x=>x!==id):[...prev.hiddenSections,id]}));
 const validate=()=>{
  if(!draft.aboutTitle.trim())throw Error('أكمل عنوان صفحة التعريف.');
  if(canEditIdentity&&(!draft.siteName.trim()||!draft.heroLead.trim()||!draft.heroAccent.trim()))throw Error('أكمل اسم المنصة وعناوين الصفحة.');
  if(canEditTeam&&draft.team.some(m=>!m.name.trim()))throw Error('اكتب اسم كل عضو بالفريق أو احذف البطاقة الفارغة.');
  if([...draft.highlights,...draft.notes].some(item=>!item.text.trim()))throw Error('أكمل العبارات والملاحظات الفارغة أو احذفها.');
  if([...draft.features,...draft.steps].some(item=>!item.title.trim()||!item.text.trim()))throw Error('أكمل عنوان ووصف كل ميزة وخطوة، أو احذف العنصر غير المكتمل.');
  if(draft.sidebarMenu.groups.some(g=>!g.title.trim()||g.items.some(p=>!p.label.trim())))
   throw Error('أكمل أسماء القوائم والصفحات في إعدادات القائمة الجانبية قبل الحفظ.');
  const links=draft.team.flatMap(m=>m.socials);
  if(canEditTeam&&links.some(link=>!link.url.trim()||!socialHref(link.platform,link.url)))throw Error('تحقق من روابط الفريق: استخدم روابط HTTPS أو بريدًا إلكترونيًا صحيحًا.');
 };
 const submit=async e=>{
  e.preventDefault();setMessage('');
  try{
   if(uploadingMemberId)throw Error('أكمل رفع الصورة قبل حفظ الصفحة.');
   validate();
   if(demo){setMessage('حساب التجربة لا يحفظ التعديلات في قاعدة البيانات.');return;}
   setBusy(true);
   const saved=await saveSiteSettings(draft);
   onSaved(saved);
   // Keep previously uploaded photos. Staff accounts may reuse a team photo as their avatar.
   setPhotoStatus(null);
   setMessage(saved.__offline_queued?
    'تم حفظ التعديلات على هذا الجهاز، ولم تُنشر بعد. افتح مركز المزامنة عند عودة الإنترنت.':
    'تم حفظ التعديلات المسموح بها ونشرها بنجاح وفق صلاحيات مطور المنصة.');
  }catch(err){setMessage(err?.message||'تعذّر حفظ الإعدادات.')}
  finally{setBusy(false)}
 };
 if(preview)return <div className="settings-preview-wrap">
  <div className="settings-preview-toolbar"><span><Eye size={17}/> معاينة جميع التغييرات قبل الحفظ</span><button type="button" className="outline-btn" onClick={()=>setPreview(false)}><ArrowLeft size={16}/> الرجوع للتعديل</button></div>
  <AboutPage settings={draft} preview onBack={()=>setPreview(false)}/>
 </div>;
 return <div className="site-settings-page">
  <header className="accounts-head"><div><div className="eyebrow"><Settings2 size={16}/> تخصيص المنصة</div><h1>إعدادات المنصة والتخصيص</h1><p>تحكم بأقسام الدليل والمحتوى التعريفي والقائمة الجانبية. الهوية وفريق العمل ظاهران للقراءة، ويحدّد مطور المنصة صلاحية تعديلهما للمشرفين.</p></div></header>
  <SettingsNavigator query={settingsQuery} setQuery={setSettingsQuery}
   group={settingsGroup} setGroup={setSettingsGroup} matches={visiblePanels} isDeveloper={isSiteOwner}
   targets={searchTargets} onGoTo={goToSetting}
   openAll={()=>setOpenPanels([...SETTINGS_PANELS,...(isSiteOwner?[DEVELOPER_PANEL]:[])].map(panel=>panel.id))}
   closeAll={()=>{setSettingsQuery('');setOpenPanels([])}}
   clearAll={()=>{setSettingsQuery('');setSettingsGroup('all')}}/>
  <form className="site-settings-form" onSubmit={submit}>
{visiblePanelIds.has('identity')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='identity')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('identity')}
  locked={!canEditIdentity}
  onToggle={()=>togglePanel('identity')}>
<fieldset disabled={!canEditIdentity} className="owner-readonly-fieldset">
    {!canEditIdentity&&<div className="owner-readonly-indicator"><LockKeyhole size={15}/> مقفل <span>· للعرض فقط</span></div>}
    <section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Globe2 size={22}/><div><h2>الهوية العامة</h2><p>تعديل اسم المنصة والعنوان الرئيسي والتذييل دون تغيير الشعار الأصلي.</p></div></div>
    <div className="site-settings-grid">
     <Field settingKey="siteName" label="اسم المنصة" value={draft.siteName} maxLength={80} onChange={v=>update('siteName',v)}/>
     <Field settingKey="shortName" label="الاسم المختصر" value={draft.shortName} maxLength={30} onChange={v=>update('shortName',v)}/>
     <Field settingKey="heroLead" label="مقدمة عنوان الرئيسية" value={draft.heroLead} maxLength={80} onChange={v=>update('heroLead',v)}/>
     <Field settingKey="heroAccent" label="الكلمة البارزة في الرئيسية" value={draft.heroAccent} maxLength={80} onChange={v=>update('heroAccent',v)}/>
     <Field settingKey="tagline" label="الشعار النصي" value={draft.tagline} maxLength={160} onChange={v=>update('tagline',v)}/>
     <Field settingKey="footerText" label="التذييل الرئيسي" value={draft.footerText} maxLength={200} onChange={v=>update('footerText',v)}/>
     <Field settingKey="footerNote" label="السطر الثاني بالتذييل" value={draft.footerNote} maxLength={200} onChange={v=>update('footerNote',v)}/>
    </div>
   </section>
   </fieldset>
</SettingsAccordion>}

   
   {visiblePanelIds.has('intro')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='intro')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('intro')}
  locked={false}
  onToggle={()=>togglePanel('intro')}>
<section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Info size={22}/><div><h2>مقدمة صفحة «عن المنصة»</h2><p>جميع النصوص التي تظهر في الجزء العلوي من الصفحة.</p></div></div>
    <Field settingKey="aboutEyebrow" label="الكلمة فوق العنوان" value={draft.aboutEyebrow} onChange={v=>update('aboutEyebrow',v)}/>
    <Field settingKey="aboutTitle" label="العنوان الكبير" value={draft.aboutTitle} onChange={v=>update('aboutTitle',v)}/>
    <Field settingKey="aboutIntro" label="مقدمة الصفحة" value={draft.aboutIntro} maxLength={2000} large onChange={v=>update('aboutIntro',v)}/>
    <div className="site-settings-grid">
     <Field settingKey="heroVisualLabel" label="عبارة الرسم التوضيحي" value={draft.heroVisualLabel} onChange={v=>update('heroVisualLabel',v)}/>
     <Field settingKey="heroVisualLanguages" label="رمز اللغتين في الرسم" value={draft.heroVisualLanguages} maxLength={50} onChange={v=>update('heroVisualLanguages',v)}/>
    </div>
   </section>
</SettingsAccordion>}

{visiblePanelIds.has('public')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='public')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('public')}
  locked={false}
  onToggle={()=>togglePanel('public')}>
<section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Globe2 size={22}/><div>
     <h2>الدخول العام وصفحة البداية</h2>
     <p>يمكن لأي زائر المذاكرة دون حساب. اختر الصفحة التي يراها أولًا والصفحات التي تظهر في قائمته الجانبية.</p>
    </div></div>
    <label className="site-settings-field" data-setting-key="homePage">الصفحة الرئيسية عند فتح الموقع
     <select value={draft.homePage} onChange={e=>update('homePage',e.target.value)}>
      {START_PAGE_IDS.map(id=><option key={id} value={id} disabled={!draft.publicPages.includes(id)}>{SIDEBAR_PAGES.find(p=>p.id===id)?.label}</option>)}
     </select>
    </label>
    <div className="site-settings-field" data-setting-key="publicPages"><strong>الصفحات المتاحة للزوار</strong>
     <div className="public-pages-options">
      {PUBLIC_PAGE_IDS.map(id=><label key={id} className="public-page-choice">
       <input type="checkbox" checked={draft.publicPages.includes(id)}
        disabled={id===draft.homePage}
        onChange={e=>setDraft(prev=>({...prev,publicPages:e.target.checked?[...prev.publicPages,id]:prev.publicPages.filter(p=>p!==id)}))}/>
       <span>{SIDEBAR_PAGES.find(p=>p.id===id)?.label}</span>
      </label>)}
     </div>
     <small>لا يمكن إخفاء صفحة البداية. إدارة الموقع والحسابات وحسابي لا تظهر للزوار.</small>
    </div>
   </section>
</SettingsAccordion>}

   {visiblePanelIds.has('sidebar')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='sidebar')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('sidebar')}
  locked={false}
  onToggle={()=>togglePanel('sidebar')}>
<section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Layers3 size={22}/><div><h2>تنظيم القائمة الجانبية</h2><p>إدارة أسماء القوائم والصفحات وتجميعها وترتيبها لجميع مستخدمي المنصة.</p></div></div>
    <div data-setting-key="sidebarMenu"><SidebarMenuEditor value={draft.sidebarMenu} onChange={menu=>update('sidebarMenu',menu)}/></div>
   </section>
</SettingsAccordion>}
   {visiblePanelIds.has('ordering')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='ordering')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('ordering')}
  locked={false}
  onToggle={()=>togglePanel('ordering')}>
<section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Layers3 size={22}/><div><h2>ترتيب أقسام صفحة التعريف</h2><p>رتّب أقسام الدليل من الأعلى للأسفل، أو أخفِ أي قسم دون فقد محتواه. يمكنك إعادة إظهاره لاحقًا.</p></div></div>
    {draft.sectionOrder.map((id,i)=>{
     const section=PARTS.find(p=>p.id===id);
     return <div key={id} className="site-section-order-row">
      <div><strong>{String(i+1).padStart(2,'0')} · {section?.label||id}</strong><small>{draft.hiddenSections.includes(id)?'مخفي من صفحة التعريف':'ظاهر للطلاب'}</small></div>
      <div className="site-order-actions">
       <label className="site-section-toggle"><input type="checkbox" checked={!draft.hiddenSections.includes(id)} onChange={()=>toggleSection(id)}/> إظهار</label>
       <button type="button" className="outline-btn settings-tiny-btn" disabled={i===0} onClick={()=>moveSection(i,-1)}><MoveUp size={15}/> أعلى</button>
       <button type="button" className="outline-btn settings-tiny-btn" disabled={i===draft.sectionOrder.length-1} onClick={()=>moveSection(i,1)}><MoveDown size={15}/> أسفل</button>
      </div>
     </div>;
    })}
   </section>
</SettingsAccordion>}

   
   {visiblePanelIds.has('mission')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='mission')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('mission')}
  locked={false}
  onToggle={()=>togglePanel('mission')}>
<section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><BookOpen size={22}/><div><h2>فكرة المنصة وفائدتها</h2><p>العنوان والنص والعبارات القصيرة القابلة للتعديل.</p></div></div>
    <div className="site-settings-grid">
     <Field settingKey="missionKicker" label="عنوان فرعي" value={draft.missionKicker} onChange={v=>update('missionKicker',v)}/>
     <Field settingKey="missionTitle" label="عنوان القسم" value={draft.missionTitle} onChange={v=>update('missionTitle',v)}/>
    </div>
    <Field settingKey="mission" label="نص الفائدة" value={draft.mission} maxLength={2000} large onChange={v=>update('mission',v)}/>
    <ItemEditor title="عبارات التميّز" items={draft.highlights} maximum={12} type="highlights" onChange={v=>updateList('highlights',v)}/>
   </section>
</SettingsAccordion>}

   {visiblePanelIds.has('features')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='features')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('features')}
  locked={false}
  onToggle={()=>togglePanel('features')}>
<section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Layers3 size={22}/><div><h2>خدمات المنصة للطالب</h2><p>عدّل كل بطاقة وأيقونتها وعنوانها ووصفها، أو أضف بطاقة جديدة أو غيّر ترتيب البطاقات.</p></div></div>
    <div className="site-settings-grid">
     <Field settingKey="featuresKicker" label="عنوان فرعي" value={draft.featuresKicker} onChange={v=>update('featuresKicker',v)}/>
     <Field settingKey="featuresTitle" label="عنوان القسم" value={draft.featuresTitle} onChange={v=>update('featuresTitle',v)}/>
    </div>
    <Field settingKey="featuresIntro" label="وصف القسم" value={draft.featuresIntro} maxLength={600} large onChange={v=>update('featuresIntro',v)}/>
    <ItemEditor title="بطاقات الخدمات" items={draft.features} maximum={20} type="features" onChange={v=>updateList('features',v)}/>
   </section>
</SettingsAccordion>}

   {visiblePanelIds.has('steps')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='steps')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('steps')}
  locked={false}
  onToggle={()=>togglePanel('steps')}>
<section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><CheckCircle2 size={22}/><div><h2>دليل الطالب من البداية للنهاية</h2><p>كل خطوة قابلة للتعديل والإضافة والحذف وإعادة الترتيب، والأرقام تُحدّث تلقائيًا حسب ترتيبها.</p></div></div>
    <div className="site-settings-grid">
     <Field settingKey="stepsKicker" label="عنوان فرعي" value={draft.stepsKicker} onChange={v=>update('stepsKicker',v)}/>
     <Field settingKey="stepsTitle" label="عنوان القسم" value={draft.stepsTitle} onChange={v=>update('stepsTitle',v)}/>
    </div>
    <Field settingKey="stepsIntro" label="وصف القسم" value={draft.stepsIntro} maxLength={600} large onChange={v=>update('stepsIntro',v)}/>
    <ItemEditor title="خطوات المستخدم" items={draft.steps} maximum={24} type="steps" onChange={v=>updateList('steps',v)}/>
   </section>
</SettingsAccordion>}

   {visiblePanelIds.has('sample')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='sample')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('sample')}
  locked={false}
  onToggle={()=>togglePanel('sample')}>
<section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Headphones size={22}/><div><h2>مثال القراءة الإنجليزية والعربية</h2><p>تقدر تستبدل مثال الدرس بالكامل، بما فيه العناوين والترجمة والجملة التوضيحية.</p></div></div>
    <div className="site-settings-grid">
     <Field settingKey="sampleTitle" label="عنوان المثال" value={draft.sampleTitle} onChange={v=>update('sampleTitle',v)}/>
     <Field settingKey="sampleSubtitle" label="الوصف الصغير" value={draft.sampleSubtitle} maxLength={600} onChange={v=>update('sampleSubtitle',v)}/>
     <Field settingKey="sampleEnglishLabel" label="عنوان اللغة الإنجليزية" value={draft.sampleEnglishLabel} onChange={v=>update('sampleEnglishLabel',v)}/>
     <Field settingKey="sampleArabicLabel" label="عنوان اللغة العربية" value={draft.sampleArabicLabel} onChange={v=>update('sampleArabicLabel',v)}/>
    </div>
    <Field settingKey="sampleEnglish" label="المقطع الإنجليزي" value={draft.sampleEnglish} maxLength={1000} large onChange={v=>update('sampleEnglish',v)}/>
    <Field settingKey="sampleArabic" label="الترجمة العربية المقابلة" value={draft.sampleArabic} maxLength={1000} large onChange={v=>update('sampleArabic',v)}/>
    <Field settingKey="sampleFoot" label="نص أسفل المثال" value={draft.sampleFoot} maxLength={600} large onChange={v=>update('sampleFoot',v)}/>
   </section>
</SettingsAccordion>}

   {visiblePanelIds.has('notes')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='notes')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('notes')}
  locked={false}
  onToggle={()=>togglePanel('notes')}>
<section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Info size={22}/><div><h2>ملاحظات للطلاب</h2><p>كل ملاحظة قابلة للإضافة والحذف والتحرير والترتيب.</p></div></div>
    <div className="site-settings-grid">
     <Field settingKey="notesKicker" label="عنوان فرعي" value={draft.notesKicker} onChange={v=>update('notesKicker',v)}/>
     <Field settingKey="notesTitle" label="عنوان القسم" value={draft.notesTitle} onChange={v=>update('notesTitle',v)}/>
    </div>
    <ItemEditor title="ملاحظات المستخدم" items={draft.notes} maximum={20} type="notes" onChange={v=>updateList('notes',v)}/>
   </section>
</SettingsAccordion>}

{visiblePanelIds.has('team')&&<SettingsAccordion panel={SETTINGS_PANELS.find(p=>p.id==='team')}
  opened={Boolean(settingsQuery.trim())||openPanels.includes('team')}
  locked={!canEditTeam}
  onToggle={()=>togglePanel('team')}>
<fieldset disabled={!canEditTeam} className="owner-readonly-fieldset">
    {!canEditTeam&&<div className="owner-readonly-indicator"><LockKeyhole size={15}/> مقفل <span>· للعرض فقط</span></div>}
    <section className="accounts-panel site-settings-card">
    <div className="settings-card-title"><Users size={22}/><div><h2>فريق العمل وحساباتهم الشخصية</h2><p>حسابات التواصل تظهر تحت كل شخص فقط، ولا يوجد أي قسم لحسابات HSA العامة.</p></div></div>
    <div className="site-settings-grid">
     <Field settingKey="teamKicker" label="عنوان فرعي" value={draft.teamKicker} onChange={v=>update('teamKicker',v)}/>
     <Field settingKey="teamTitle" label="عنوان قسم الفريق" value={draft.teamTitle} onChange={v=>update('teamTitle',v)}/>
    </div>
    <Field settingKey="teamIntro" label="وصف الفريق" value={draft.teamIntro} maxLength={600} large onChange={v=>update('teamIntro',v)}/>
    <Field settingKey="teamEmpty" label="العبارة عند عدم وجود أعضاء" value={draft.teamEmpty} maxLength={300} onChange={v=>update('teamEmpty',v)}/>
    {draft.team.map((member,i)=><div className="settings-member-editor" key={member.id||i}>
     <div className="settings-member-top"><strong>عضو الفريق {i+1}</strong><div>
      <button type="button" className="outline-btn settings-tiny-btn" disabled={i===0} onClick={()=>setDraft(prev=>{const arr=[...prev.team];[arr[i-1],arr[i]]=[arr[i],arr[i-1]];return {...prev,team:arr}})}><MoveUp size={14}/> أعلى</button>
      <button type="button" className="outline-btn settings-tiny-btn" disabled={i===draft.team.length-1} onClick={()=>setDraft(prev=>{const arr=[...prev.team];[arr[i+1],arr[i]]=[arr[i],arr[i+1]];return {...prev,team:arr}})}><MoveDown size={14}/> أسفل</button>
      <button type="button" className="icon-btn social-remove" aria-label="حذف العضو" title="حذف العضو" onClick={()=>updateList('team',draft.team.filter((_,j)=>i!==j))}><Trash2 size={17}/></button>
     </div></div>
     <div className="team-photo-editor photo-frame-editor-shell">
       <TeamPhotoFrameEditor member={member} disabled={!canEditTeam||!!uploadingMemberId||busy||demo}
        onUpdate={patch=>updateMemberFrame(member.id,patch)}/>
       <div className="team-photo-editor-details">
        <strong>الصورة الشخصية</strong>
        <p>ارفع صورتك من جهازك، ثم اسحبها داخل الإطار لتغيير موضعها، وكبّرها أو صغّرها وعدّل ارتفاع الإطار كما تبي.</p>
        <div className="team-photo-actions">
         <input className="team-photo-file-input" id={'team-photo-'+member.id} type="file"
           accept="image/jpeg,image/png,image/webp" disabled={!canEditTeam||!!uploadingMemberId||busy||demo}
           onChange={e=>{const file=e.target.files?.[0];e.target.value='';uploadMemberPhoto(member.id,file)}}/>
         <label className={'outline-btn team-photo-upload'+(!canEditTeam||uploadingMemberId||busy||demo?' team-photo-disabled':'')} htmlFor={'team-photo-'+member.id}>
          {uploadingMemberId===member.id?<HsaLoader size={17}/>:<ImagePlus size={17}/>}
          {uploadingMemberId===member.id?'جارٍ رفع الصورة...':member.avatarPath?'تغيير الصورة':'رفع صورة'}
         </label>
         {member.avatarPath&&<button type="button" className="outline-btn" disabled={!!uploadingMemberId||busy}
           onClick={()=>updateMember(i,'avatarPath','')}><ImageOff size={16}/> إزالة الصورة</button>}
        </div>
        <small>JPG أو PNG أو WebP — حتى 8 ميجابايت؛ تُضغط قبل الرفع.</small>
        {photoStatus?.memberId===member.id&&<div className={'team-photo-upload-status'+(photoStatus.error?' is-error':'')}
          role="status" aria-live="polite">{photoStatus.message}</div>}
       </div>
     </div>
     <div className="site-settings-grid">
      <Field label="الاسم" value={member.name} maxLength={100} onChange={v=>updateMember(i,'name',v)}/>
      <Field label="الصفة أو الدور" value={member.role} maxLength={120} onChange={v=>updateMember(i,'role',v)}/>
     </div>
     <Field label="نبذة عن المشاركة" value={member.bio} maxLength={500} large onChange={v=>updateMember(i,'bio',v)}/>
     <SocialEditor title={'حسابات '+(member.name||'العضو')} items={member.socials} onChange={v=>updateMember(i,'socials',v)}/>
    </div>)}
    <button type="button" className="outline-btn" disabled={draft.team.length>=25}
     onClick={()=>updateList('team',[...draft.team,{id:newId(),name:'',role:'',bio:'',avatarPath:'',socials:[]}])}><Plus size={17}/> إضافة عضو</button>
   </section>
   </fieldset>
</SettingsAccordion>}

   
   {isSiteOwner&&visiblePanelIds.has('developer')&&
    <SettingsAccordion panel={DEVELOPER_PANEL}
     opened={Boolean(settingsQuery.trim())||openPanels.includes('developer')}
     locked={false} onToggle={()=>togglePanel('developer')}>
     <div className="developer-permissions-panel">
      <div className="developer-permissions-intro">
       <span><ShieldCheck size={22}/></span>
       <div><strong>التحكم في صلاحيات المشرفين</strong>
        <p>هذا القسم خاص بحساب مطور المنصة فقط. اختر هل تسمح للمشرفين بتعديل هوية المنصة أو فريق العمل. لكل قسم مفتاح مستقل، ولا تشمل هذه الصلاحيات أعضاء هيئة التدريس.</p>
       </div>
      </div>
      <div className="developer-permissions-options">
       <label className="developer-permission-item" data-setting-key="allow_admin_identity">
        <span><strong>تعديل هوية المنصة</strong>
         <small>اسم المنصة، العنوان الرئيسي، الشعار النصي، والتذييل</small>
        </span>
        <span className="developer-permission-control">
         <input type="checkbox" checked={permissionDraft.allow_admin_identity}
          disabled={!permissionLoaded||permissionSaving||demo}
          onChange={e=>setPermissionDraft(p=>({...p,allow_admin_identity:e.target.checked}))}/>
         <b>{permissionDraft.allow_admin_identity?'مسموح':'مقفل'}</b>
        </span>
       </label>
       <label className="developer-permission-item" data-setting-key="allow_admin_team">
        <span><strong>تعديل فريق العمل</strong>
         <small>إضافة الأعضاء وتغيير الأسماء والصور وروابط التواصل</small>
        </span>
        <span className="developer-permission-control">
         <input type="checkbox" checked={permissionDraft.allow_admin_team}
          disabled={!permissionLoaded||permissionSaving||demo}
          onChange={e=>setPermissionDraft(p=>({...p,allow_admin_team:e.target.checked}))}/>
         <b>{permissionDraft.allow_admin_team?'مسموح':'مقفل'}</b>
        </span>
       </label>
      </div>
      <div className="developer-permissions-options about-narration-developer-options">
       <label className="developer-permission-item" data-setting-key="aboutNarrationEnabled">
        <span><strong><Headphones size={17}/> الشرح الصوتي في صفحة «عن المنصة»</strong>
         <small>إظهار أو إخفاء مشغّل الشرح للزوار بالكامل. عند الإخفاء لن يبدأ الصوت ولن يظهر زرّه.</small>
        </span>
        <span className="developer-permission-control">
         <input type="checkbox" checked={draft.aboutNarrationEnabled}
          disabled={busy||demo} onChange={e=>update('aboutNarrationEnabled',e.target.checked)}/>
         <b>{draft.aboutNarrationEnabled?'ظاهر':'مخفي'}</b>
        </span>
       </label>
       <p className="helper-text">لحفظ حالة الشرح الصوتي اضغط «حفظ ونشر التعديلات» أسفل الصفحة. هذا الخيار لمطوّر المنصة فقط ولا تمنحه صلاحيات المشرفين.</p>
      </div>
      <div className="developer-permissions-footer">
       <span>{!permissionLoaded&&<HsaLoader size={20}/>} {!permissionLoaded?'جارٍ تحميل الصلاحيات...':'احفظ الصلاحيات من هنا لاعتمادها مباشرة، دون الحاجة لحفظ بقية الإعدادات.'}</span>
       <button type="button" className="primary-btn"
        disabled={!permissionLoaded||permissionSaving||demo||
         (permissionDraft.allow_admin_identity===editPermissions.allow_admin_identity&&
          permissionDraft.allow_admin_team===editPermissions.allow_admin_team)}
        onClick={saveDeveloperPermissions}>
        {permissionSaving?<HsaLoader size={16}/>:<Save size={16}/>}
        حفظ صلاحيات المشرفين
       </button>
      </div>
      {permissionError&&<p className="inline-alert" role="alert">{permissionError}</p>}
      {permissionNotice&&<p className="developer-permissions-saved" role="status"><CheckCircle2 size={17}/>{permissionNotice}</p>}
     </div>
    </SettingsAccordion>}
   {!isSiteOwner&&permissionError&&<p className="inline-alert" role="alert">{permissionError}</p>}
   {message&&<p className="inline-alert" role="status">{message}</p>}
   <div className="settings-save-actions">
    <span><Info size={17}/> التعديلات تُحفظ في قاعدة البيانات وتظهر لجميع المستخدمين. يمكنك معاينتها أولًا.</span>
    <div><button type="button" className="outline-btn" disabled={!!uploadingMemberId} onClick={()=>{setPreview(true);setMessage('')}}><Eye size={18}/> معاينة الصفحة</button>
    <button className="primary-btn" disabled={busy||demo||!!uploadingMemberId}>{busy?<HsaLoader size={17}/>:<Save size={17}/>} حفظ ونشر التعديلات</button></div>
   </div>
  </form>
 </div>;
}
