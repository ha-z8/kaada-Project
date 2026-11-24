import test from 'node:test';
import assert from 'node:assert/strict';
import {getAvailableVoices,speakParts,retryOnlineVoices,ONLINE_VOICE_UNAVAILABLE_EVENT}
 from '../src/lib/speech.js';
import {onlineSpeechVoices,lockVoiceCatalog} from '../src/lib/systemVoices.js';
import {cleanupRetiredVoiceDownloads} from '../src/lib/retiredVoiceCleanup.js';
import {readFile} from 'node:fs/promises';

function browserEnv(voices,onSpeak){
 const oldWindow=globalThis.window;
 const oldSpeech=globalThis.SpeechSynthesisUtterance;
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const listeners=new Map();
 const synth={
  getVoices:()=>voices,cancel(){},speak:onSpeak,
 };
 globalThis.window={speechSynthesis:synth,
  addEventListener(name,callback){listeners.set(name,callback)},
  removeEventListener(name,callback){
   if(listeners.get(name)===callback)listeners.delete(name);
  },
  dispatchEvent(event){listeners.get(event.type)?.(event)}
 };
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 return ()=>{
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
  if(oldSpeech===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=oldSpeech;
  if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);
  else delete globalThis.navigator;
 };
}

test('only remote real voices appear; system voices, unknown voices and repeated providers are filtered',()=>{
 const voices=[
  {name:'Arabic Salma Natural',lang:'ar-SA',voiceURI:'s1',localService:false},
  {name:'Arabic Layla Natural',lang:'ar-SA',voiceURI:'s1',localService:false},
  {name:'Arabic Salma Natural',lang:'ar-SA',voiceURI:'s2',localService:false},
  {name:'Arabic Hamed Natural',lang:'ar-SA',voiceURI:'s3',localService:true},
  {name:'Arabic Naayf Natural',lang:'ar-SA',localService:null},
  {name:'English Jenny Online',lang:'en-US',voiceURI:'s4',localService:false}
 ];
 const restore=browserEnv(voices,()=>{});
 try{
  const available=getAvailableVoices();
  assert.deepEqual(available.map(v=>v.name),
   ['Arabic Salma Natural','English Jenny Online']);
  assert.ok(available.every(v=>v.localService===false));
  const catalog=lockVoiceCatalog(available);
  assert.equal(catalog.groups.ar.female[0].label,'Arabic Salma Natural');
  assert.equal(catalog.groups.ar.male[0],null);
  assert.equal(onlineSpeechVoices(voices,'ar').length,1);
 }finally{restore()}
});

test('a remote voice that fails real utterance is hidden until explicit refresh',async()=>{
 const name='Arabic Salma Neural Remote Failure Sample';
 const voices=[{name,lang:'ar-SA',voiceURI:'test-remote-failure',localService:false}];
 const restore=browserEnv(voices,u=>queueMicrotask(()=>u.onerror?.({error:'voice-unavailable'})));
 retryOnlineVoices();
 try{
  assert.equal(getAvailableVoices().length,1);
  const error=await new Promise(resolve=>{
   speakParts([{lang:'ar-SA',text:'مرحبًا'}],1,()=>{},()=>{},resolve,{ar:name});
  });
  assert.match(error,/استُبعد من القائمة/);
  assert.equal(getAvailableVoices().length,0);
  retryOnlineVoices();
  assert.equal(getAvailableVoices().length,1);
  assert.equal(ONLINE_VOICE_UNAVAILABLE_EVENT,'hsa:online-voice-unavailable');
 }finally{retryOnlineVoices();restore()}
});

test('cleanup deletes only old Piper model directories and runtime cache, not student content',async()=>{
 const oldWindow=globalThis.window;
 const oldCaches=globalThis.caches;
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const removed=[],deleted=[],saved=new Map();
 const root={removeEntry:async(path,options)=>{
  removed.push([path,options.recursive]);
 }};
 Object.defineProperty(globalThis,'navigator',{configurable:true,
  value:{storage:{getDirectory:async()=>root}}});
 globalThis.caches={delete:async(key)=>{deleted.push(key);return true}};
 globalThis.window={localStorage:{
  getItem:key=>saved.get(key)||null,setItem:(key,v)=>saved.set(key,v)
 }};
 try{
  assert.equal(await cleanupRetiredVoiceDownloads(),true);
  assert.deepEqual(removed,[['hsa-voice-models-v2',true],['piper',true]]);
  assert.deepEqual(deleted,['hsa-tts-runtime-v1']);
  assert.equal(await cleanupRetiredVoiceDownloads(),true);
  assert.equal(deleted.length,1);
  const code=await readFile(new URL('../src/lib/retiredVoiceCleanup.js',import.meta.url),'utf8');
  assert.doesNotMatch(code,/indexedDB|localStorage\.clear\(\)|deleteDatabase\(|hsa-shell-|hsa-public-images/);
 }finally{
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
  if(oldCaches===undefined)delete globalThis.caches;else globalThis.caches=oldCaches;
  if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);
  else delete globalThis.navigator;
 }
});

test('offline speech cannot silently substitute an OS-local voice',()=>{
 const voices=[{name:'English Emma Local',lang:'en-US',localService:true}];
 let spoken=false;
 const restore=browserEnv(voices,()=>{spoken=true});
 try{
  let message='';
  speakParts([{lang:'en-US',text:'Testing remote only'}],1,()=>{},()=>{},e=>message=e);
  assert.ok(message.includes('سحابية'));
  assert.equal(spoken,false);
 }finally{restore()}
});
