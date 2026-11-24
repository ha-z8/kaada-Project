import test from 'node:test';
import assert from 'node:assert/strict';
import {compatibleNativeVoices,compatibleVoiceGroups,INDEPENDENT_VOICE_IDS,speakAdaptiveParts,retryOnlineVoices} from '../src/lib/speech.js';
test('automatic speech uses only the requested language even with OS voices',()=>{
 const voices=[{name:'English system',lang:'en-US',localService:true},{name:'Arabic system',lang:'ar-SA',localService:true},{name:'Arabic Natural',lang:'ar-SA',localService:false}];
 assert.deepEqual(compatibleNativeVoices(voices,'ar').map(x=>x.name),['Arabic Natural','Arabic system']);
 assert.equal(compatibleVoiceGroups({female:[],male:[]},'ar').other[0].id,'compat:ar');
 assert.notEqual(INDEPENDENT_VOICE_IDS.ar,INDEPENDENT_VOICE_IDS.en);
});
test('mixed playback falls back from unavailable Arabic online voice to Arabic system voice, then English',async()=>{
 const oldWindow=globalThis.window,oldUtterance=globalThis.SpeechSynthesisUtterance,oldNav=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const voices=[{name:'broken ar',lang:'ar-SA',voiceURI:'broken-test',localService:false},{name:'system ar',lang:'ar-SA',voiceURI:'local-test',localService:true},{name:'English',lang:'en-GB',voiceURI:'en-test',localService:false}];
 const actual=[];globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 globalThis.window={speechSynthesis:{getVoices:()=>voices,cancel(){},speak(u){queueMicrotask(()=>{if(u.voice.name==='broken ar'){u.onerror?.({error:'voice-unavailable'});return;}actual.push([u.voice.name,u.text]);u.onstart?.();u.onend?.();})}},addEventListener(){},removeEventListener(){},dispatchEvent(){}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 try{await new Promise((resolve,reject)=>speakAdaptiveParts([{lang:'ar-SA',text:'مرحبا'},{lang:'en-US',text:'Hello'}],1,()=>{},resolve,e=>reject(Error(e)),{ar:'broken ar',en:'English'}));assert.deepEqual(actual,[['system ar','مرحبا'],['English','Hello']]);}
 finally{retryOnlineVoices();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=oldUtterance;if(oldNav)Object.defineProperty(globalThis,'navigator',oldNav);else delete globalThis.navigator}
});

test('prepared independent speakers appear separately from the original remote names',()=>{const groups=compatibleVoiceGroups({female:[],male:[]},'ar',{ar:true});assert.equal(groups.other[1].id,'compat:ar:independent');assert.equal(groups.other[1].independent,true);assert.equal(compatibleVoiceGroups({female:[],male:[]},'en',{ar:true}).other.length,1)});
