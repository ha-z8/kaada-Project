import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICE_NAMES,onlineSpeechVoices,groupedSystemVoices,voiceQualityScore,classifyVoiceGender,friendlySystemVoices,lockVoiceCatalog} from '../src/lib/systemVoices.js';

const cloud=(name,lang='ar-SA',voiceURI='')=>({name,lang,voiceURI,localService:false});
const local=(name,lang='ar-SA',voiceURI='')=>({name,lang,voiceURI,localService:true});

test('curated Saudi and British display aliases are all distinct',()=>{
 assert.deepEqual(VOICE_NAMES.ar.male,['محمد','عبدالله','سعود']);
 assert.deepEqual(VOICE_NAMES.ar.female,['نورة','ريم','سارة']);
 assert.deepEqual(VOICE_NAMES.en.male,['Oliver','Harry','George']);
 assert.deepEqual(VOICE_NAMES.en.female,['Amelia','Charlotte','Sophie']);
});
test('only genuinely cloud voices are eligible and there is no local fallback',()=>{
 const voices=[local('Arabic Hamed Natural'),cloud('Arabic Naayf Natural'),
  {name:'Arabic Majed Natural',lang:'ar-SA'},
  cloud('Arabic Layla Neural'),local('English Jenny Natural','en-US')];
 assert.deepEqual(onlineSpeechVoices(voices).map(x=>x.name),
  ['Arabic Naayf Natural','Arabic Layla Neural']);
 const groups=groupedSystemVoices(voices,'ar');
 assert.deepEqual(groups.male.map(v=>v.id),['Arabic Naayf Natural']);
 assert.deepEqual(groups.female.map(v=>v.id),['Arabic Layla Neural']);
 assert.deepEqual(groupedSystemVoices(voices,'en'),{male:[],female:[],other:[]});
 assert.equal(voiceQualityScore(local('Arabic Salma Natural'),'ar'),-1000);
});
test('same underlying remote speaker cannot appear under different names or duplicated API entries',()=>{
 const voices=[cloud('Arabic Salma Neural','ar-SA','provider:speaker-1'),
  cloud('Arabic Layla Neural','ar-SA','provider:speaker-1'),
  cloud('Arabic Salma Neural','ar-SA','provider:speaker-2'),
  cloud('Arabic Zariyah Neural','ar-SA','provider:speaker-3')];
 const eligible=onlineSpeechVoices(voices);
 assert.deepEqual(eligible.map(v=>v.name),['Arabic Salma Neural','Arabic Zariyah Neural']);
 const catalog=lockVoiceCatalog(voices);
 assert.equal(catalog.groups.ar.female[0].id,'Arabic Salma Neural');
 assert.equal(catalog.groups.ar.female[1].id,'Arabic Zariyah Neural');
 assert.equal(catalog.groups.ar.female[2],null);
});
test('actual provider speaker name is shown, never a mismatched invented Saudi name',()=>{
 const groups=groupedSystemVoices([
  cloud('Microsoft Hamed Natural'),cloud('Microsoft Naayf Natural'),
  cloud('Microsoft Salma Natural'),cloud('Microsoft Zariyah Natural')
 ],'ar');
 assert.deepEqual(groups.male.map(v=>v.label),
  ['Microsoft Hamed Natural','Microsoft Naayf Natural']);
 assert.deepEqual(groups.female.map(v=>v.label),
  ['Microsoft Salma Natural','Microsoft Zariyah Natural']);
 assert.equal(friendlySystemVoices([cloud('Microsoft Salma Natural')],'ar')[0].label,
  'Microsoft Salma Natural');
});
test('missing voice or local pinned assignment is released and a real available online voice assigned',()=>{
 const a=cloud('Arabic Salma Neural','ar-SA','speaker:salma');
 const b=cloud('Arabic Layla Neural','ar-SA','speaker:layla');
 const pinned=lockVoiceCatalog([a,b]).assignments;
 assert.equal(pinned['ar:female:0'].name,a.name);
 const replacement=lockVoiceCatalog([local('Arabic Salma Neural'),b],pinned);
 assert.equal(replacement.groups.ar.female[0].id,b.name);
 assert.equal(replacement.groups.ar.female[1],null);
 assert.equal(replacement.assignments['ar:female:0'].name,b.name);
});
test('unknown gender remains unclassified, while Arabic human names are recognized',()=>{
 const groups=groupedSystemVoices([
  cloud('Unidentified voice'),cloud('صوت نورة العربي'),cloud('صوت فهد السعودي')
 ],'ar');
 assert.deepEqual(groups.other.map(v=>v.id),['Unidentified voice']);
 assert.equal(groups.female[0].id,'صوت نورة العربي');
 assert.equal(groups.male[0].id,'صوت فهد السعودي');
 assert.equal(classifyVoiceGender({name:'Mystery Arabic Voice'},'ar'),null);
});
test('premium remote voices outrank old classic voices and Saba is excluded',()=>{
 const top=cloud('Microsoft Salma Natural');
 const old=cloud('Arabic Layla Classic');
 const banned=cloud('Microsoft Saba Classic');
 const groups=groupedSystemVoices([old,banned,top],'ar');
 assert.equal(groups.female[0].id,top.name);
 assert.ok(groups.female.every(v=>v.id!==banned.name));
 assert.ok(voiceQualityScore(top,'ar')>voiceQualityScore(old,'ar'));
});
