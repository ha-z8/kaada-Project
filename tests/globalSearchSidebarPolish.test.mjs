import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeSiteSettings} from '../src/lib/siteSettings.js';
import {findSettingsPanels,findSettingsTargets} from '../src/lib/settingsNavigation.js';
import {SIDEBAR_PAGES,PUBLIC_PAGE_IDS,normalizeSidebarMenu} from '../src/lib/sidebarMenu.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Ctrl+F and Cmd+F open study search from any ordinary page, and focus settings search in admin settings',async()=>{
 const app=await source('src/App.jsx');
 const reader=await source('src/components/ReaderAdvancedSearch.jsx');
 assert.match(app,/event\.ctrlKey\|\|event\.metaKey/);
 assert.match(app,/event\.key\.toLowerCase\(\)!=='f'/);
 assert.match(app,/event\.preventDefault\(\)/);
 assert.match(app,/setDialog\('global-search'\)/);
 assert.match(app,/dialog==='global-search'&&<Modal wide/);
 assert.match(app,/input\[aria-label="بحث سريع في إعدادات الموقع"\]/);
 assert.match(app,/input\.focus\(\)/);
 assert.match(app,/onClick=\{\(\)=>\{/);
 assert.match(reader,/autoFocus=\{autoFocus\}/);
 assert.match(app,/onOpenResult=\{\(targetLessonId,targetSectionId\)=>/);
 assert.match(app,/openLesson\(targetLessonId,targetSectionId\)/);
});
test('sidebar expands and collapses for staff and visitors and remembers preference per browser',async()=>{
 const app=await source('src/App.jsx');
 const css=await source('src/styles.css');
 assert.match(app,/hsa-sidebar-collapsed/);
 assert.match(app,/sidebar-condensed/);
 assert.match(app,/setSidebarCollapsed\(v=>!v\)/);
 assert.match(app,/aria-label=\{sidebarCollapsed\?'فتح القائمة الجانبية':'طي القائمة الجانبية'\}/);
 assert.match(app,/sidebarCollapsed&&!drawer\?'\/favicon\.svg':'\/hsa-logo\.svg'/);
 assert.match(css,/\.sidebar\.sidebar-condensed\{width:70px;flex:0 0 70px/);
 assert.match(css,/\.sidebar\.sidebar-condensed \.side-scroll/);
 assert.match(css,/@media\(max-width:720px\)[\s\S]*?\.sidebar-collapse-toggle\{display:none\}/);
});
test('standalone help is gone, but the About page content editor remains intact',async()=>{
 const app=await source('src/App.jsx');
 const nav=await source('src/components/SidebarNav.jsx');
 assert.equal(SIDEBAR_PAGES.some(page=>page.id==='help'),false);
 assert.equal(PUBLIC_PAGE_IDS.includes('help'),false);
 assert.doesNotMatch(app,/dialog==='help'/);
 assert.doesNotMatch(nav,/onHelp|isHelp/);
 assert.match(app,/SiteSettingsPage settings=\{siteSettings\}/);
 const legacy=normalizeSidebarMenu({groups:[{id:'support',title:'المساعدة',items:[{id:'help',label:'دليل الاستخدام'}]}]});
 assert.equal(legacy.groups.some(group=>group.id==='support'),false);
});
test('searching settings surfaces direct field shortcuts, with read-only owner targets',()=>{
 const settings=normalizeSiteSettings();
 const landing=findSettingsTargets(settings,'الصفحة الرئيسية');
 assert.ok(landing.length>0);
 assert.equal(landing[0].key,'homePage');
 assert.equal(landing[0].panelId,'public');
 const translation=findSettingsTargets(settings,'الترجمة العربية');
 assert.ok(translation.some(hit=>hit.key==='sampleArabic'));
 const locked=findSettingsTargets(settings,'فريق العمل');
 assert.ok(locked.some(hit=>hit.panelId==='team'&&hit.locked));
 assert.ok(findSettingsPanels(settings,'الصفحة الرئيسية').some(panel=>panel.id==='public'));
});
test('settings shortcut opens the exact field and focuses its enabled editor without losing changes',async()=>{
 const page=await source('src/components/SiteSettingsPage.jsx');
 const nav=await source('src/components/SettingsNavigator.jsx');
 assert.match(page,/onGoTo=\{goToSetting\}/);
 assert.match(page,/setSettingsQuery\(''\)/);
 assert.match(page,/setOpenPanels\(current=>/);
 assert.match(page,/data-setting-key=\{settingKey\}/);
 assert.match(page,/data-setting-key="homePage"/);
 assert.match(page,/data-setting-key="sidebarMenu"/);
 assert.match(page,/input:not\(:disabled\),textarea:not\(:disabled\),select:not\(:disabled\)/);
 assert.match(page,/input\.focus\(\{preventScroll:true\}\)/);
 assert.match(nav,/settings-direct-results/);
 assert.match(nav,/onClick=\{\(\)=>onGoTo\?\.\(target\)\}/);
 assert.match(nav,/target\.locked/);
});
test('About logo and hero buttons maintain contrast, team photo has subtle corner radius and lighter backdrop',async()=>{
 const css=await source('src/styles.css');
 assert.match(css,/\.about-hero-logo img\{[\s\S]*?aspect-ratio:770 \/ 480/);
 assert.match(css,/\.about-page-hero \.primary-btn:hover:not\(:disabled\)/);
 assert.match(css,/background:#eaf4ed;color:#11381d/);
 assert.match(css,/\.about-page-hero \.outline-btn:hover:not\(:disabled\)/);
 assert.match(css,/background:rgba\(8,24,16,\.62\)/);
 assert.match(css,/\.team-image-lightbox-backdrop>\.team-image-lightbox-photo\{[\s\S]*?border-radius:14px/);
 assert.doesNotMatch(css,/\.team-image-lightbox\s*\{/);
});
