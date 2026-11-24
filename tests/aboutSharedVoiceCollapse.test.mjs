import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('About narration uses the exact pinned Arabic voice from the lesson audio player',async()=>{
 const app=await source('src/App.jsx');
 const about=await source('src/components/AboutPage.jsx');
 const narrator=await source('src/components/AboutNarration.jsx');
 assert.match(app,/narrationVoice=\{effectiveArVoice\}/);
 assert.match(app,/narrationVoices=\{arVoiceGroups\}/);
 assert.match(app,/onNarrationVoiceChange=\{v=>\{if\(findCloudVoice\(v\)\)setCloudArVoice\(v\);else setSelectedArVoice\(v\)\}\}/);
 assert.match(app,/narrationVolume=\{listeningVolume\}/);
 assert.match(app,/narrationSpeed=\{speed\}/);
 assert.match(about,/voiceName=\{narrationVoice\}/);
 assert.match(about,/voiceGroups=\{narrationVoices\}/);
 assert.match(about,/onVoiceChange=\{onNarrationVoiceChange\}/);
 assert.match(narrator,/voiceNameRef\.current=voiceName/);
 assert.match(narrator,/\{ar:voiceNameRef\.current\}/);
 assert.match(narrator,/volumeRef\.current/);
 assert.match(narrator,/Never switch a missing/);
 assert.match(narrator,/if\(!voiceNameRef\.current\)/);
});

test('Selecting a voice from About changes the shared voice selection for future lessons',async()=>{
 const component=await source('src/components/AboutNarration.jsx');
 assert.match(component,/const changeVoice=next=>\{/);
 assert.match(component,/voiceNameRef\.current=next/);
 assert.match(component,/onVoiceChange\(next\)/);
 assert.match(component,/voiceGroups\?\.female/);
 assert.match(component,/voiceGroups\?\.male/);
 assert.match(component,/value=\{voiceName\}/);
 assert.match(component,/onChange=\{e=>changeVoice\(e\.target\.value\)\}/);
 assert.match(component,/الصوت العربي المختار في مشغّل المواد غير متوفر/);
});

test('About sound controls can collapse into a small accessible button without stopping playback',async()=>{
 const component=await source('src/components/AboutNarration.jsx');
 const css=await source('src/styles.css');
 assert.match(component,/COLLAPSED_STORAGE_KEY='hsa-about-narration-collapsed-v1'/);
 assert.match(component,/localStorage\.getItem\(COLLAPSED_STORAGE_KEY\)/);
 assert.match(component,/localStorage\.setItem\(COLLAPSED_STORAGE_KEY,String\(value\)\)/);
 assert.match(component,/if\(collapsed\)return <aside className="about-narration is-collapsed"/);
 assert.match(component,/aria-label="إظهار لوحة الشرح الصوتي"/);
 assert.match(component,/onClick=\{\(\)=>setCollapsedSaved\(false\)\}/);
 assert.match(component,/aria-label="إخفاء لوحة الشرح الصوتي"/);
 assert.match(component,/onClick=\{\(\)=>setCollapsedSaved\(true\)\}/);
 assert.match(css,/\.about-narration\.is-collapsed\{/);
 assert.match(css,/\.about-narration-expand\{/);
 assert.match(css,/\.about-page:has\(\.about-narration\.is-collapsed\)/);
 const collapse=sliceBetween(component,'const setCollapsedSaved=value=>{','const cancel=');
 assert.ok(!collapse.includes('stopSpeech(')&&!collapse.includes('cancel('),
  'Collapsing must not stop or restart the narrator');
});

function sliceBetween(text,start,end){
 const a=text.indexOf(start),b=text.indexOf(end,a);
 return a>=0&&b>=0?text.slice(a,b):'';
}

test('shared speed settings follow the curriculum speed menu without requiring network',async()=>{
 const app=await source('src/App.jsx');
 const component=await source('src/components/AboutNarration.jsx');
 assert.match(app,/onNarrationSpeedChange=\{setSpeed\}/);
 assert.match(component,/onSpeedChange\(value\)/);
 for(const speed of ['0.85','1','1.15','1.3','1.5']){
  assert.ok(component.includes('value={'+speed+'}'),'Missing lesson rate '+speed);
 }
 assert.ok(!component.includes('fetch('));
 assert.match(component,/!isCloudVoice\(voiceNameRef\.current\)&&!speakSupported\(\)/);
});
