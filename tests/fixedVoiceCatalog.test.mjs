import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICE_NAMES,FIXED_VOICE_CATALOG_KEY,lockVoiceCatalog} from '../src/lib/systemVoices.js';
import {speakParts} from '../src/lib/speech.js';

const voices=[
 ...['Hamed','Naayf','Majed'].map(name=>({name:'Arabic '+name+' Natural',lang:'ar-SA',localService:false,voiceURI:'ar-'+name})),
 ...['Salma','Layla','Zariyah'].map(name=>({name:'Arabic '+name+' Natural',lang:'ar-SA',localService:false,voiceURI:'ar-'+name})),
 ...['David','Mark','Guy'].map(name=>({name:'English '+name+' Natural',lang:'en-US',localService:false,voiceURI:'en-'+name})),
 ...['Jenny','Aria','Zira'].map(name=>({name:'English '+name+' Natural',lang:'en-US',localService:false,voiceURI:'en-'+name}))
];

test('all twelve short Saudi and British aliases map to independent genuine provider voices',()=>{
 assert.equal(FIXED_VOICE_CATALOG_KEY,'kaada-fixed-voice-catalog-v1');
 assert.equal(Object.values(VOICE_NAMES).flatMap(v=>[...v.male,...v.female]).length,12);
 const result=lockVoiceCatalog(voices);
 for(const lang of ['ar','en'])for(const gender of ['male','female'])
  for(const [index,selected] of result.groups[lang][gender].entries()){
   assert.ok(selected);
   assert.equal(selected.label,VOICE_NAMES[lang][gender][index]);
   assert.equal(selected.providerName,selected.id);
   assert.ok(voices.some(v=>v.name===selected.id&&v.voiceURI===selected.voiceURI));
   assert.equal(selected.localService,false);
  }
});

test('reordering voices or adding another cannot reassign still-available pinned remote speaker',()=>{
 const original=lockVoiceCatalog(voices);
 const reordered=[{name:'Arabic Ahmed Super Neural',lang:'ar-SA',localService:false,voiceURI:'ar-Ahmed'},...voices].reverse();
 const fresh=lockVoiceCatalog(reordered,original.assignments);
 for(const lang of ['ar','en'])for(const gender of ['male','female'])
  for(let i=0;i<3;i++){
   assert.equal(fresh.groups[lang][gender][i].id,original.groups[lang][gender][i].id);
   assert.equal(fresh.groups[lang][gender][i].voiceURI,original.groups[lang][gender][i].voiceURI);
  }
});

test('unavailable or locally installed pinned speaker is replaced with available cloud option, never ghost choice',()=>{
 const old=lockVoiceCatalog(voices);
 const missing=old.groups.ar.female[0];
 const fewer=lockVoiceCatalog(voices.filter(v=>v.name!==missing.id),old.assignments);
 assert.notEqual(fewer.groups.ar.female[0]?.id,missing.id);
 assert.ok(fewer.groups.ar.female.filter(Boolean).every(v=>v.localService===false));
 assert.equal(fewer.assignments['ar:female:0'].name,fewer.groups.ar.female[0].id);
 const locals=voices.map(v=>v.name===missing.id?{...v,localService:true}:v);
 const filtered=lockVoiceCatalog(locals,old.assignments);
 assert.notEqual(filtered.groups.ar.female[0]?.id,missing.id);
});

test('real remote voices are assigned exactly to speech synthesis utterances',async()=>{
 const previousWindow=globalThis.window,previousUtterance=globalThis.SpeechSynthesisUtterance;
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 class Utterance{constructor(text){this.text=text}}
 const played=[];
 const synthesis={
  getVoices:()=>voices,
  cancel:()=>{},
  speak:u=>{played.push(u);queueMicrotask(()=>{u.onstart?.();u.onend?.()})}
 };
 globalThis.window={speechSynthesis:synthesis,addEventListener(){},removeEventListener(){}};
 globalThis.SpeechSynthesisUtterance=Utterance;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 try{
  const catalog=lockVoiceCatalog(voices);
  for(const language of ['ar','en'])for(const gender of ['female','male'])
   for(const chosen of catalog.groups[language][gender]){
    const part={lang:language==='ar'?'ar-SA':'en-US',text:language==='ar'?'مرحبًا.':'Welcome.'};
    const u=await new Promise((resolve,reject)=>{
     const before=played.length;
     speakParts([part],1,()=>{},()=>resolve(played[before]),reject,{[language]:chosen.id});
    });
    assert.equal(u.voice.name,chosen.id);
    assert.equal(u.voice.voiceURI,chosen.voiceURI);
   }
  assert.equal(played.length,12);
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  if(previousUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=previousUtterance;
  if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;
 }
});

test('a missing explicit voice causes an error and never uses a local voice',()=>{
 const previousWindow=globalThis.window,previousUtterance=globalThis.SpeechSynthesisUtterance;
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 globalThis.window={speechSynthesis:{getVoices:()=>[
  {name:'Arabic Salma',lang:'ar-SA',localService:true}],cancel(){},speak(){throw Error('must not speak')}}
 };
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 let error='';
 try{
  speakParts([{lang:'ar-SA',text:'مرحبًا'}],1,()=>{},()=>{},message=>error=message,{ar:'Arabic Salma'});
  assert.match(error,/لا توجد أصوات سحابية/);
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  if(previousUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=previousUtterance;
  if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;
 }
});
