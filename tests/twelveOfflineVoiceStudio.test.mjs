import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VOICE_NAMES,lockVoiceCatalog} from '../src/lib/systemVoices.js';
import {speakParts,getAvailableVoices} from '../src/lib/speech.js';

const src=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const originalVoices=[
 ...['Hamed','Naayf','Majed'].map(name=>({name:'Arabic '+name+' Natural',lang:'ar-SA',localService:false})),
 ...['Salma','Layla','Zariyah'].map(name=>({name:'Arabic '+name+' Natural',lang:'ar-SA',localService:false})),
 ...['David','Mark','Guy'].map(name=>({name:'English '+name+' Natural',lang:'en-US',localService:false})),
 ...['Jenny','Aria','Zira'].map(name=>({name:'English '+name+' Natural',lang:'en-US',localService:false})),
];

test('all original Arabic/English female/male voice names and group slots are preserved',()=>{
 assert.deepEqual(VOICE_NAMES.ar.male,['محمد','عبدالله','سعود']);
 assert.deepEqual(VOICE_NAMES.ar.female,['نورة','ريم','سارة']);
 assert.deepEqual(VOICE_NAMES.en.male,['Oliver','Harry','George']);
 assert.deepEqual(VOICE_NAMES.en.female,['Amelia','Charlotte','Sophie']);
 const catalog=lockVoiceCatalog(originalVoices);
 for(const lang of ['ar','en'])for(const gender of ['male','female']){
  const slots=catalog.groups[lang][gender];
  assert.equal(slots.length,3);
  assert.ok(slots.every(x=>x?.id&&x.localService===false));
  assert.deepEqual(slots.map(x=>x.label),VOICE_NAMES[lang][gender]);
  assert.equal(new Set(slots.map(x=>x.voiceURI||x.id)).size,3);
 }
});

test('browser neural/online voices remain available, with their real id, not downloaded model alias',()=>{
 const chosen=lockVoiceCatalog(originalVoices).groups;
 assert.equal(chosen.ar.female[0].id,'Arabic Salma Natural');
 assert.equal(chosen.en.male[0].id,'English David Natural');
 assert.ok(Object.values(chosen).every(groups=>
  [...groups.male,...groups.female].every(v=>!v.id.startsWith('piper:'))));
});

test('original online voices are passed as the exact English and Arabic SpeechSynthesisUtterance.voice',async()=>{
 const priorWindow=globalThis.window;
 const priorCtor=globalThis.SpeechSynthesisUtterance;
 const priorNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const selected=[];
 const voiceList=[{name:'English Jenny Online Natural',lang:'en-US',localService:false},
  {name:'Arabic Salma Neural Online',lang:'ar-SA',localService:false}];
 class Utterance{constructor(text){this.text=text;}}
 const synth={getVoices:()=>voiceList,cancel(){},speak(utterance){
  selected.push({voice:utterance.voice?.name,text:utterance.text});
  queueMicrotask(()=>{utterance.onstart?.();utterance.onend?.()});
 }};
 globalThis.window={speechSynthesis:synth,addEventListener(){},removeEventListener(){}};
 globalThis.SpeechSynthesisUtterance=Utterance;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 try{
  assert.deepEqual(getAvailableVoices().map(v=>v.name),voiceList.map(v=>v.name));
  await new Promise((resolve,reject)=>{
   speakParts([
    {lang:'en-US',text:'Welcome to the lesson.'},
    {lang:'ar-SA',text:'مرحبًا بكم في الدرس.'}
   ],1,()=>{},resolve,reject,{en:voiceList[0].name,ar:voiceList[1].name});
  });
  assert.deepEqual(selected.map(x=>x.voice),voiceList.map(v=>v.name));
 }finally{
  if(priorWindow===undefined)delete globalThis.window;
  else globalThis.window=priorWindow;
  if(priorCtor===undefined)delete globalThis.SpeechSynthesisUtterance;
  else globalThis.SpeechSynthesisUtterance=priorCtor;
  if(priorNavigator)Object.defineProperty(globalThis,'navigator',priorNavigator);
  else delete globalThis.navigator;
 }
});

test('the voice panel and About share the original browser voice selection with no download buttons',async()=>{
 const ui=await src('src/components/StudyAudioPanel.jsx');
 const about=await src('src/components/AboutNarration.jsx');
 const app=await src('src/App.jsx');
 assert.match(ui,/VOICE_NAMES\[language\]\[key\]\[index\]/);
 assert.match(ui,/onPreview\(language,id\)/);
 assert.match(ui,/title="الأصوات"/);
 assert.match(ui,/صوت متصل مستقل/);
 assert.doesNotMatch(ui,/أصوات محلية إضافية/);
 assert.match(app,/narrationVoice=\{effectiveArVoice\}/);
 assert.match(about,/\{ar:voiceNameRef\.current\}/);
 assert.doesNotMatch(ui,/installOfflineVoice|OfflineModelCatalog|piper/);
 assert.doesNotMatch(app,/installOfflineVoice|OFFLINE_VOICE_PACKS/);
});
