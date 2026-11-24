// Navigation is an editable presentation list only; pages remain fixed, and
// permission checks still live in the app and backend.
export const SIDEBAR_PAGES=Object.freeze([
 {id:'home',label:'لوحة المذاكرة',access:'all'},
 {id:'reader',label:'قارئ الدروس',access:'all'},
 {id:'about',label:'عن المنصة',access:'all'},
 {id:'site-settings',label:'إعدادات الموقع',access:'admin'},
 {id:'accounts',label:'إدارة الحسابات',access:'admin'},
 {id:'my-account',label:'حسابي',access:'auth'},
 {id:'incidents',label:'مركز الأخطاء',access:'admin'},
 {id:'subjects',label:'المواد الدراسية',access:'all',kind:'subjects'},
]);
export const PUBLIC_PAGE_IDS=Object.freeze(['home','reader','about','subjects']);
export const START_PAGE_IDS=Object.freeze(['home','reader','about']);
const PAGE_IDS=new Set(SIDEBAR_PAGES.map(p=>p.id));
const defaults=[
 {id:'primary',title:'المكتبة التعليمية المشتركة',
  items:SIDEBAR_PAGES.filter(p=>p.id!=='subjects').map(({id,label})=>({id,label}))},
 {id:'courses',title:'المواد الدراسية',items:[{id:'subjects',label:'المواد الدراسية'}]},
];
export const DEFAULT_SIDEBAR_MENU=Object.freeze({groups:defaults});
const string=(v,max,fallback)=>typeof v==='string'&&v.trim()?v.trim().slice(0,max):fallback;
const safeGroupId=(s,index)=>/^[a-z0-9_-]{1,64}$/i.test(String(s||''))?String(s):'group-'+index;
const defaultLabel=id=>SIDEBAR_PAGES.find(p=>p.id===id)?.label||id;
export function normalizeSidebarMenu(input){
 if(!input||!Array.isArray(input.groups))return {groups:defaults.map(g=>({...g,items:g.items.map(p=>({...p}))}))};
 const seen=new Set();
 const ids=new Set();
 let groups=input.groups.slice(0,10).map((raw,index)=>{
  const g=raw&&typeof raw==='object'?raw:{};
  let groupId=safeGroupId(g.id,index);
  if(ids.has(groupId))groupId='group-'+index;
  ids.add(groupId);
  return {
   id:groupId,
   title:string(g.title,60,'قائمة '+(index+1)),
   items:(Array.isArray(g.items)?g.items:[]).slice(0,24).flatMap(item=>{
    const id=typeof item==='string'?item:item?.id;
    if(!PAGE_IDS.has(id)||seen.has(id))return [];
    seen.add(id);
    return [{id,label:string(item?.label,50,defaultLabel(id))}];
   }),
  };
 });
 // Drop the obsolete dedicated help menu when upgrading previously saved navigation.
 groups=groups.filter(g=>g.id!=='support'||g.items.length>0);
 if(!groups.length)groups.push({id:'primary',title:'القائمة الرئيسية',items:[]});
 // Every existing destination remains reachable after a corrupted or partial edit.
 for(const page of SIDEBAR_PAGES){
  if(!seen.has(page.id))groups[0].items.push({id:page.id,label:page.label});
 }
 return {groups};
}
export function sidebarLabel(menu,pageId){
 for(const group of normalizeSidebarMenu(menu).groups){
  const item=group.items.find(p=>p.id===pageId);
  if(item)return item.label;
 }
 return defaultLabel(pageId);
}
