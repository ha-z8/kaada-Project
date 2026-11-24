import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 OFFLINE_VOICE_PACKS,findOfflineVoice,VOICE_GROUPS,uniqueVoiceModels
} from '../src/lib/voiceManifest.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('studio exposes exactly three genuinely distinct male/female voices in both languages',()=>{
 assert.equal(OFFLINE_VOICE_PACKS.length,12);
 assert.equal(uniqueVoiceModels(OFFLINE_VOICE_PACKS).size,11);
 for(const {lang,gender} of VOICE_GROUPS){
  const voices=OFFLINE_VOICE_PACKS.filter(p=>p.lang===lang&&p.gender===gender);
  assert.equal(voices.length,3,lang+' '+gender);
  assert.equal(new Set(voices.map(v=>v.modelKey+'|'+v.speakerId)).size,3);
  assert.ok(voices.every(v=>v.label&&v.modelUrl.startsWith('https://huggingface.co/')
   &&v.configUrl===v.modelUrl+'.json'&&v.source&&v.license&&v.accent));
 }
 assert.deepEqual(OFFLINE_VOICE_PACKS.filter(p=>p.lang==='ar'&&p.gender==='male')
  .map(v=>v.label),['فهد','سعود','راشد']);
 assert.deepEqual(OFFLINE_VOICE_PACKS.filter(p=>p.lang==='ar'&&p.gender==='female')
  .map(v=>v.label),['نورة','ريم','سارة']);
 assert.deepEqual(OFFLINE_VOICE_PACKS.filter(p=>p.lang==='en'&&p.gender==='male')
  .map(v=>v.label),['James','Liam','Noah']);
 assert.deepEqual(OFFLINE_VOICE_PACKS.filter(p=>p.lang==='en'&&p.gender==='female')
  .map(v=>v.label),['Emma','Olivia','Sophia']);
});
test('two Hadra voices are real different speakers and share a downloaded model, not a pitch trick',()=>{
 const rawi=findOfflineVoice('piper:hsa-hadra-rawi');
 const loubna=findOfflineVoice('piper:hsa-hadra-loubna');
 assert.ok(rawi&&loubna);
 assert.equal(rawi.modelKey,loubna.modelKey);
 assert.equal(rawi.modelUrl,loubna.modelUrl);
 assert.notEqual(rawi.speakerId,loubna.speakerId);
 assert.equal(rawi.gender,'male');
 assert.equal(loubna.gender,'female');
});
test('community models have explicit provenance and noncommercial restrictions are not disguised',()=>{
 const limited=OFFLINE_VOICE_PACKS.filter(p=>p.license.includes('NC'));
 assert.equal(limited.length,2);
 assert.ok(limited.every(p=>p.lang==='ar'));
 assert.ok(OFFLINE_VOICE_PACKS.filter(p=>p.accent.includes('جزائرية')).length===2);
 const reader=await source('src/components/StudyAudioPanel.jsx');
 assert.match(reader,/pack\.license\?\.includes\('NC'\)/);
 assert.match(reader,/pack\.accent/);
 assert.match(reader,/لهجاتها سعودية/);
});
test('neural browser synthesis honors model speaker index, verifies OPFS and works offline',async()=>{
 const engine=await source('src/lib/piperEngine.js');
 const downloader=await source('src/lib/offlineVoice.js');
 assert.match(engine,/session\.inputNames\.includes\('sid'\)/);
 assert.match(engine,/BigInt\(speakerId\)/);
 assert.match(engine,/config\.num_speakers/);
 assert.match(engine,/synthesizePiper/);
 assert.match(downloader,/modelKey/);
 assert.match(downloader,/ready\.json/);
 assert.match(downloader,/navigator\.storage\.getDirectory/);
 assert.match(downloader,/MIN_MODEL_SIZE/);
 assert.match(downloader,/cachedRuntimePromise/);
 assert.match(downloader,/navigator\.onLine===false/);
 assert.match(downloader,/player\.context=new AudioCtx\(\)/);
 assert.match(downloader,/player\.context\.resume\(\)/);
 assert.match(downloader,/await context\.decodeAudioData/);
 assert.doesNotMatch(engine,/const speakerId = 0/);
});
test('voice studio removes duplicate lists from default view but retains old system voices in advanced options',async()=>{
 const ui=await source('src/components/StudyAudioPanel.jsx');
 const css=await source('src/styles.css');
 const app=await source('src/App.jsx');
 assert.match(ui,/title="استوديو الأصوات الذكية"/);
 assert.match(ui,/تجهيز مكتبة الأصوات كلها دون إنترنت/);
 assert.match(ui,/language="ar"/);
 assert.match(ui,/language="en"/);
 assert.match(ui,/<details className="offline-legacy-voices">/);
 assert.match(ui,/onInstallAllOfflineVoices/);
 assert.match(app,/onInstallAllOfflineVoices=/);
 assert.match(css,/\.modern-study-player \.offline-voice-library-heading/);
 assert.match(css,/@media\(max-width:420px\)/);
});
