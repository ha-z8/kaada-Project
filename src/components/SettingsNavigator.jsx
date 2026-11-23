import {ChevronDown,LockKeyhole,Search,X} from 'lucide-react';
import {SETTINGS_GROUPS,SETTINGS_PANELS,DEVELOPER_GROUP} from '../lib/settingsNavigation.js';

export function SettingsAccordion({panel,opened,onToggle,locked=false,children}){
 return <section id={'settings-panel-'+panel.id}
  className={'settings-accordion'+(opened?' settings-accordion-open':'')}>
  <button type="button" className="settings-accordion-trigger" onClick={onToggle}
   aria-expanded={opened} aria-controls={'settings-content-'+panel.id}>
   <span className="settings-accordion-name"><strong>{panel.title}</strong>
    <small>{[...SETTINGS_GROUPS,DEVELOPER_GROUP].find(g=>g.id===panel.group)?.label}</small>
   </span>
   {locked&&<span className="settings-accordion-locked"><LockKeyhole size={14}/> مقفل</span>}
   <ChevronDown size={18} className="settings-accordion-chevron"/>
  </button>
  {opened&&<div className="settings-accordion-body" id={'settings-content-'+panel.id}>{children}</div>}
 </section>;
}

export default function SettingsNavigator({
 query,setQuery,group,setGroup,matches,targets=[],onGoTo,openAll,closeAll,clearAll,isDeveloper=false
}){
 const groups=isDeveloper?[...SETTINGS_GROUPS,DEVELOPER_GROUP]:SETTINGS_GROUPS;
 const total=SETTINGS_PANELS.length+(isDeveloper?1:0);
 return <div className="settings-search-nav">
  <div className="settings-search-top"><div>
   <h2><Search size={20}/> الوصول السريع للإعدادات</h2>
   <p>كل قسم في قائمة مستقلة؛ افتح اللي تحتاجه فقط، أو ابحث بالكلمة أو اسم الحقل.</p>
  </div><span className="settings-search-count">{matches.length} من {total} أقسام</span></div>
  <div className="settings-search-input">
   <Search size={19}/>
   <input type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)}
    placeholder="ابحث: الصفحة الرئيسية، فريق العمل، الترجمة، القائمة اليمنى..."
    aria-label="بحث سريع في إعدادات الموقع"/>
   {query&&<button type="button" onClick={()=>setQuery('')} aria-label="مسح بحث الإعدادات"><X size={17}/></button>}
  </div>
  {query.trim()&&targets.length>0&&<div className="settings-direct-results" aria-label="الانتقال السريع للإعدادات">
   <div className="settings-direct-heading"><strong>نتائج مطابقة — اضغط للانتقال والتعديل</strong>
    <small>{targets.length} إعداد متاح للوصول السريع</small></div>
   <div className="settings-direct-list">
    {targets.slice(0,10).map(target=><button type="button" key={target.panelId+':'+target.key}
      onClick={()=>onGoTo?.(target)}
      title={'الانتقال إلى '+target.label+' في '+target.panelTitle}>
      <span><strong>{target.label}</strong><small>{target.panelTitle}</small></span>
      <span className="settings-direct-action">{target.locked?<><LockKeyhole size={13}/> عرض فقط</>:<>تعديل <ChevronDown size={14}/></>}</span>
    </button>)}
   </div>
  </div>}
  <div className="settings-group-filters" role="group" aria-label="تصنيف الإعدادات">
   {groups.map(item=><button type="button" key={item.id}
    className={group===item.id?'active':''}
    aria-pressed={group===item.id} onClick={()=>setGroup(item.id)}>
    {item.label}<small>{item.id==='all'?total:item.id==='developer'?1:SETTINGS_PANELS.filter(p=>p.group===item.id).length}</small>
   </button>)}
  </div>
  <div className="settings-accordion-toolbar">
   <span>اضغط على عنوان القسم لفتحه، وأغلق الأقسام غير المطلوبة.</span>
   <div><button type="button" onClick={openAll}>فتح الكل</button>
    <button type="button" onClick={closeAll}>إغلاق الكل</button></div>
  </div>
  {!matches.length&&<div className="settings-search-empty">
   <Search size={24}/><strong>لا توجد إعدادات مطابقة</strong>
   <p>جرّب كلمة أخرى أو ابحث ضمن كل الأقسام.</p>
   <button type="button" className="outline-btn" onClick={clearAll}>إظهار جميع الإعدادات</button>
  </div>}
 </div>;
}
