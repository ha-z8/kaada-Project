import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVoiceText,voiceChunks,NATURAL_VOICES } from '../src/lib/naturalVoice.js';
import handler,{config} from '../netlify/functions/natural-voice.mjs';

test("read and explain are separate scripts with the selected language",()=>{
  const x={content_en:'Atoms form matter.',content_ar:'الذرات تكوّن المادة.',explanation_ar:'المادة تتكون من وحدات صغيرة.',explanation_en:'Matter is made of small building blocks.',explanation_mixed:'Atoms تعني الذرات.'};
  assert.equal(buildVoiceText(x,'ar','read'),x.content_ar);
  assert.equal(buildVoiceText(x,'ar','explain'),x.explanation_ar);
  assert.equal(buildVoiceText(x,'en','explain'),x.explanation_en);
  assert.equal(buildVoiceText(x,'mixed','explain'),x.explanation_mixed);
});
test('voice scripts are split into bounded chunks',()=>{
  const parts=voiceChunks('هذه جملة تعليمية مهمة. '.repeat(75));
  assert.ok(parts.length>1);
  assert.ok(parts.every(x=>x.length<=1500));
});
test('requesting paid speech without auth is rejected',async()=>{
  const res=await handler(new Request('https://demo.netlify.app/api/study/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
  assert.equal(res.status,401);
  assert.equal(config.path,'/api/study/voice');
  assert.ok(NATURAL_VOICES.length>=4);
});
