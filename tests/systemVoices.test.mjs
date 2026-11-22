import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICE_NAMES,groupedSystemVoices,voiceQualityScore,classifyVoiceGender,friendlySystemVoices} from '../src/lib/systemVoices.js';
test('Saudi and American labels have exactly 3 distinct women and 3 men per language',()=>{
 for(const lang of ['ar','en']){
   assert.equal(VOICE_NAMES[lang].male.length,3);
   assert.equal(VOICE_NAMES[lang].female.length,3);
   assert.equal(new Set([...VOICE_NAMES[lang].male,...VOICE_NAMES[lang].female]).size,6);
 }
 assert.deepEqual(VOICE_NAMES.ar.male,['فهد','سعود','راشد']);
 assert.deepEqual(VOICE_NAMES.ar.female,['نورة','ريم','سارة']);
 assert.deepEqual(VOICE_NAMES.en.male,['James','Liam','Noah']);
 assert.deepEqual(VOICE_NAMES.en.female,['Emma','Olivia','Sophia']);
 assert.ok(!JSON.stringify(VOICE_NAMES.ar).includes('سبا'));
});
test('only actual installed and accurately categorized voices are selectable',()=>{
 const names=['Hamed','Naayf','Shakir','Majed','Zariyah','Salma','Layla','Maryam'];
 const voices=names.map(name=>({name:'Microsoft '+name+' Natural - Arabic',lang:'ar-SA'}));
 const selected=groupedSystemVoices(voices,'ar');
 assert.deepEqual(selected.male.map(v=>v.label),['فهد','سعود','راشد']);
 assert.deepEqual(selected.female.map(v=>v.label),['نورة','ريم','سارة']);
 assert.equal(selected.male.length,3);
 assert.equal(selected.female.length,3);
 assert.ok([...selected.male,...selected.female].every(v=>voices.some(x=>x.name===v.id)));
 assert.ok([...selected.male,...selected.female].every(v=>!v.label.includes('Microsoft')));
});
test('missing voice slots are not faked and unknown genders remain separate',()=>{
 const list=groupedSystemVoices([{name:'Unknown Arabic System Voice',lang:'ar-SA'}],'ar');
 assert.equal(list.female.length,0);
 assert.equal(list.male.length,0);
 assert.equal(list.other.length,1);
 assert.deepEqual(groupedSystemVoices([], 'en'),{male:[],female:[],other:[]});
 assert.equal(classifyVoiceGender({name:'Mystery Arabic Voice'},'ar'),null);
});
test('prefer premium neural/natural OS voices instead of old low-quality robotic voice',()=>{
 const fast={name:'Microsoft Salma Neural',lang:'ar-SA'};
 const legacy={name:'Microsoft Saba Classic',lang:'ar-SA'};
 assert.ok(voiceQualityScore(fast,'ar')>voiceQualityScore(legacy,'ar'));
 const g=groupedSystemVoices([legacy,fast,{name:'Layla',lang:'ar-SA'}],'ar');
 assert.equal(g.female[0].id,fast.name);
 assert.equal(g.female.length,2);
 assert.ok(g.female.every(v=>v.id!==legacy.name));
});
test('American male and female voices have independent catalog labels',()=>{
 const names=['David','Mark','Guy','Jenny','Aria','Zira'];
 const selected=groupedSystemVoices(names.map(name=>({name,lang:'en-US'})),'en');
 assert.deepEqual(selected.male.map(v=>v.label),['James','Liam','Noah']);
 assert.deepEqual(selected.female.map(v=>v.label),['Emma','Olivia','Sophia']);
 assert.equal(friendlySystemVoices(names.map(name=>({name,lang:'en-US'})),'en').length,3);
});
test('explicit available voice metadata is respected when present',()=>{
 assert.equal(classifyVoiceGender({name:'Different Voice',gender:'female'},'ar'),'female');
 assert.equal(classifyVoiceGender({name:'Different Voice',gender:'male'},'en'),'male');
 assert.equal(groupedSystemVoices([{name:'English Jenny',lang:'en-US'}],'ar').male.length,0);
});
