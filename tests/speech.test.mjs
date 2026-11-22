import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceLanguage, speechParts, chunkText, speakParts } from '../src/lib/speech.js';

test('recognizes Arabic source text and reads it even without a separate translation', () => {
  const section={ content_en:'هذه الفقرة مكتوبة باللغة العربية وتحتاج إلى صوت عربي.', content_ar:'' };
  assert.equal(sourceLanguage(section.content_en),'ar');
  assert.deepEqual(speechParts(section,'ar','read'),[{lang:'ar-SA',text:section.content_en}]);
  assert.deepEqual(speechParts(section,'mixed','read'),[]);
});

test('does not claim Arabic narration for an untranslated English import', () => {
  const section={content_en:'Operations research is the study of decision-making.',content_ar:''};
  assert.equal(sourceLanguage(section.content_en),'en');
  assert.equal(speechParts(section,'ar','read').length,0);
  assert.equal(speechParts(section,'mixed','read').length,0);
  assert.equal(speechParts(section,'en','read').length,1);
});

test('read mode and explanation mode use different source texts', () => {
  const section={
    content_en:'A cell is a basic unit of life.',
    content_ar:'الخلية وحدة أساسية للحياة.',
    explanation_ar:'يعني ذلك أن الكائنات الحية تتكون من خلايا.',
    explanation_en:'The cell forms the basic living structure.',
    explanation_mixed:'Cell تعني خلية، وهي الوحدة الأساسية.',
  };
  assert.equal(speechParts(section,'ar','read')[0].text,section.content_ar);
  assert.equal(speechParts(section,'ar','explain')[0].text,section.explanation_ar);
  assert.deepEqual(speechParts(section,'mixed','read').map(x=>x.lang),['en-US','ar-SA']);
  assert.deepEqual(speechParts(section,'mixed','explain').map(x=>x.lang),['en-US','ar-SA']);
});

test('long Arabic and English input is split into safe short utterances', () => {
  const long='هذه فقرة عربية طويلة. '.repeat(200);
  const chunks=chunkText(long);
  assert.ok(chunks.length>10);
  assert.ok(chunks.every(x=>x.length<=190 && x.length>0));
  assert.equal(chunks.join(' ').replace(/\s+/g,' ').trim(),long.trim().replace(/\s+/g,' '));
});

test('speech queue starts, advances and completes each utterance', async () => {
  const previousWindow=globalThis.window,previousUtterance=globalThis.SpeechSynthesisUtterance;
  const seen=[];
  class MockUtterance { constructor(text){this.text=text} }
  const synth={
    getVoices:()=>[{lang:'ar-SA',name:'Arabic'},{lang:'en-US',name:'English'}],
    cancel:()=>{},
    speak:(utterance)=>{
      seen.push({text:utterance.text,rate:utterance.rate,lang:utterance.lang});
      queueMicrotask(()=>{utterance.onstart?.();utterance.onend?.()});
    },
  };
  globalThis.window={speechSynthesis:synth};
  globalThis.SpeechSynthesisUtterance=MockUtterance;
  try{
    await new Promise((resolve,reject)=>{
      speakParts([{text:'Hello world.',lang:'en-US'},{text:'السلام عليكم.',lang:'ar-SA'}],
        1.25,()=>{},resolve,reject);
    });
    assert.equal(seen.length,2);
    assert.equal(seen[0].lang,'en-US');
    assert.equal(seen[1].lang,'ar-SA');
    assert.equal(seen[1].rate,1.25);
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=previousUtterance;
  }
});
