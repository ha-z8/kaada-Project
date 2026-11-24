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

import {buildDocumentUnits,documentUnitPlan,documentPartHighlight,mergeDocumentRanges} from '../src/lib/documentReader.js';
test('bilingual reading pairs exact source across positioned spans with its saved translation',()=>{
 const units=buildDocumentUnits([{index:0,start:0,text:'Scientific'},{index:1,start:0,text:'method.'},{index:2,start:0,text:'Next line.'}],[{id:'a',content_en:'Scientific method.',content_ar:'المنهج العلمي.'},{id:'b',content_en:'Next line.',content_ar:'السطر التالي.'}]);
 assert.equal(units.length,2);assert.equal(units[0].sectionId,'a');
 assert.deepEqual(documentUnitPlan(units[0],'mixed').parts.map(p=>p.text),['Scientific method.','المنهج العلمي.']);
 assert.deepEqual(documentUnitPlan(units[0],'ar').parts.map(p=>p.lang),['ar-SA']);
 assert.deepEqual(documentPartHighlight(documentUnitPlan(units[0],'mixed').parts[1],3),units[0].ranges);
 assert.equal(documentUnitPlan(units[0],'en').parts.length,1);
});
test('unmatched or conflicting translations are never substituted',()=>{
 const spans=[{index:0,start:0,text:'Scientific method.'}];
 const sections=[{content_en:'Scientific method.',content_ar:'أ'},{content_en:'Scientific method.',content_ar:'ب'}];
 assert.equal(documentUnitPlan(buildDocumentUnits(spans,sections)[0],'mixed').missing,true);
 assert.equal(documentUnitPlan(buildDocumentUnits(spans,[{content_en:'Different method.',content_ar:'أ'}])[0],'ar').missing,true);
});
test('overlapping selections merge and keep selected original characters',()=>{
 const spans=[{index:0,start:0,text:'one two three'}];
 assert.deepEqual(mergeDocumentRanges([{index:0,start:0,end:7},{index:0,start:4,end:13}],spans),[{index:0,start:0,end:13,text:'one two three'}]);
});

test('disjoint saved selections in a single PDF text span never read intervening words',()=>{
 const spans=[{index:0,start:0,end:3,text:'one'},{index:0,start:8,end:13,text:'three'}];
 const units=buildDocumentUnits(spans,[]);assert.deepEqual(units.flatMap(u=>u.ranges).map(r=>r.text),['one','three']);
});
test('unpaired visual paragraphs remain individually selectable',()=>{
 const units=buildDocumentUnits([{index:0,start:0,text:'First paragraph.',y:10,height:10},{index:1,start:0,text:'Second paragraph.',y:40,height:10}],[]);
 assert.equal(units.length,2);
});
