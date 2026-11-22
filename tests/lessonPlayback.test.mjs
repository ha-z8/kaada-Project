import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonPlaybackPlan} from '../src/lib/lessonPlayback.js';
const sections=[
 {id:'a',position:0,content_en:'First English paragraph.',content_ar:'هذه الفقرة العربية الأولى.',explanation_en:'First English explanation.',explanation_ar:'هذا الشرح الأول.'},
 {id:'b',position:1,content_en:'Second English paragraph.',content_ar:'هذه الفقرة العربية الثانية.',explanation_en:'Second English explanation.',explanation_ar:'هذا الشرح الثاني.'},
 {id:'c',position:2,content_en:'Third English paragraph.',content_ar:'الفقرة الثالثة.',explanation_en:'Third explanation.',explanation_ar:'الشرح الثالث.'},
];
test('mixed lesson reads English then matching Arabic for each consecutive paragraph',()=>{
 const plan=lessonPlaybackPlan(sections,0,'mixed','read',true);
 assert.deepEqual(plan.queue.map(p=>[p.sectionId,...p.parts.map(x=>x.lang)]),[
  ['a','en-US','ar-SA'],['b','en-US','ar-SA'],['c','en-US','ar-SA']
 ]);
 assert.deepEqual(plan.queue.map(p=>p.parts.map(x=>x.text)),[
  ['First English paragraph.','هذه الفقرة العربية الأولى.'],
  ['Second English paragraph.','هذه الفقرة العربية الثانية.'],
  ['Third English paragraph.','الفقرة الثالثة.']
 ]);
});
test('mixed explanation must read English explanation then same paragraph Arabic explanation',()=>{
 const plan=lessonPlaybackPlan(sections,1,'mixed','explain',true);
 assert.deepEqual(plan.queue.map(x=>x.sectionId),['b','c']);
 assert.deepEqual(plan.queue[0].parts.map(x=>x.text),['Second English explanation.','هذا الشرح الثاني.']);
});
test('stops on missing Arabic translation and never jumps to next paragraph',()=>{
 const testSections=[sections[0],{...sections[1],content_ar:''},sections[2]];
 const plan=lessonPlaybackPlan(testSections,0,'mixed','read',true);
 assert.deepEqual(plan.queue.map(x=>x.sectionId),['a']);
 assert.equal(plan.stopAt,1);
 assert.equal(plan.stopReason,'missing-translation');
 assert.deepEqual(lessonPlaybackPlan(testSections,1,'mixed','read',true).queue,[]);
});
test('single paragraph playback remains possible without automatic advance',()=>{
 assert.deepEqual(lessonPlaybackPlan(sections,1,'mixed','read',false).queue.map(x=>x.sectionId),['b']);
 assert.deepEqual(lessonPlaybackPlan(sections,2,'en','read',true).queue.map(x=>x.sectionId),['c']);
});
test('missing bilingual explanation halts before speaking incomplete pair',()=>{
 const input=[sections[0],{...sections[1],explanation_ar:''}];
 const plan=lessonPlaybackPlan(input,0,'mixed','explain',true);
 assert.equal(plan.queue.length,1);
 assert.equal(plan.stopAt,1);
 assert.equal(plan.stopReason,'missing-explanation');
});
