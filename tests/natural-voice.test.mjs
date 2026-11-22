import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVoiceText,voiceChunks,NATURAL_VOICES,naturalVoiceChoices,chooseNaturalVoice,isAllowedNaturalVoice } from '../src/lib/naturalVoice.js';
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

test('natural catalogue has exactly three friendly voices in each language',()=>{
  const arabic=naturalVoiceChoices('ar'),english=naturalVoiceChoices('en');
  assert.equal(arabic.length,3);
  assert.equal(english.length,3);
  assert.ok(arabic.every(x=>!x.label.toLowerCase().includes('microsoft')));
  assert.ok(english.every(x=>!x.label.toLowerCase().includes('openai')));
  assert.equal(NATURAL_VOICES.length,6);
});
test('voice selection is tied to the selected reading language and safe defaults',()=>{
  assert.equal(chooseNaturalVoice('ar','invalid'),naturalVoiceChoices('ar')[0].id);
  assert.equal(chooseNaturalVoice('en','invalid'),naturalVoiceChoices('en')[0].id);
  assert.equal(isAllowedNaturalVoice('en',naturalVoiceChoices('ar')[0].id),false);
  assert.equal(isAllowedNaturalVoice('ar',naturalVoiceChoices('ar')[0].id),true);
  assert.equal(isAllowedNaturalVoice('mixed',naturalVoiceChoices('en')[0].id),false);
});
