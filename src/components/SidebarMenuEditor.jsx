import {FolderPlus,Layers3,MoveUp,MoveDown,Trash2,GripVertical,Info} from 'lucide-react';
import {SIDEBAR_PAGES,normalizeSidebarMenu} from '../lib/sidebarMenu.js';

export default function SidebarMenuEditor({value,onChange}){
 const config=value&&Array.isArray(value.groups)?value:normalizeSidebarMenu(value);
 const groups=config.groups;
 const changeGroups=next=>onChange({groups:next});
 const patchGroup=(index,patch)=>changeGroups(groups.map((g,i)=>i===index?{...g,...patch}:g));
 const moveGroup=(index,delta)=>{
  const next=[...groups];const target=index+delta;
  if(target<0||target>=groups.length)return;
  [next[index],next[target]]=[next[target],next[index]];
  changeGroups(next);
 };
 const addGroup=()=>{
  if(groups.length>=10)return;
  changeGroups([...groups,{id:crypto.randomUUID(),title:'قائمة جديدة',items:[]}]);
 };
 const deleteGroup=index=>{
  if(groups.length===1)return;
  const next=groups.filter((_,i)=>i!==index).map(g=>({...g,items:[...g.items]}));
  const target=Math.min(index,next.length-1);
  next[target].items.push(...groups[index].items);
  changeGroups(next);
 };
 const patchPage=(gIndex,index,patch)=>{
  changeGroups(groups.map((g,i)=>i===gIndex?{...g,items:g.items.map((p,j)=>j===index?{...p,...patch}:p)}:g));
 };
 const movePage=(gIndex,index,delta)=>{
  const next=groups.map(g=>({...g,items:[...g.items]}));
  const target=index+delta;
  if(target<0||target>=next[gIndex].items.length)return;
  [next[gIndex].items[index],next[gIndex].items[target]]=
    [next[gIndex].items[target],next[gIndex].items[index]];
  changeGroups(next);
 };
 const movePageTo=(gIndex,index,targetId)=>{
  if(groups[gIndex].id===targetId)return;
  const next=groups.map(g=>({...g,items:[...g.items]}));
  const [page]=next[gIndex].items.splice(index,1);
  const target=next.find(g=>g.id===targetId);
  if(target)target.items.push(page);
  changeGroups(next);
 };
 return <div className="sidebar-menu-editor">
  <div className="settings-inline-heading">
   <div><h3><Layers3 size={19}/> القائمة الجانبية اليمنى</h3>
    <p className="helper-text">رتّب القوائم والصفحات، وأنشئ قوائم جديدة، وغيّر أسماءها. تظهر التغييرات لجميع المستخدمين بعد الحفظ.</p>
   </div>
   <button type="button" className="outline-btn" disabled={groups.length>=10} onClick={addGroup}><FolderPlus size={17}/> إضافة قائمة</button>
  </div>
  <div className="sidebar-menu-editor-note"><Info size={16}/>
    <span>تعديل الاسم أو مكان الصفحة لا يغيّر وظيفتها أو صلاحيات الدخول إليها. جميع الصفحات الموجودة محفوظة، ويمكنك نقل أي صفحة إلى قائمة أخرى.</span>
  </div>
  {groups.map((group,gIndex)=><article key={group.id} className="sidebar-menu-edit-group">
   <div className="sidebar-menu-edit-head">
    <label className="site-settings-field">اسم القائمة
     <input type="text" value={group.title} maxLength={60} onChange={e=>patchGroup(gIndex,{title:e.target.value})}
       placeholder="مثل: الصفحات الرئيسية"/>
    </label>
    <div className="sidebar-menu-move-buttons">
     <button type="button" className="outline-btn settings-tiny-btn" disabled={gIndex===0}
       aria-label="نقل القائمة للأعلى" onClick={()=>moveGroup(gIndex,-1)}><MoveUp size={15}/> أعلى</button>
     <button type="button" className="outline-btn settings-tiny-btn" disabled={gIndex===groups.length-1}
       aria-label="نقل القائمة للأسفل" onClick={()=>moveGroup(gIndex,1)}><MoveDown size={15}/> أسفل</button>
     <button type="button" className="icon-btn social-remove" disabled={groups.length===1}
       aria-label="حذف القائمة ونقل صفحاتها لقائمة أخرى" title="حذف القائمة ونقل صفحاتها إلى القائمة المجاورة"
       onClick={()=>deleteGroup(gIndex)}><Trash2 size={17}/></button>
    </div>
   </div>
   <div className="sidebar-menu-page-list">
    {group.items.map((page,index)=>{
     const pageType=SIDEBAR_PAGES.find(p=>p.id===page.id);
     return <div key={page.id} className="sidebar-menu-edit-page">
      <div className="sidebar-menu-page-label"><GripVertical size={17}/><label>
       <span>اسم الصفحة</span>
       <input type="text" value={page.label} maxLength={50} onChange={e=>patchPage(gIndex,index,{label:e.target.value})}/>
       <small>{pageType?.label} {pageType?.access==='admin'?'· للمشرف فقط':pageType?.access==='auth'?'· للحسابات المسجّلة':''}</small>
      </label></div>
      <div className="sidebar-menu-page-actions">
       <label><span>ضمن القائمة</span><select value={group.id}
         onChange={e=>movePageTo(gIndex,index,e.target.value)}>
         {groups.map(g=><option key={g.id} value={g.id}>{g.title||'قائمة جديدة'}</option>)}
       </select></label>
       <div className="sidebar-menu-arrow-buttons">
        <button type="button" className="outline-btn settings-tiny-btn" disabled={index===0}
          aria-label="رفع الصفحة" onClick={()=>movePage(gIndex,index,-1)}><MoveUp size={15}/></button>
        <button type="button" className="outline-btn settings-tiny-btn" disabled={index===group.items.length-1}
          aria-label="خفض الصفحة" onClick={()=>movePage(gIndex,index,1)}><MoveDown size={15}/></button>
       </div>
      </div>
     </div>;
    })}
    {!group.items.length&&<p className="helper-text sidebar-menu-empty">القائمة فارغة. انقل إليها صفحة باستخدام اختيار «ضمن القائمة» من أي صفحة أخرى.</p>}
   </div>
  </article>)}
 </div>;
}
