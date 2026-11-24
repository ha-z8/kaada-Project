import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onlineSpeechVoices,groupedSystemVoices,lockVoiceCatalog} from '../src/lib/systemVoices.js';

const text=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const remote=(name,lang,uri)=>({name,lang,voiceURI:uri,localService:false});

test('actual free browser-provided speakers vary by browser; never synthesize fake missing speakers',()=>{
 const firstBrowser=[
  remote('Browser A Hamed','ar-SA','ar-person-a'),
  remote('Browser A Salma','ar-SA','ar-person-b'),
  remote('Browser A Salma duplicate','ar-SA','ar-person-b'),
  {name:'Browser A local male',lang:'ar-SA',voiceURI:'local',localService:true},
  remote('Browser A Jenny','en-US','en-person-a')
 ];
 const anotherBrowser=[
  remote('Browser B Majed','ar-SA','ar-person-c'),
  remote('Browser B Layla','ar-SA','ar-person-d'),
  remote('Browser B Zariyah','ar-SA','ar-person-e')
 ];
 assert.deepEqual(onlineSpeechVoices(firstBrowser).map(x=>x.name),
  ['Browser A Hamed','Browser A Salma','Browser A Jenny']);
 const a=groupedSystemVoices(firstBrowser,'ar');
 assert.deepEqual(a.male.map(v=>v.label),['Browser A Hamed']);
 assert.deepEqual(a.female.map(v=>v.label),['Browser A Salma']);
 assert.deepEqual(a.other,[]);
 assert.equal(a.male.length,1,'no invented male speakers to fill three slots');
 const b=groupedSystemVoices(anotherBrowser,'ar');
 assert.deepEqual(b.male.map(v=>v.label),['Browser B Majed']);
 assert.deepEqual(b.female.map(v=>v.label),['Browser B Layla','Browser B Zariyah']);
 const catalogA=lockVoiceCatalog(firstBrowser);
 const catalogB=lockVoiceCatalog(anotherBrowser,catalogA.assignments);
 assert.equal(catalogA.groups.ar.male[0]?.id,'Browser A Hamed');
 assert.equal(catalogB.groups.ar.male[0]?.id,'Browser B Majed');
 assert.equal(catalogB.groups.ar.female.filter(Boolean).length,2);
});

test('UI makes free no-key device variability and missing speakers clear; narration mirrors it',async()=>{
 const ui=await text('src/components/StudyAudioPanel.jsx');
 const about=await text('src/components/AboutNarration.jsx');
 const app=await text('src/App.jsx');
 assert.match(ui,/من المتصفح مجانًا/);
 assert.match(ui,/بلا مفاتيح أو اشتراكات/);
 assert.match(ui,/قد لا تتوفر الأصوات الاثنا عشر كلها/);
 assert.match(ui,/تختلف الأصوات المتوفرة حسب الجهاز والمتصفح/);
 assert.match(ui,/ما نكرر صوتًا واحدًا تحت أسماء مختلفة/);
 assert.match(ui,/لا تُستخدم أصوات الجهاز المحلية/);
 assert.match(ui,/تحديث قائمة الأصوات المتصلة/);
 assert.match(about,/قد تختلف نبرته أو لا يتوفر في متصفح جهاز آخر/);
 assert.match(app,/lockVoiceCatalog\(installedVoices,voiceAssignments\)/);
 assert.doesNotMatch(app,/cloudVoiceGroups|cloudTtsStatus|GOOGLE_CLOUD_TTS_API_KEY/);
 assert.doesNotMatch(ui,/FixedCloudVoices|cloudEnabled|cloudStatus/);
});
