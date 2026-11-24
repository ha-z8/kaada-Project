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

import {pageSections,toggleParagraphSelection,recordDocumentProgress} from '../src/lib/documentReader.js';
test('page-aware import and playback include tiny repeated labels and all text',()=>{
 const spans=[{index:0,start:0,text:'1',y:10,height:10},{index:1,start:0,text:'A topic',y:30,height:10},{index:2,start:0,text:'1',y:60,height:10}];
 const imported=pageSections(spans,2);
 const rows=imported.map((s,i)=>({id:'p'+i,source_page:s.page,position:i,content_en:s.text,content_ar:'ترجمة'}));
 const units=buildDocumentUnits(spans,rows);
 assert.equal(units.length,rows.length);assert.ok(units.every(u=>u.matched));
 assert.equal(units.flatMap(u=>u.ranges).map(r=>r.text).join(' '),'1 A topic 1');
});
test('multi-page selection toggles individual paragraphs without losing other pages',()=>{
 const a={sectionId:'a',ranges:[{index:0,start:0,end:3,text:'one'}]},b={sectionId:'b',ranges:[{index:0,start:0,end:3,text:'two'}]};
 let q=toggleParagraphSelection([],1,a);q=toggleParagraphSelection(q,2,b);
 assert.equal(q.length,2);assert.deepEqual(toggleParagraphSelection(q,1,a).map(x=>x.page),[2]);
});
test('progress only counts completed pages and keeps languages separate',()=>{
 let p=recordDocumentProgress({},'mixed',1,'a');assert.equal(p.tracks.mixed.pages.length,0);
 p=recordDocumentProgress(p,'mixed',1,'a',true);p=recordDocumentProgress(p,'mixed',1,null,true);
 p=recordDocumentProgress(p,'en',2,'b');assert.deepEqual(p.tracks.mixed.pages,[1]);assert.deepEqual(p.tracks.en.pages,[]);
});

import {snapWordRanges,changeMarkRanges,normalizedMark,selectionExplanationPlan} from '../src/lib/documentReader.js';
test('selection snaps to full English and Arabic words and preserves offsets',()=>{
 const spans=[{index:0,start:0,text:'alpha beta gamma'},{index:1,start:0,text:'العِلْمُ مفيد'}];
 assert.deepEqual(snapWordRanges([{index:0,start:2,end:8},{index:1,start:2,end:3}],spans).map(r=>r.text),['alpha beta','العِلْمُ']);
});
test('annotations can add and remove complete words without deleting adjacent text',()=>{
 const spans=[{index:0,start:0,text:'alpha beta gamma'}];
 const initial=snapWordRanges([{index:0,start:1,end:2}],spans);
 const expanded=changeMarkRanges(initial,[{index:0,start:7,end:14}],spans,'add');
 assert.deepEqual(expanded.map(r=>r.text),['alpha','beta gamma']);
 assert.deepEqual(changeMarkRanges(expanded,[{index:0,start:7,end:8}],spans,'subtract').map(r=>r.text),['alpha',' gamma']);
});
test('annotation metadata uses bounded known colors and categories',()=>{
 assert.equal(normalizedMark({color:'bad',type:'bad',note:'x'.repeat(2600)}).note.length,2500);
 assert.equal(normalizedMark({}).color,'yellow');
});
test('spoken explanations remain separate from translation and preserve paragraph pairs',()=>{
 const units=[{sectionId:'a',ranges:[]},{sectionId:'b',ranges:[]}],sections=[{id:'a',explanation_en:'First explanation',explanation_ar:'الشرح الأول'},{id:'b',explanation_en:'Second explanation',explanation_ar:'الشرح الثاني'}];
 assert.deepEqual(selectionExplanationPlan(units,sections,'mixed').parts.map(p=>p.text),['First explanation','الشرح الأول','Second explanation','الشرح الثاني']);
 assert.equal(selectionExplanationPlan(units,sections.slice(0,1),'ar').missing,true);
});

import {pagePlaybackPlan,playbackPage} from '../src/lib/documentReader.js';
test('mixed playback continues in order when Arabic translation is missing',()=>{
 const make=(id,text,translation)=>({sectionId:id,native:'en',source:text,translation,ranges:[{index:0,start:0,end:text.length,text}]});
 const units=[make('one','First','الأول'),make('two','Second',''),make('three','Third','الثالث')];
 const plan=pagePlaybackPlan(units,'mixed');
 assert.deepEqual(plan.parts.map(p=>p.text),['First','الأول','Second','Third','الثالث']);
 assert.deepEqual(plan.incomplete,['two']);
 assert.equal(plan.parts[2].completesUnit,false);
 assert.deepEqual(pagePlaybackPlan(units,'ar').parts.map(p=>p.text),['الأول','الثالث']);
 assert.deepEqual(pagePlaybackPlan(units,'en').parts.map(p=>p.text),['First','Second','Third']);
});
test('page input remains bounded and rejects fractions or blank values',()=>{
 assert.equal(playbackPage(4,12,1),4);
 assert.equal(playbackPage('',12,3),3);
 assert.equal(playbackPage(2.5,12,3),3);
 assert.equal(playbackPage(99,12,3),3);
});

import {annotationPlayback,selectedDocumentUnits} from '../src/lib/documentReader.js';
test('saved annotations support one, checked and from-here playback in document order',()=>{
 const m=(id,page,start)=>({id,page,spans:[{index:0,start,end:start+2,text:'ab'}]});
 const items=[m('c',3,0),m('b',1,8),m('a',1,0)];
 assert.deepEqual(annotationPlayback(items,'from',[],'b').map(x=>x.id),['b','c']);
 assert.deepEqual(annotationPlayback(items,'checked',['c','a']).map(x=>x.id),['a','c']);
 assert.deepEqual(annotationPlayback(items,'single',[],'b').map(x=>x.id),['b']);
 assert.deepEqual(annotationPlayback(items,'from',[],'missing'),[]);
});
test('partial selected playback reads exact English and labels full paragraph translation',()=>{
 const text='alpha beta gamma',spans=[{index:0,start:0,end:text.length,text}];
 const units=[{sectionId:'a',native:'en',source:text,translation:'الفقرة العربية',ranges:spans}];
 const target=selectedDocumentUnits(units,[{index:0,start:6,end:10,text:'beta'}],spans);
 assert.equal(target[0].partial,true);
 const plan=pagePlaybackPlan(target,'mixed');
 assert.deepEqual(plan.parts.map(p=>p.text),['beta','الفقرة العربية']);
 assert.equal(plan.parts[1].ranges[0].text,text);
 assert.equal(pagePlaybackPlan(target,'en').parts[0].text,'beta');
});
