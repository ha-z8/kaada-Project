import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OFFLINE_VOICE_PACKS,findOfflineVoice,isOnDeviceVoice} from '../src/lib/offlineVoice.js';
import {offlineAudioKey} from '../src/lib/offlineStore.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('offline neural voice catalog uses real model ids instead of browser system aliases',()=>{
 assert.equal(OFFLINE_VOICE_PACKS.length,12);
 assert.equal(OFFLINE_VOICE_PACKS.filter(x=>x.lang==='ar').length,6);
 assert.equal(OFFLINE_VOICE_PACKS.filter(x=>x.lang==='en').length,6);
 assert.ok(OFFLINE_VOICE_PACKS.every(x=>x.id.startsWith('piper:')));
 // Two independently recorded Hadra speakers share one weights file.
 assert.equal(new Set(OFFLINE_VOICE_PACKS.map(x=>x.modelKey+':'+x.speakerId)).size,12);
 assert.equal(findOfflineVoice('piper:ar_JO-kareem-medium').lang,'ar');
 assert.equal(isOnDeviceVoice('piper:en_US-joe-medium'),true);
 assert.equal(isOnDeviceVoice('Microsoft Natural'),false);
});
test('private recording bytes cannot be addressed by another user account',()=>{
 assert.notEqual(offlineAudioKey('staff-A','lessons/recording.wav'),
  offlineAudioKey('staff-B','lessons/recording.wav'));
 assert.throws(()=>offlineAudioKey('','lessons/recording.wav'));
});
test('static TTS runtime and cached ONNX weights do not belong in git or mandatory PWA shell',async()=>{
 const vite=await source('vite.config.js');
 const voice=await source('src/lib/offlineVoice.js');
 const worker=await source('public/sw.js');
 assert.match(vite,/copyLocalTtsRuntimePlugin/);
 assert.match(vite,/piper_phonemize\.wasm/);
 assert.match(vite,/resolve\(destination,'manifest\.json'\)/);
 assert.match(vite,/tts-runtime/);
 assert.match(voice,/navigator\.storage\?\.getDirectory/);
 assert.match(voice,/cacheTtsRuntime/);
 assert.match(voice,/await downloadModel\(pack\)/);
 assert.match(voice,/storedOfflineVoiceIds/);
 assert.match(voice,/ready\.json/);
 assert.match(voice,/readInstalledModel\(pack\)/);
 assert.match(voice,/synthesizePiper/);
 assert.doesNotMatch(worker,/huggingface\.co|onnxruntime-web\/1\.18/);
});
test('each private read family has an IndexedDB offline fallback and server writes remain verified',async()=>{
 const app=await source('src/App.jsx');
 const api=await source('src/lib/api.js');
 const accounts=await source('src/lib/accounts.js');
 const site=await source('src/lib/siteSettings.js');
 const store=await source('src/lib/offlineStore.js');
 const center=await source('src/components/OfflineSyncCenter.jsx');
 assert.match(app,/loadSiteEditPermissions\(\)/);
 assert.match(app,/listAccountsWithCache\(session\.id\)/);
 assert.match(api,/saveOfflineSnapshot\(cacheKey,fresh\)/);
 assert.match(api,/readOfflineAudio\(userId,path\)/);
 assert.match(api,/saveOfflineAudio\(userId,path,audio\)/);
 assert.match(accounts,/readOfflineSnapshot\(key\)/);
 assert.match(site,/saveOfflineSnapshot\('site-settings',content\)/);
 assert.match(store,/clearStaffAudio\(userId\)/);
 assert.match(center,/cacheStudyAudio\(path,userId\)/);
 assert.match(center,/مركز العمل دون إنترنت/);
});
test('UI uses true local voices with responsive controls and WASM-only CSP',async()=>{
 const css=await source('src/styles.css');
 const ui=await source('src/components/StudyAudioPanel.jsx');
 const netlify=await source('netlify.toml');
 assert.match(ui,/OfflineModelCatalog/);
 assert.match(ui,/v\.localService===true/);
 assert.match(css,/@media \(max-width:400px\)/);
 assert.match(css,/\.offline-voice-grid/);
 assert.match(css,/\.account-list-item/);
 assert.match(netlify,/wasm-unsafe-eval/);
 assert.match(netlify,/https:\/\/huggingface\.co/);
 assert.doesNotMatch(netlify,/script-src[^\n]*'unsafe-eval'/);
});
