import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VOICE_NAMES} from '../src/lib/systemVoices.js';
import {offlineAudioKey} from '../src/lib/offlineStore.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('the 12 Saudi/British labels remain browser-only, not synthetic Piper profiles',()=>{
 assert.equal(VOICE_NAMES.ar.male.length+VOICE_NAMES.ar.female.length,6);
 assert.equal(VOICE_NAMES.en.male.length+VOICE_NAMES.en.female.length,6);
 assert.deepEqual(VOICE_NAMES.ar.female,['نورة','ريم','سارة']);
 assert.deepEqual(VOICE_NAMES.en.male,['Oliver','Harry','George']);
});
test('private recording bytes cannot be addressed by another user account',()=>{
 assert.notEqual(offlineAudioKey('staff-A','lessons/recording.wav'),
  offlineAudioKey('staff-B','lessons/recording.wav'));
 assert.throws(()=>offlineAudioKey('','lessons/recording.wav'));
});
test('independent voice runtime is optional and loaded only by an explicit action',async()=>{
 const vite=await source('vite.config.js');
 const voice=await source('src/lib/speech.js');
 const app=await source('src/App.jsx');
 const sw=await source('public/sw.js');
 assert.match(vite,/copyLocalTtsRuntimePlugin/);
 assert.match(vite,/18\*1024\*1024/);
 assert.match(voice,/await import\('\.\/offlineVoice\.js'\)/);
 assert.doesNotMatch(voice,/from '\.\/offlineVoice\.js'/);
 const setup=await source('src/components/VoiceCompatibilitySetup.jsx');
 assert.match(setup,/تأكيد التنزيل/);
 assert.doesNotMatch(app,/from '\.\/lib\/offlineVoice\.js'/);
 assert.match(voice,/new SpeechSynthesisUtterance\(text\)/);
 assert.doesNotMatch(sw,/huggingface\.co/);
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
test('responsive audio controls show original browser voices and keep secure PWA',async()=>{
 const css=await source('src/styles.css');
 const ui=await source('src/components/StudyAudioPanel.jsx');
 const netlify=await source('netlify.toml');
 assert.match(ui,/title="الأصوات"/);
 assert.match(ui,/<VoiceSelection language="en"/);
 assert.match(ui,/<VoiceSelection language="ar"/);
 assert.match(ui,/onPreviewVoice/);
 assert.doesNotMatch(ui,/OfflineModelCatalog|onInstallAllOfflineVoices/);
 assert.match(css,/@media \(max-width:400px\)/);
 assert.match(css,/\.voice-new-grid/);
 assert.match(css,/\.account-list-item/);
 assert.match(netlify,/Content-Security-Policy/);
 assert.doesNotMatch(netlify,/script-src[^\n]*'unsafe-eval'/);
});
