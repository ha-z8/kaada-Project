import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSpeechPlan,speechHighlight} from '../src/lib/documentReader.js';
test('speech highlighting retains original whitespace and selected offsets',()=>{
 const plan=documentSpeechPlan([{index:2,start:5,text:'one   two'}]);
 assert.equal(plan[0].text,'one two');
 assert.deepEqual(speechHighlight(plan[0],4,3),{index:2,start:11,end:14});
});
test('long source text is split without dropping words',()=>{
 const text='one two '.repeat(60).trim();
 const plan=documentSpeechPlan([{index:0,start:0,text}]);
 assert.equal(plan.map(x=>x.text).join(' '),text);
 assert.ok(plan.every(x=>x.text.length<=190));
});
