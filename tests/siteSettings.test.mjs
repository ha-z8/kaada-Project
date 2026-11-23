import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SITE_SETTINGS,normalizeSiteSettings,socialHref,normalizeSocials} from '../src/lib/siteSettings.js';

test('defaults explain actual HSA study features and preserve the starter project owner',()=>{
 const settings=normalizeSiteSettings();
 assert.equal(settings.siteName,'HSA 4 Study');
 assert.match(settings.aboutIntro,/شرح ثنائي اللغة/);
 assert.equal(settings.team[0].name,'هزاع الهزاع');
 assert.deepEqual(settings.team[0].socials.map(s=>s.platform),['github']);
 assert.equal(settings.socials.length,0);
});
test('site settings accept customized identity, public socials and contributors',()=>{
 const custom=normalizeSiteSettings({
  siteName:'HSA Academy',footerText:'مشروع تعليمي',
  team:[{id:'abc',name:' عضو جديد ',role:'مترجم',bio:'تحرير المحتوى',socials:[{platform:'instagram',url:'https://www.instagram.com/example/'}]}],
  socials:[{platform:'youtube',url:'https://www.youtube.com/@example'}]
 });
 assert.equal(custom.siteName,'HSA Academy');
 assert.equal(custom.footerText,'مشروع تعليمي');
 assert.equal(custom.team.length,1);
 assert.equal(custom.team[0].name,'عضو جديد');
 assert.equal(custom.team[0].socials[0].platform,'instagram');
 assert.equal(custom.socials.length,1);
});
test('invalid protocols and dangerous hrefs cannot be rendered',()=>{
 assert.equal(socialHref('website','javascript:alert(1)'),'');
 assert.equal(socialHref('github','data:text/html,hi'),'');
 assert.equal(socialHref('website','http://example.com'),'');
 assert.equal(socialHref('website','https://alice:secret@example.com'),'');
 assert.equal(socialHref('email','not-an-email'),'');
 assert.equal(socialHref('email','team@example.com'),'mailto:team@example.com');
 assert.equal(socialHref('github','https://github.com/ha-z8'),'https://github.com/ha-z8');
 assert.deepEqual(normalizeSocials([{platform:'website',url:'javascript:alert(1)'}]),[]);
});
test('long administrator-generated strings are bounded',()=>{
 const s=normalizeSiteSettings({siteName:'A'.repeat(900),aboutIntro:'B'.repeat(10000),team:[{name:'C'.repeat(200),role:'D'.repeat(300),bio:'E'.repeat(1000)}]});
 assert.equal(s.siteName.length,80);
 assert.equal(s.aboutIntro.length,1600);
 assert.equal(s.team[0].name.length,100);
 assert.equal(s.team[0].role.length,120);
 assert.equal(s.team[0].bio.length,500);
});
test('empty team removes sample credits instead of reintroducing them',()=>{
 assert.deepEqual(normalizeSiteSettings({team:[]}).team,[]);
});
