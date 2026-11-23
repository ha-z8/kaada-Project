import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SITE_SETTINGS,normalizeSiteSettings,socialHref,normalizeSocials,ABOUT_SECTION_IDS,SOCIAL_PLATFORMS} from '../src/lib/siteSettings.js';
import {SOCIAL_BRANDS} from '../src/lib/socialBrands.js';

test('default About page teaches public entry and device progress while crediting team',()=>{
 const settings=normalizeSiteSettings();
 assert.equal(settings.siteName,'HSA 4 Study');
 assert.match(settings.steps[0].text,/دون إنشاء حساب/);
 assert.match(settings.steps[1].text,/لوحة المذاكرة/);
 assert.match(settings.steps.at(-1).text,/المحفوظ محليًا/);
 assert.ok(settings.features.length>=7);
 assert.equal(settings.team[0].name,'هزاع الهزاع');
 assert.deepEqual(settings.team[0].socials.map(s=>s.platform),['github']);
 assert.deepEqual(settings.sectionOrder,ABOUT_SECTION_IDS);
});
test('About settings do not expose legacy HSA official socials',()=>{
 const settings=normalizeSiteSettings({
  socials:[{platform:'instagram',url:'https://www.instagram.com/sample'}],
  team:[{name:'كاتب',role:'كاتب محتوى',socials:[{platform:'instagram',url:'https://www.instagram.com/person'}]}],
 });
 assert.equal(Object.hasOwn(settings,'socials'),false);
 assert.equal(settings.team[0].socials[0].platform,'instagram');
});
test('all section labels, guide paragraphs, cards and example can be fully customized',()=>{
 const result=normalizeSiteSettings({
  aboutEyebrow:'مرحبًا',featuresTitle:'مميزات جديدة',stepsTitle:'الدليل',
  highlights:[{id:'h1',text:'أهلًا'}],
  features:[{id:'f1',icon:'heart',title:'الميزة الأولى',text:'تفاصيل قابلة للتحرير'}],
  steps:[{id:'s1',title:'الخطوة الأولى',text:'نص جديد'}],
  notes:[{id:'n1',text:'تذكير'}],
  sampleEnglish:'Hello',sampleArabic:'مرحبًا',teamTitle:'المشاركون',
  sectionOrder:['team','steps','features'],hiddenSections:['sample','notes','invalid'],
 });
 assert.equal(result.aboutEyebrow,'مرحبًا');
 assert.equal(result.featuresTitle,'مميزات جديدة');
 assert.equal(result.stepsTitle,'الدليل');
 assert.equal(result.highlights[0].text,'أهلًا');
 assert.equal(result.features[0].icon,'heart');
 assert.equal(result.steps[0].text,'نص جديد');
 assert.equal(result.notes[0].text,'تذكير');
 assert.equal(result.sampleEnglish,'Hello');
 assert.equal(result.teamTitle,'المشاركون');
 assert.deepEqual(result.sectionOrder.slice(0,3),['team','steps','features']);
 assert.deepEqual(result.hiddenSections,['sample','notes']);
 assert.equal(result.sectionOrder.length,6);
});
test('invalid protocols and unsafe social hrefs cannot be rendered',()=>{
 assert.equal(socialHref('website','javascript:alert(1)'),'');
 assert.equal(socialHref('github','data:text/html,hi'),'');
 assert.equal(socialHref('website','http://example.com'),'');
 assert.equal(socialHref('website','https://alice:secret@example.com'),'');
 assert.equal(socialHref('email','not-an-email'),'');
 assert.equal(socialHref('email','team@example.com'),'mailto:team@example.com');
 assert.equal(socialHref('github','https://github.com/ha-z8'),'https://github.com/ha-z8');
 assert.deepEqual(normalizeSocials([{platform:'website',url:'javascript:alert(1)'}]),[]);
});
test('original platform vector marks are embedded locally for all brands',()=>{
 for(const {id} of SOCIAL_PLATFORMS){
  if(id==='email'||id==='website')continue;
  assert.ok(SOCIAL_BRANDS[id]?.paths?.length>0,'missing original logo '+id);
  assert.ok(SOCIAL_BRANDS[id].paths.every(path=>typeof path==='string'&&path.length>40));
 }
});
test('long editor strings and collections have bounded sizes',()=>{
 const s=normalizeSiteSettings({
  siteName:'A'.repeat(900),aboutIntro:'B'.repeat(10000),
  features:Array.from({length:30},(_,i)=>({id:'f'+i,title:'X'.repeat(1000),text:'Y'.repeat(2000)})),
  steps:Array.from({length:28},(_,i)=>({id:'s'+i,title:'Title',text:'Message'})),
  team:[{name:'C'.repeat(200),role:'D'.repeat(300),bio:'E'.repeat(1000)}],
 });
 assert.equal(s.siteName.length,80);
 assert.equal(s.aboutIntro.length,2000);
 assert.equal(s.features.length,20);
 assert.equal(s.features[0].title.length,130);
 assert.equal(s.features[0].text.length,700);
 assert.equal(s.steps.length,24);
 assert.equal(s.team[0].name.length,100);
 assert.equal(s.team[0].role.length,120);
 assert.equal(s.team[0].bio.length,500);
});
test('empty team, feature list and steps remain intentionally empty',()=>{
 const result=normalizeSiteSettings({team:[],features:[],steps:[],notes:[],highlights:[]});
 assert.deepEqual(result.team,[]);
 assert.deepEqual(result.features,[]);
 assert.deepEqual(result.steps,[]);
 assert.deepEqual(result.notes,[]);
 assert.deepEqual(result.highlights,[]);
});
test('published About component contains no privileged administrative workflow',async()=>{
 const about=await readFile(new URL('../src/components/AboutPage.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(about,/site\.socials/);
 assert.doesNotMatch(about,/المشرف|صلاحيات الإدارة|إدارة المستخدمين|إعداد شرح تلقائي/);
 assert.match(about,/site\.sectionOrder\.map\(renderSection\)/);
 assert.match(about,/member\.socials/);
});
