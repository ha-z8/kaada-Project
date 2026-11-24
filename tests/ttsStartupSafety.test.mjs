import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('site boots without loading Piper models, ONNX or voice download listeners',async()=>{
 const app=await src('src/App.jsx');
 const speech=await src('src/lib/speech.js');
 assert.doesNotMatch(app,/from '\.\/lib\/offlineVoice\.js'|installRecommendedOfflineVoices|onInstallAllOfflineVoices|offlineVoiceDownloads/);
 assert.doesNotMatch(speech,/from '\.\/offlineVoice\.js'|speakOfflineVoiceParts|synthesizePiper/);
 assert.match(app,/setInstalledVoices\(getAvailableVoices\(\)\)/);
 assert.match(app,/window\.speechSynthesis\.addEventListener\?\.\('voiceschanged',update\)/);
});

test('previously saved piper choice is ignored and original browser voice is chosen again',async()=>{
 const app=await src('src/App.jsx');
 assert.match(app,/\^piper:/);
 assert.match(app,/lockVoiceCatalog\(installedVoices,voiceAssignments\)/);
 assert.match(app,/arChoices\.find\(v=>v\.id===selectedArVoice\)/);
 assert.match(app,/enChoices\.find\(v=>v\.id===selectedEnVoice\)/);
 assert.match(app,/arChoices\[0\]\?\.id\|\|''/);
 assert.match(app,/enChoices\[0\]\?\.id\|\|''/);
 assert.doesNotMatch(app,/effectiveArVoice=[^\n]*'piper:/);
});

test('browser-voice panel contains the original groups and preview, without hidden downloads',async()=>{
 const ui=await src('src/components/StudyAudioPanel.jsx');
 assert.match(ui,/title="الأصوات"/);
 assert.match(ui,/<VoiceSelection language="en"/);
 assert.match(ui,/<VoiceSelection language="ar"/);
 assert.match(ui,/onPreview\(language,id\)/);
 assert.match(ui,/speaker\.localService===false/);
 assert.match(ui,/تختلف الأصوات المتاحة باختلاف الجهاز والمتصفح/);
 assert.match(ui,/const ready=Boolean\(speaker\?\.id&&speaker\.localService===false\)/);
 assert.doesNotMatch(ui,/OfflineModelCatalog|onInstallOfflineVoice|onInstallAllOfflineVoices|onnx|piper/);
});

test('Vite and About narrator no longer pull heavy voice models into the actual site',async()=>{
 const vite=await src('vite.config.js');
 const about=await src('src/components/AboutNarration.jsx');
 const page=await src('src/components/AboutPage.jsx');
 assert.doesNotMatch(vite,/copyLocalTtsRuntimePlugin|piper_phonemize|onnxruntime-web/);
 assert.doesNotMatch(about,/OFFLINE_VOICE_PACKS|isOnDeviceVoice|offlineVoiceIdsRef/);
 assert.match(about,/window\.speechSynthesis\.getVoices\(\)/);
 assert.match(about,/speakParts\(selected,rateRef\.current/);
 assert.match(page,/site\.aboutNarrationEnabled/);
});

test('previous crash recovery still works without deleting cached study data',async()=>{
 const root=await src('src/main.jsx');
 const boundary=await src('src/components/AppErrorBoundary.jsx');
 assert.match(root,/<AppErrorBoundary><App \/><\/AppErrorBoundary>/);
 assert.match(boundary,/window\.location\.reload\(\)/);
 assert.doesNotMatch(boundary,/indexedDB\.deleteDatabase|localStorage\.clear\(\)|caches\.delete\(/);
});
