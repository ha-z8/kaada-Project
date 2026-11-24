import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('open platform without downloading 12 huge voice models in background',async()=>{
 const app=await src('src/App.jsx');
 assert.doesNotMatch(app,/if\(navigator\.onLine!==false\)void installRecommendedOfflineVoices\(\)\.then\(update\)/);
 assert.match(app,/no automatic|never download|never downloaded|never download/i);
 assert.match(app,/onInstallAllOfflineVoices=/);
 assert.match(app,/localModelMissing/);
 assert.match(app,/offlineVoiceMissing=localModelMissing/);
});
test('neural synthesis cannot block React main thread, and Web Worker is loaded only when requested',async()=>{
 const audio=await src('src/lib/offlineVoice.js');
 const worker=await src('src/lib/piperWorker.js');
 const engine=await src('src/lib/piperEngine.js');
 assert.match(audio,/new Worker\(new URL\('\.\/piperWorker\.js',import\.meta\.url\)/);
 assert.match(audio,/function synthesizeInWorker\(/);
 assert.match(audio,/const WORKER_TIMEOUT_MS=120000/);
 assert.match(audio,/worker\.postMessage\(/);
 assert.match(audio,/terminateInference\(\)/);
 assert.match(audio,/synthesisQueue\.then/);
 assert.doesNotMatch(audio,/import \{synthesizePiper\} from '\.\/piperEngine\.js'/);
 assert.match(worker,/import \{synthesizePiper\} from '\.\/piperEngine\.js'/);
 assert.match(engine,/const ortLibrary=async/);
});
test('Model download requires an explicit click, and progress state updates are throttled',async()=>{
 const audio=await src('src/lib/offlineVoice.js');
 const app=await src('src/App.jsx');
 const ui=await src('src/components/StudyAudioPanel.jsx');
 assert.match(audio,/lastProgressByModel/);
 assert.match(audio,/now-previous<250/);
 assert.match(audio,/export async function installRecommendedOfflineVoices/);
 assert.doesNotMatch(audio,/await installOfflineVoice\(id\);\s*const task=synthesisQueue/);
 assert.match(audio,/if\(!content\)throw Error\('الصوت '/);
 assert.match(app,/onInstallOfflineVoice=\{async id=>/);
 assert.match(ui,/canUseOfflineModels\(\)/);
 assert.match(ui,/initiallyOpen=\{offlineVoiceMissing\}/);
});
test('site can recover from component render failures without deleting study data',async()=>{
 const root=await src('src/main.jsx');
 const boundary=await src('src/components/AppErrorBoundary.jsx');
 assert.match(root,/<AppErrorBoundary><App \/><\/AppErrorBoundary>/);
 assert.match(boundary,/window\.location\.reload\(\)/);
 assert.doesNotMatch(boundary,/indexedDB\.deleteDatabase|localStorage\.clear\(\)|caches\.delete\(/);
});
test('About only auto plays downloaded model; never launches giant fetch from navigation',async()=>{
 const about=await src('src/components/AboutNarration.jsx');
 const page=await src('src/components/AboutPage.jsx');
 const app=await src('src/App.jsx');
 assert.match(about,/offlineVoiceIdsRef\.current\.includes\(voiceNameRef\.current\)/);
 assert.match(about,/لم يُجهّز على جهازك/);
 assert.match(page,/offlineVoiceIds=\{offlineVoiceIds\}/);
 assert.match(app,/offlineVoiceIds=\{offlineVoiceIds\}/);
});
