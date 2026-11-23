import {ChevronDown,LockKeyhole,Search,X} from 'lucide-react';
import {SETTINGS_GROUPS,SETTINGS_PANELS} from '../lib/settingsNavigation.js';

export function SettingsAccordion({panel,opened,onToggle,locked=false,children}){
 return <section id={'settings-panel-'+panel.id}
  className={'settings-accordion'+(opened?' settings-accordion-open':'')}>
  <button type="button" className="settings-accordion-trigger" onClick={onToggle}
   aria-expanded={opened} aria-controls={'settings-content-'+panel.id}>
   <span className="settings-accordion-name"><strong>{panel.title}</strong>
    <small>{SETTINGS_GROUPS.find(g=>g.id===panel.group)?.label}</small>
   </span>
   {locked&&<span className="settings-accordion-locked"><LockKeyhole size={14}/> مقفل</span>}
   <ChevronDown size={18} className="settings-accordion-chevron"/>
  </button>
  {opened&&<div className="settings-accordion-body" id={'settings-content-'+panel.id}>{children}</div>}
 </section>;
}

export default function SettingsNavigator({
 query,setQuery,group,setGroup,matches,openAll,closeAll,clearAll
}){
 return <div className="settings-search-nav">
  <div className="settings-search-top"><div>
   <h2><Search size={20}/> الوصول السريع للإعدادات</h2>
   <p>كل قسم في قائمة مستقلة؛ افتح اللي تحتاجه فقط، أو ابحث بالكلمة أو اسم الحقل.</p>
  </div><span className="settings-search-count">{matches.length} من {SETTINGS_PANELS.length} أقسام</span></div>
  <div className="settings-search-input">
   <Search size={19}/>
   <input type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)}
    placeholder="ابحث: الصفحة الرئيسية، فريق العمل، الترجمة، القائمة اليمنى..."
    aria-label="بحث سريع في إعدادات الموقع"/>
   {query&&<button type="button" onClick={()=>setQuery('')} aria-label="مسح بحث الإعدادات"><X size={17}/></button>}
  </div>
  <div className="settings-group-filters" role="group" aria-label="تصنيف الإعدادات">
   {SETTINGS_GROUPS.map(item=><button type="button" key={item.id}
    className={group===item.id?'active':''}
    aria-pressed={group===item.id} onClick={()=>setGroup(item.id)}>
    {item.label}<small>{item.id==='all'?SETTINGS_PANELS.length:SETTINGS_PANELS.filter(p=>p.group===item.id).length}</small>
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
