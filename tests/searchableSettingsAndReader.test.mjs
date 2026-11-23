import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 normalizeStudyQuery,buildLessonSearchIndex,searchLessonIndex,
 highlightSearchParts,SEARCH_FIELDS,SEARCH_MODES
} from '../src/lib/lessonSearch.js';
import {SETTINGS_PANELS,SETTINGS_GROUPS,findSettingsPanels} from '../src/lib/settingsNavigation.js';
import {normalizeSiteSettings} from '../src/lib/siteSettings.js';

const subjectA={id:'chem',title:'الكيمياء',description:'كيمياء المواد والتفاعلات'};
const subjectB={id:'math',title:'Mathematics',description:'Introduction to Linear Algebra'};
const library={
 subjects:[subjectA,subjectB],
 lessons:[
  {id:'l1',subject_id:'chem',title:'الطاقة وتفاعلات الأكسدة',position:0},
  {id:'l2',subject_id:'chem',title:'فرق الجهد',position:1},
  {id:'l3',subject_id:'math',title:'Matrix Transformations',position:0}
 ],
 sections:[
  {id:'s1',lesson_id:'l1',position:0,content_en:'Oxidation is the loss of electrons.',
   content_ar:'الأكسدة هي فقد الإلكترونات.',explanation_ar:'يتغير عدد التأكسد بسبب فقد الإلكترون.'},
  {id:'s2',lesson_id:'l1',position:1,content_en:'Energy is conserved in a reaction.',
   content_ar:'الطاقة محفوظة في التفاعل.',explanation_en:'An energy balance describes the reaction.'},
  {id:'s3',lesson_id:'l2',position:0,content_en:'Voltage measures electric potential difference.',
   content_ar:'فرق الجهد الكهربائي بين نقطتين.',explanation_ar:'يمكن قياس الجهد بالفولت.'},
  {id:'s4',lesson_id:'l3',position:0,content_en:'A matrix maps a vector to a vector.',
   content_ar:'المصفوفة تحول المتجه.',explanation_en:'A linear transformation changes basis.'}
 ]
};
const index=buildLessonSearchIndex(library);
const search=(query,options={})=>searchLessonIndex(index,{query,...options});
const file=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Arabic/English indexing tolerates diacritics, hamza differences, Arabic digits and case',()=>{
 assert.equal(normalizeStudyQuery('الإِكْسَدَة'),'الاكسده');
 assert.equal(normalizeStudyQuery('أكسدة ٣٠'),'اكسده 30');
 assert.equal(normalizeStudyQuery('مَادَّة'),'ماده');
 assert.equal(normalizeStudyQuery('LINEAR  ALGEBRA'),'linear algebra');
 assert.equal(normalizeStudyQuery('إيـــصال'), 'ايصال');
});
test('searches lesson names and study topics across all subjects, sorted by relevance',()=>{
 const titles=search('الأكسدة',{field:'title'});
 assert.equal(titles[0].lessonId,'l1');
 assert.equal(titles[0].type,'lesson');
 assert.equal(titles[0].matchField,'lesson');
 const subject=search('mathematics',{field:'title'});
 assert.equal(subject[0].lessonId,'l3');
 assert.equal(subject[0].subjectTitle,'Mathematics');
 const description=search('linear algebra',{field:'title',mode:'phrase'});
 assert.equal(description[0].lessonId,'l3');
 assert.equal(description[0].matchField,'description');
});
test('clicking paragraph results has precise lesson and paragraph ids and section positions',()=>{
 const hits=search('الْجُهْد',{field:'translation'});
 assert.equal(hits.length,1);
 assert.equal(hits[0].lessonId,'l2');
 assert.equal(hits[0].sectionId,'s3');
 assert.equal(hits[0].sectionPosition,0);
 assert.equal(hits[0].matchLabel,'الترجمة العربية');
 assert.match(hits[0].excerpt,/الجهد/);
});
test('can constrain search to a specific subject, lesson, original text, translation or explanation',()=>{
 assert.equal(search('Energy',{field:'original',subjectId:'chem'}).length,1);
 assert.equal(search('Energy',{field:'translation'}).length,0);
 assert.equal(search('الفولت',{field:'explanation',lessonId:'l2'})[0].sectionId,'s3');
 assert.equal(search('الفولت',{field:'explanation',lessonId:'l1'}).length,0);
 assert.equal(search('vector',{field:'original',type:'paragraph'})[0].lessonId,'l3');
 assert.equal(search('vector',{type:'lesson'}).length,0);
});
test('matching supports every token, exact phrase, complete words and at least one word',()=>{
 assert.equal(search('energy reaction',{field:'original',mode:'all'}).length,1);
 assert.equal(search('energy conserved',{field:'original',mode:'phrase'}).length,0);
 assert.equal(search('energy is conserved',{field:'original',mode:'phrase'}).length,1);
 assert.equal(search('reaction',{field:'original',mode:'word'}).length,1);
 assert.equal(search('react',{field:'original',mode:'word'}).length,0);
 assert.ok(search('voltage energy',{field:'original',mode:'any'}).length>=2);
 assert.equal(search('electric nonsense',{field:'original',mode:'all'}).length,0);
});
test('results support Arabic and English with safe escaped highlighted snippets',()=>{
 const parts=highlightSearchParts('Oxidation and oxidation', 'oxidation');
 assert.equal(parts.filter(p=>p.highlight).length,2);
 const unsafe=highlightSearchParts('math (1+2) is an equation','(1+2)');
 assert.ok(Array.isArray(unsafe));
 assert.equal(unsafe.map(p=>p.text).join(''),'math (1+2) is an equation');
});
test('all settings are categorized and quickly searchable by title, field or current draft value',()=>{
 const settings=normalizeSiteSettings();
 assert.equal(SETTINGS_PANELS.length,11);
 assert.deepEqual([...new Set(SETTINGS_PANELS.map(p=>p.id))].length,11);
 assert.deepEqual(SETTINGS_GROUPS.map(g=>g.id),['all','access','content','owner']);
 assert.equal(findSettingsPanels(settings,'').length,11);
 assert.deepEqual(findSettingsPanels(settings,'الصفحة الرئيسية').map(p=>p.id),['public']);
 assert.deepEqual(findSettingsPanels(settings,'التذييل').map(p=>p.id),['identity']);
 assert.deepEqual(findSettingsPanels(settings,'ترجمة').map(p=>p.id).includes('sample'),true);
 assert.deepEqual(findSettingsPanels(settings,'', 'owner').map(p=>p.id),['identity','team']);
 assert.deepEqual(findSettingsPanels(settings,'ترتيب القائمة').map(p=>p.id),['sidebar']);
 const withPerson={...settings,team:[{name:'مختص النحو',role:'مدقق'}]};
 assert.deepEqual(findSettingsPanels(withPerson,'مختص النحو').map(p=>p.id),['team']);
 assert.equal(findSettingsPanels(settings,'شيء غير موجود إطلاقا').length,0);
});
test('settings editor renders owner-only permission panel alongside regular collapsible menus and retains save',async()=>{
 const settingsPage=await file('src/components/SiteSettingsPage.jsx');
 const accordion=await file('src/components/SettingsNavigator.jsx');
 assert.equal((settingsPage.match(/<SettingsAccordion panel=/g)||[]).length,12);
 assert.equal((settingsPage.match(/owner-readonly-fieldset/g)||[]).length,2);
 assert.match(settingsPage,/visiblePanelIds\.has\('identity'\)/);
 assert.match(settingsPage,/visiblePanelIds\.has\('team'\)/);
 assert.match(settingsPage,/locked=\{!canEditIdentity\}/);
 assert.match(settingsPage,/locked=\{!canEditTeam\}/);
 assert.match(settingsPage,/onSubmit=\{submit\}/);
 assert.match(settingsPage,/SettingsNavigator query=\{settingsQuery\}/);
 assert.match(accordion,/aria-expanded=\{opened\}/);
 assert.match(accordion,/type="search"/);
 assert.match(accordion,/فتح الكل/);
 assert.match(accordion,/إغلاق الكل/);
});
test('reader UI provides filters, pagination, direct paragraph navigation and progress save',async()=>{
 const app=await file('src/App.jsx');
 const searchPanel=await file('src/components/ReaderAdvancedSearch.jsx');
 assert.match(app,/ReaderAdvancedSearch library=\{library\}/);
 assert.match(app,/const openLesson = \(id, targetSectionId=null\)/);
 assert.match(app,/targetSectionId\?list\.findIndex/);
 assert.match(app,/writeDeviceProgress\(id,resumed\.id/);
 assert.match(searchPanel,/onOpenResult\(result\.lessonId,result\.sectionId\)/);
 assert.match(searchPanel,/SEARCH_FIELDS\.map/);
 assert.match(searchPanel,/SEARCH_MODES\.map/);
 assert.match(searchPanel,/subjectId/);
 assert.match(searchPanel,/lessonId/);
 assert.match(searchPanel,/PAGE_SIZE=15/);
 assert.match(searchPanel,/aria-live="polite"/);
});
