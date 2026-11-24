import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {safeAccountSummaries,accountCacheKey,accountReadFailure} from '../src/lib/accountCache.js';
import {voiceQualityScore,lockVoiceCatalog} from '../src/lib/systemVoices.js';
import {speakParts,isOfflineVoice} from '../src/lib/speech.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
function withBrowser({voices,online,speak},callback){
 const previousWindow=globalThis.window;
 const previousUtterance=globalThis.SpeechSynthesisUtterance;
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const listeners=new Map();
 let cancels=0;
 const synth={
  getVoices:()=>voices,
  cancel:()=>{cancels++},
  speak:speak||(()=>{}),
 };
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:online}});
 globalThis.window={speechSynthesis:synth,
  addEventListener:(name,fn)=>listeners.set(name,fn),
  removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name)}};
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 return Promise.resolve().then(()=>callback({listeners,getCancels:()=>cancels}))
  .finally(()=>{
   if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
   if(previousUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;
   else globalThis.SpeechSynthesisUtterance=previousUtterance;
   if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);
   else delete globalThis.navigator;
  });
}

test('offline account snapshot key is scoped to a specific authenticated administrator',()=>{
 assert.equal(accountCacheKey('alice'),'accounts:admin:alice');
 assert.equal(accountCacheKey('bob'),'accounts:admin:bob');
 assert.throws(()=>accountCacheKey(''));
});
test('cached account summaries cannot contain passwords, access tokens, or emails',()=>{
 const rows=safeAccountSummaries([{
  user_id:'a',username:'teacher',display_name:'Staff',role:'teacher',
  is_owner:false,created_at:'2026-11-24',avatar_path:'/avatar.png',
  password:'never',email:'secret@example.com',access_token:'SECRET'
 }]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].username,'teacher');
 assert.ok(!JSON.stringify(rows).includes('never'));
 assert.ok(!JSON.stringify(rows).includes('SECRET'));
 assert.ok(!JSON.stringify(rows).includes('secret@example'));
});
test('accounts remain cached after network failure and controls are read-only offline',async()=>{
 const ui=await source('src/components/AccountManager.jsx');
 const accounts=await source('src/lib/accounts.js');
 const store=await source('src/lib/offlineStore.js');
 assert.match(ui,/listAccountsWithCache\(currentUserId\)/);
 assert.match(ui,/setAccounts\(result.accounts\)/);
 assert.match(ui,/const readOnly=offlineCopy\|\|networkOffline/);
 assert.match(ui,/disabled=\{busy\|\|readOnly/);
 assert.match(ui,/window.addEventListener\('online',online\)/);
 assert.match(accounts,/readOfflineSnapshot\(key\)/);
 assert.match(accounts,/saveOfflineSnapshot\(key,accounts\)/);
 assert.match(store,/removeOfflineSnapshot\('accounts:admin:'\+userId\)/);
});
test('online voices outrank and completely exclude locally installed voices',()=>{
 const local={name:'Arabic Salma',lang:'ar-SA',localService:true};
 const remote={name:'Arabic Salma Neural Online',lang:'ar-SA',localService:false};
 assert.ok(voiceQualityScore(remote,'ar')>voiceQualityScore(local,'ar'));
 const result=lockVoiceCatalog([remote,local]);
 assert.equal(result.groups.ar.female[0].id,remote.name);
 assert.equal(result.groups.ar.female[0].localService,false);
 const pinned=lockVoiceCatalog([remote,local],{'ar:female:0':{name:local.name,lang:local.lang}});
 assert.equal(pinned.groups.ar.female[0].id,remote.name);
});
test('an unavailable remote speaker never silently becomes a robotic offline speaker',async()=>{
 await withBrowser({
  online:false,voices:[
   {name:'Online Speaker',lang:'ar-SA',localService:false},
   {name:'Installed Speaker',lang:'ar-SA',localService:true}
  ],speak:()=>{throw Error('must not speak remotely when offline')}
 },async()=>{
  let error='';
  speakParts([{lang:'ar-SA',text:'مرحبًا'}],1,()=>{},()=>{},e=>error=e,{ar:'Online Speaker'});
  assert.match(error,/الإنترنت/);
  assert.equal(isOfflineVoice({localService:false}),false);
  assert.equal(isOfflineVoice({localService:true}),true);
 });
});
test('locally installed speakers must never play even while offline or online',async()=>{
 for(const online of [false,true]){
  const played=[];
  await withBrowser({
   online,voices:[{name:'Installed Speaker',lang:'ar-SA',localService:true}],
   speak:u=>{played.push(u);queueMicrotask(()=>{u.onstart?.();u.onend?.()})}
  },async()=>{
   let message='';
   speakParts([{lang:'ar-SA',text:'مرحبًا'}],1,()=>{},()=>{},e=>{message=e},{ar:'Installed Speaker'});
   assert.match(message,/إنترنت|سحابية/);
   assert.equal(played.length,0);
  });
 }
});
test('an active cloud voice stops immediately on an offline event',async()=>{
 let emitted=null;
 await withBrowser({
  online:true,voices:[{name:'Online Speaker',lang:'ar-SA',localService:false}],
  speak:()=>{}
 },async({listeners,getCancels})=>{
  const cancel=speakParts([{lang:'ar-SA',text:'مرحبا'}],1,()=>{},()=>{},msg=>{emitted=msg},{ar:'Online Speaker'});
  const before=getCancels();
  assert.equal(typeof listeners.get('offline'),'function');
  listeners.get('offline')();
  assert.ok(getCancels()>before);
  assert.match(emitted,/أصوات الإنترنت فقط/);
  assert.ok(!listeners.has('offline'));
  cancel();
 });
});

test('account failures do not confuse authorization with a network issue',()=>{
 assert.equal(accountReadFailure({status:403,name:'FunctionsFetchError'},true),'denied');
 assert.equal(accountReadFailure({status:401},true),'denied');
 assert.equal(accountReadFailure({name:'FunctionsFetchError'}),'unreachable');
 assert.equal(accountReadFailure({status:500}),'other');
});
