import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICE_NAMES,FIXED_VOICE_CATALOG_KEY,lockVoiceCatalog} from '../src/lib/systemVoices.js';
import {speakParts} from '../src/lib/speech.js';

const voices=[
 ...['Hamed','Naayf','Majed'].map(name=>({name:'Arabic '+name+' Natural',lang:'ar-SA'})),
 ...['Salma','Layla','Zariyah'].map(name=>({name:'Arabic '+name+' Natural',lang:'ar-SA'})),
 ...['David','Mark','Guy'].map(name=>({name:'English '+name+' Natural',lang:'en-US'})),
 ...['Jenny','Aria','Zira'].map(name=>({name:'English '+name+' Natural',lang:'en-US'})),
];

test('the catalog contains twelve immutable, uniquely named voice slots',()=>{
 assert.equal(FIXED_VOICE_CATALOG_KEY,'kaada-fixed-voice-catalog-v1');
 for(const lang of ['ar','en']){
  for(const gender of ['male','female']){
   assert.equal(VOICE_NAMES[lang][gender].length,3);
   assert.equal(Object.isFrozen(VOICE_NAMES[lang][gender]),true);
  }
 }
 assert.equal(new Set(Object.values(VOICE_NAMES).flatMap(v=>[...v.male,...v.female])).size,12);
});

test('all twelve pinned slots use unique real speakers and retain their exact labels',()=>{
 const result=lockVoiceCatalog(voices);
 let slots=0,used=[];
 for(const lang of ['ar','en'])for(const gender of ['male','female'])for(let index=0;index<3;index++){
  const slot=result.groups[lang][gender][index];
  assert.ok(slot,lang+' '+gender+' slot '+index+' missing');
  assert.equal(slot.label,VOICE_NAMES[lang][gender][index]);
  assert.ok(voices.some(v=>v.name===slot.id&&v.lang===slot.lang));
  assert.equal(result.assignments[`${lang}:${gender}:${index}`].name,slot.id);
  slots++;used.push(slot.id);
 }
 assert.equal(slots,12);
 assert.equal(new Set(used).size,12);
});

test('OS reorder and a higher-quality newly installed voice cannot remap existing speaker names',()=>{
 const original=lockVoiceCatalog(voices);
 const renamed=[{name:'Arabic Ahmed Super Neural',lang:'ar-SA'},...voices].reverse();
 const fresh=lockVoiceCatalog(renamed,original.assignments);
 for(const lang of ['ar','en'])for(const gender of ['male','female'])for(let index=0;index<3;index++){
  assert.equal(fresh.groups[lang][gender][index].id,original.groups[lang][gender][index].id);
  assert.equal(fresh.groups[lang][gender][index].label,original.groups[lang][gender][index].label);
 }
 assert.deepEqual(fresh.assignments,original.assignments);
});

test('missing installed speaker becomes disabled and the previously pinned identity is restored when it returns',()=>{
 const original=lockVoiceCatalog(voices);
 const missing=original.groups.ar.female[0];
 const absent=lockVoiceCatalog(voices.filter(v=>v.name!==missing.id),original.assignments);
 assert.equal(absent.groups.ar.female[0],null);
 assert.equal(absent.groups.ar.female[1].id,original.groups.ar.female[1].id);
 assert.equal(absent.groups.ar.female[2].id,original.groups.ar.female[2].id);
 assert.deepEqual(absent.assignments,original.assignments);
 const back=lockVoiceCatalog(voices,absent.assignments);
 assert.equal(back.groups.ar.female[0].id,missing.id);
 assert.equal(lockVoiceCatalog([],original.assignments).groups.ar.female[0],null);
});

test('all twelve chosen pinned voices are used by speech synthesis, not a substitute',async()=>{
 const previousWindow=globalThis.window,previousUtterance=globalThis.SpeechSynthesisUtterance;
 class Utterance{constructor(text){this.text=text}}
 const played=[];
 const synthesis={
  getVoices:()=>voices,
  cancel:()=>{},
  speak:u=>{played.push(u);queueMicrotask(()=>{u.onstart?.();u.onend?.()})},
 };
 globalThis.window={speechSynthesis:synthesis};globalThis.SpeechSynthesisUtterance=Utterance;
 try{
  const catalog=lockVoiceCatalog(voices);
  for(const language of ['ar','en'])for(const gender of ['female','male'])for(let index=0;index<3;index++){
   const chosen=catalog.groups[language][gender][index];
   const part={lang:language==='ar'?'ar-SA':'en-US',text:language==='ar'?'مرحبا بكم في الدرس.':'Welcome to the lesson.'};
   const voice=await new Promise((resolve,reject)=>{
     const before=played.length;
     speakParts([part],1,()=>{},()=>resolve(played[before]?.voice),reject,{[language]:chosen.id});
   });
   assert.equal(voice?.name,chosen.id);
   assert.equal(voice?.lang,chosen.lang);
  }
  assert.equal(played.length,12);
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  if(previousUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=previousUtterance;
 }
});

test('a missing explicit voice causes a clear error and does not play a different voice',()=>{
 const previousWindow=globalThis.window,previousUtterance=globalThis.SpeechSynthesisUtterance;
 class Utterance{constructor(text){this.text=text}}
 let didSpeak=false,seenError='';
 globalThis.window={speechSynthesis:{getVoices:()=>[{name:'Arabic Salma',lang:'ar-SA'}],cancel:()=>{},speak:()=>{didSpeak=true}}};
 globalThis.SpeechSynthesisUtterance=Utterance;
 try{
  speakParts([{lang:'ar-SA',text:'مرحبًا'}],1,()=>{},()=>{},message=>{seenError=message},{ar:'Arabic Hamed'});
  assert.equal(didSpeak,false);
  assert.match(seenError,/غير متوفر/);
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  if(previousUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=previousUtterance;
 }
});
