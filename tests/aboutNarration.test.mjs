import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SITE_SETTINGS,normalizeSiteSettings} from '../src/lib/siteSettings.js';
import {buildAboutNarration,aboutNarrationChunks} from '../src/lib/aboutNarration.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('about narrator covers every visible section in actual page order including team',()=>{
 const site=normalizeSiteSettings(DEFAULT_SITE_SETTINGS);
 const narration=buildAboutNarration(site);
 assert.deepEqual(narration.map(x=>x.id),['intro',...site.sectionOrder,'closing']);
 assert.ok(narration.every(x=>x.text.trim().length>20));
 assert.match(narration[0].text,/بداية|أهلًا بك|خطوة بخطوة/);
 assert.ok(narration.some(x=>x.id==='team'&&x.text.includes('هزاع الهزاع')));
});
test('features, all usage steps, highlights and notes are explained, not just section titles',()=>{
 const site=normalizeSiteSettings(DEFAULT_SITE_SETTINGS);
 const text=buildAboutNarration(site).map(x=>x.text).join(' ');
 for(const feature of site.features)assert.ok(text.includes(feature.title),feature.title);
 for(const step of site.steps){
  const spoken=step.text.replace(/\\bEnglish\\b/gi,'اللغة الإنجليزية');
  assert.ok(text.includes(spoken),step.title);
 }
 for(const note of site.notes)assert.ok(text.includes(note.text));
 for(const item of site.highlights)assert.ok(text.includes(item.text));
 assert.ok(text.includes(site.mission));
 assert.ok(text.includes(site.sampleArabic));
 assert.ok(text.includes(site.sampleFoot));
 assert.ok(text.includes(site.footerNote));
});
test('narration respects developer-hidden sections and reorder, and uses edited current text',()=>{
 const site=normalizeSiteSettings({
  ...DEFAULT_SITE_SETTINGS,
  aboutTitle:'مرحبًا بالمتعلم',
  sectionOrder:['notes','steps','mission','features','team','sample'],
  hiddenSections:['mission','team'],
  notes:[{id:'unique',text:'الانتباه لآخر تحديث داخل المادة'}],
  steps:[{id:'step',title:'اختر الموضوع',text:'ثم ابدأ الاستماع'}]
 });
 const narration=buildAboutNarration(site);
 assert.deepEqual(narration.map(x=>x.id),['intro','notes','steps','features','sample','closing']);
 assert.ok(narration[0].text.includes('مرحبًا بالمتعلم'));
 assert.ok(narration.find(x=>x.id==='notes').text.includes('الانتباه لآخر تحديث داخل المادة'));
 assert.ok(narration.find(x=>x.id==='steps').text.includes('ثم ابدأ الاستماع'));
 assert.ok(!narration.some(x=>x.text.includes('هزاع الهزاع')));
});
test('the Arabic sample is explained in Arabic without reading full English text in Arabic voice',()=>{
 const site=normalizeSiteSettings({
  ...DEFAULT_SITE_SETTINGS,
  sampleEnglish:'A technical term only in English that does not appear in Arabic.',
  sampleArabic:'هذا مثال باللغة العربية لتوضيح فهم المصطلح.'
 });
 const sample=buildAboutNarration(site).find(x=>x.id==='sample');
 assert.ok(sample.text.includes('هذا مثال باللغة العربية لتوضيح فهم المصطلح.'));
 assert.ok(!sample.text.includes('A technical term only in English'));
 const chunks=aboutNarrationChunks(site);
 assert.ok(chunks.length>6);
 assert.ok(chunks.every(x=>x.lang==='ar-SA'&&x.text.length<=190));
 assert.deepEqual([...new Set(chunks.map(x=>x.sectionId))],buildAboutNarration(site).map(x=>x.id));
});
test('About page auto mounts narration only on live page, never inside settings preview',async()=>{
 const about=await read('src/components/AboutPage.jsx');
 const narration=await read('src/components/AboutNarration.jsx');
 assert.match(about,/\{!preview&&<AboutNarration settings=\{settings\}\/>\}/);
 assert.match(narration,/useEffect\(\(\)=>\{/);
 assert.match(narration,/setTimeout\(\(\)=>\{/);
 assert.match(narration,/else startAt\(0\)/);
 assert.match(narration,/speakParts\(selected,rateRef\.current/);
 assert.match(narration,/return\(\)=>\{/);
 assert.match(narration,/cancel\(\);/);
 assert.match(narration,/speechSynthesis\.getVoices\(\)/);
 assert.match(narration,/voiceschanged/);
 assert.match(narration,/المتصفح منع بدء الصوت تلقائيًا/);
});
test('bottom narration player has pause, resume, mute, stop, restart, sections and speed controls',async()=>{
 const component=await read('src/components/AboutNarration.jsx');
 const css=await read('src/styles.css');
 for(const phrase of ['إيقاف الشرح مؤقتًا','استئناف الشرح','تشغيل الشرح',
  'إيقاف الصوت','إعادة الشرح من البداية','كتم الصوت','إلغاء كتم الصوت',
  'القسم السابق','القسم التالي','سرعة الشرح'])assert.ok(component.includes(phrase),phrase);
 assert.match(component,/aria-valuenow=\{percentage\}/);
 assert.match(component,/localStorage\.setItem\(MUTE_STORAGE_KEY,'true'\)/);
 assert.match(component,/localStorage\.removeItem\(MUTE_STORAGE_KEY\)/);
 assert.match(component,/window\.speechSynthesis\.pause\(\)/);
 assert.match(component,/window\.speechSynthesis\.resume\(\)/);
 assert.match(css,/\.about-narration\{\s*position:fixed/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/\.about-page:has\(\.about-narration\)\{padding-bottom:/);
});
test('staff-facing language consistently uses هيئة التدريس and not the shorthand التدريس',async()=>{
 const files=[
  'src/App.jsx','src/components/AccountManager.jsx',
  'src/components/MyAccountSettings.jsx','src/lib/siteSettings.js','src/components/SiteSettingsPage.jsx'
 ];
 for(const file of files){
  const source=await read(file);
  assert.doesNotMatch(source,/دخول المشرفين والتدريس/,'old login button in '+file);
  assert.doesNotMatch(source,/أعضاء التدريس/,'old staff role in '+file);
  assert.doesNotMatch(source,/عضو تدريس(?!\S)/,'old individual role in '+file);
  assert.doesNotMatch(source,/فريق التدريس/,'old team label in '+file);
 }
 const app=await read('src/App.jsx');
 assert.match(app,/دخول المشرفين وهيئة التدريس/);
 assert.match(app,/أعضاء هيئة التدريس/);
});
