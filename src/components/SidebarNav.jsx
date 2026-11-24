import {useState} from 'react';
import {
 LayoutDashboard,BookOpen,Info,Settings2,ShieldCheck,UserRound,
 FolderOpen,Plus,ChevronDown,Activity
} from 'lucide-react';
import {SIDEBAR_PAGES,normalizeSidebarMenu} from '../lib/sidebarMenu.js';

const ICONS={
 home:LayoutDashboard,reader:BookOpen,about:Info,'site-settings':Settings2,
 incidents:Activity,accounts:ShieldCheck,'my-account':UserRound,subjects:FolderOpen,
};
const allowed=(page,{isAdmin,isStaff,publicPages})=>{
 if(page.access==='admin')return isAdmin;
 if(page.access==='auth')return isStaff;
 if(isStaff)return true;
 return publicPages.includes(page.id);
};
export default function SidebarNav({
 menu,isAdmin,isStaff,publicPages=['home','reader','about','subjects','help'],activeLesson,library,subjectId,screen,
 onNavigate,onSubject,onNewSubject,
}){
 const [collapsed,setCollapsed]=useState({});
 const {groups}=normalizeSidebarMenu(menu);
 return <div className="sidebar-dynamic-menu">
  {groups.map(group=>{
   const items=group.items.filter(item=>allowed(
    SIDEBAR_PAGES.find(p=>p.id===item.id)||{access:'all'},
    {isAdmin,isStaff,publicPages}
   ));
   if(!items.length)return null;
   const closed=Boolean(collapsed[group.id]);
   return <section className="sidebar-dynamic-group" key={group.id} aria-label={group.title}>
    <button type="button" className={'side-caption sidebar-menu-heading'+(closed?' is-collapsed':'')}
      aria-expanded={!closed} onClick={()=>setCollapsed(c=>({...c,[group.id]:!c[group.id]}))}>
      <span>{group.title}</span><ChevronDown size={15} aria-hidden="true"/>
    </button>
    {!closed&&items.map(item=>{
     if(item.id==='subjects')return <div className="sidebar-subjects-group" key={item.id}>
      <div className="side-title"><span>{item.label}</span>{isAdmin&&<button className="icon-btn small-icon" onClick={onNewSubject} aria-label="إضافة مادة"><Plus size={19}/></button>}</div>
      {library.subjects.map(subject=><button key={subject.id}
        className={'subject-link '+(subjectId===subject.id?'active':'')}
        onClick={()=>onSubject(subject.id)}>
        <span className="folder-dot"><FolderOpen size={17}/></span>
        <span className="ellipsis">{subject.title}</span>
        <span className="item-count">{library.lessons.filter(l=>l.subject_id===subject.id).length}</span>
      </button>)}
      {!library.subjects.length&&<p className="sidebar-empty">لم يضف المشرف أي مادة بعد.</p>}
     </div>;
     const Icon=ICONS[item.id]||Info;
     return <button key={item.id} type="button"
      className={'side-nav '+(screen===item.id?'selected':'')}
      disabled={item.id==='reader'&&!activeLesson}
      onClick={()=>onNavigate(item.id)}>
      <Icon size={19}/><span>{item.label}</span>
     </button>;
    })}
   </section>;
  })}
 </div>;
}
