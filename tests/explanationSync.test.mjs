import test from 'node:test';
import assert from 'node:assert/strict';
import {synchronizedSectionUpdate} from '../src/lib/explanationSync.js';
test('changing Arabic explanation invalidates stale Arabic and mixed recordings',()=>{
 const previous={explanation_ar:'Old Arabic',explanation_en:'Old English',audio_ar_path:'old.mp3',audio_en_path:'old-en.mp3',audio_mixed_path:'old-mixed.mp3'};
 const got=synchronizedSectionUpdate(previous,{explanation_ar:'Corrected Arabic'});
 assert.equal(got.explanation_ar,'Corrected Arabic');assert.equal(got.audio_ar_path,null);
 assert.equal(got.audio_mixed_path,null);assert.equal(got.audio_en_path,undefined);
});
test('unchanged explanations never detach existing recordings',()=>{
 const previous={explanation_ar:'Same',audio_ar_path:'recording.mp3'};
 assert.deepEqual(synchronizedSectionUpdate(previous,{explanation_ar:'Same'}),{explanation_ar:'Same'});
});
test('editing English source invalidates English reading recordings',()=>{
 const got=synchronizedSectionUpdate({content_en:'Before'}, {content_en:'After'});
 assert.equal(got.audio_en_path,null);
});
