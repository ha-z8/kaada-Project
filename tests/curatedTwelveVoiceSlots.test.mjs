import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VOICE_NAMES,lockVoiceCatalog,onlineSpeechVoices,classifyVoiceGender} from '../src/lib/systemVoices.js';

const voice=(name,lang,id)=>({name,lang,voiceURI:id,localService:false});
const all=[
 ...['Hamed','Naayf','Majed'].map((name,i)=>voice('Arabic '+name+' Natural','ar-SA','real-ar-m'+i)),
 ...['Salma','Layla','Zariyah'].map((name,i)=>voice('Arabic '+name+' Natural','ar-SA','real-ar-f'+i)),
 ...['David','Mark','Guy'].map((name,i)=>voice('English '+name+' Natural','en-GB','real-en-m'+i)),
 ...['Jenny','Aria','Zira'].map((name,i)=>voice('English '+name+' Natural','en-GB','real-en-f'+i))
];

test('exactly 12 curated Saudi/British display aliases map to twelve distinct true online voices',()=>{
 const result=lockVoiceCatalog(all);
 const used=[];
 for(const lang of ['ar','en'])for(const gender of ['male','female']){
  const group=result.groups[lang][gender];
  assert.equal(group.length,3);
  assert.deepEqual(group.map(v=>v.label),VOICE_NAMES[lang][gender]);
  for(const v of group){
   assert.equal(v.localService,false);
   assert.equal(v.providerName,v.id);
   assert.ok(all.some(raw=>raw.name===v.id&&raw.voiceURI===v.voiceURI));
   used.push(v.voiceURI);
  }
 }
 assert.equal(new Set(used).size,12,'a provider voice may not fill multiple named slots');
});

test('too few independent providers leave fixed empty slots, not duplicate aliases or local fallback',()=>{
 const browser=[
  voice('Arabic Hamed Natural','ar-SA','shared-a'),
  voice('Arabic Naayf Natural','ar-SA','shared-a'),
  voice('Arabic Salma Natural','ar-SA','shared-b'),
  voice('English David Natural','en-GB','shared-a'),
  {...voice('Arabic Layla Natural','ar-SA','local-voice'),localService:true},
  {name:'Unknown voice',lang:'ar-SA',voiceURI:'unknown',localService:false}
 ];
 const selected=lockVoiceCatalog(browser);
 assert.equal(onlineSpeechVoices(browser).filter(v=>v.lang==='ar-SA').length,3);
 assert.equal(selected.groups.ar.male.filter(Boolean).length,1);
 assert.equal(selected.groups.ar.female.filter(Boolean).length,1);
 assert.equal(selected.groups.en.male.filter(Boolean).length,0,
  'cross-language duplicate provider URI must not be reused');
 assert.equal(selected.groups.ar.male[0].label,'محمد');
 assert.equal(selected.groups.ar.male[1],null);
 assert.equal(selected.groups.ar.female[0].label,'نورة');
 assert.equal(selected.groups.ar.female[1],null);
 assert.ok(Object.values(selected.groups).every(group=>group.other.length===0));
});

test('all visible speaker menus show short labels only and never render the extra voices group',async()=>{
 const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
 const ui=await read('src/components/StudyAudioPanel.jsx');
 const about=await read('src/components/AboutNarration.jsx');
 const app=await read('src/App.jsx');
 assert.match(ui,/VOICE_NAMES\[language\]\[key\]\[index\]/);
 assert.match(ui,/Array\.from\(\{length:3\}/);
 assert.match(ui,/غير متوفر على هذا الجهاز/);
 assert.match(ui,/disabled=\{!ready\|\|!online\}/);
 assert.doesNotMatch(ui,/key:'other'|أصوات متصلة إضافية|voice\.name\|\|voice\.id/);
 assert.match(about,/label:v\.label\|\|v\.id/);
 assert.doesNotMatch(about,/fixed\.push\(\{value:voiceName/);
 assert.match(app,/arChoices\.find\(v=>v\.id===selectedArVoice\)/);
 assert.doesNotMatch(app,/const firstOnline=/);
});

test('known UK browser speaker names and explicit Female/Male voice tags are classified accurately',()=>{
 assert.equal(classifyVoiceGender(voice('Microsoft Libby Online Natural','en-GB','en-libby'),'en'),'female');
 assert.equal(classifyVoiceGender(voice('Microsoft Maisie Online Natural','en-GB','en-maisie'),'en'),'female');
 assert.equal(classifyVoiceGender(voice('Microsoft Alfie Online Natural','en-GB','en-alfie'),'en'),'male');
 assert.equal(classifyVoiceGender(voice('Browser English Female Online','en-GB','en-female'),'en'),'female');
 assert.equal(classifyVoiceGender(voice('Browser English Male Online','en-GB','en-male'),'en'),'male');
 const catalog=lockVoiceCatalog([
  voice('English Jenny Natural','en-US','us-jenny'),
  voice('Microsoft Libby Online Natural','en-GB','uk-libby'),
  voice('Microsoft Maisie Online Natural','en-GB','uk-maisie'),
  voice('English David Natural','en-US','us-david'),
  voice('Microsoft Alfie Online Natural','en-GB','uk-alfie')
 ]);
 assert.deepEqual(catalog.groups.en.female.filter(Boolean).map(v=>v.providerName),
  ['Microsoft Libby Online Natural','Microsoft Maisie Online Natural','English Jenny Natural']);
 assert.deepEqual(catalog.groups.en.male.filter(Boolean).map(v=>v.providerName),
  ['Microsoft Alfie Online Natural','English David Natural']);
});
