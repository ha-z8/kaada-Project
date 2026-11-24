import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 DEFAULT_SIDEBAR_MENU,SIDEBAR_PAGES,normalizeSidebarMenu,sidebarLabel
} from '../src/lib/sidebarMenu.js';
import {normalizeSiteSettings,SITE_OWNER_FIELDS} from '../src/lib/siteSettings.js';

const pageIds=SIDEBAR_PAGES.map(x=>x.id);

test('existing right sidebar links and lesson-library navigation are preserved',()=>{
 const menu=normalizeSidebarMenu();
 assert.deepEqual(menu.groups.map(g=>g.title),['المكتبة التعليمية المشتركة','المواد الدراسية']);
 assert.deepEqual(menu.groups.flatMap(g=>g.items.map(p=>p.id)),pageIds);
 assert.equal(sidebarLabel(menu,'about'),'عن المنصة');
 assert.equal(sidebarLabel(menu,'site-settings'),'إعدادات الموقع');
 assert.deepEqual(DEFAULT_SIDEBAR_MENU.groups[1].items.map(p=>p.id),['subjects']);
});
test('any admin can rename pages, move them into new named menus and reorder groups',()=>{
 const input={groups:[
  {id:'custom',title:'دروس ومراجعة',items:[
   {id:'reader',label:'مراجعة الدروس'},
   {id:'home',label:'الرئيسية'},
  ]},
  {id:'people',title:'صفحات المستخدم',items:[
   {id:'my-account',label:'ملفي'},
   {id:'about',label:'من نحن'},
  ]},
 ]};
 const menu=normalizeSiteSettings({sidebarMenu:input}).sidebarMenu;
 assert.equal(menu.groups[0].title,'دروس ومراجعة');
 assert.deepEqual(menu.groups[0].items.map(p=>p.label),['مراجعة الدروس','الرئيسية','إعدادات الموقع','إدارة الحسابات','مركز الأخطاء','المواد الدراسية']);
 assert.equal(menu.groups[1].title,'صفحات المستخدم');
 assert.equal(sidebarLabel(menu,'my-account'),'ملفي');
 assert.equal(sidebarLabel(menu,'about'),'من نحن');
 assert.ok(!SITE_OWNER_FIELDS.includes('sidebarMenu'));
 assert.ok(!SITE_OWNER_FIELDS.includes('sectionOrder'));
});
test('invalid routes, duplicates and page deletion attempts do not create or remove destinations',()=>{
 const menu=normalizeSidebarMenu({groups:[{id:'one',title:'الإدارة',items:[
  {id:'site-settings',label:'الإعدادات'},
  {id:'site-settings',label:'نسخة مكررة'},
  {id:'../../secret',label:'صفحة مزيفة'},
  {id:'https://example.com',label:'صفحة خارجية'},
  {id:'accounts',label:'الحسابات'},
 ]}]});
 const keys=menu.groups.flatMap(g=>g.items.map(p=>p.id));
 assert.deepEqual(new Set(keys),new Set(pageIds));
 assert.equal(keys.length,pageIds.length);
 assert.equal(sidebarLabel(menu,'site-settings'),'الإعدادات');
 assert.equal(menu.groups.length,1);
});
test('menu names and page titles are safely length-limited and old settings get defaults',()=>{
 const menu=normalizeSidebarMenu({groups:[{id:'custom',title:'x'.repeat(300),
  items:[{id:'about',label:'y'.repeat(200)}]}]});
 assert.equal(menu.groups[0].title.length,60);
 assert.equal(menu.groups[0].items[0].label.length,50);
 assert.deepEqual(normalizeSiteSettings({}).sidebarMenu,normalizeSidebarMenu());
 assert.deepEqual(normalizeSidebarMenu({groups:[]}).groups.flatMap(g=>g.items.map(p=>p.id)),pageIds);
});
test('sidebar uses fixed, role-filtered routes instead of user-created URLs',async()=>{
 const sidebar=await readFile(new URL('../src/components/SidebarNav.jsx',import.meta.url),'utf8');
 const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
 const editor=await readFile(new URL('../src/components/SidebarMenuEditor.jsx',import.meta.url),'utf8');
 assert.match(sidebar,/SIDEBAR_PAGES\.find/);
 assert.match(sidebar,/page\.access==='admin'/);
 assert.match(sidebar,/page\.access==='auth'/);
 assert.match(app,/menu=\{siteSettings\.sidebarMenu\}/);
 assert.match(editor,/نقل أي صفحة إلى قائمة أخرى/);
 assert.match(editor,/إضافة قائمة/);
 assert.match(editor,/onChange=\{e=>movePageTo/);
});

test('standalone usage guide is removed from default and legacy configured menus',()=>{
 assert.equal(SIDEBAR_PAGES.some(page=>page.id==='help'),false);
 const legacy=normalizeSidebarMenu({groups:[
  {id:'support',title:'المساعدة',items:[{id:'help',label:'دليل الاستخدام'}]},
  {id:'primary',title:'المكتبة',items:[{id:'home',label:'الرئيسية'}]}
 ]});
 assert.equal(legacy.groups.some(group=>group.id==='support'),false);
 assert.equal(legacy.groups.flatMap(group=>group.items).some(item=>item.id==='help'),false);
 assert.ok(legacy.groups.flatMap(group=>group.items).some(item=>item.id==='home'));
});
