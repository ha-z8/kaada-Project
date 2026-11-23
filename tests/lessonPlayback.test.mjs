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


test('the 1941 Blackett Circus excerpt reads exactly English then its own Arabic translation',()=>{
 const source='In 1941, a team of scientists known as the "Blackett Circus," named after their leader,';
 const arabic='في عام 1941، أجرى فريق من العلماء عُرف باسم "سيرك بلاكيت" (Blackett Circus)، تيمناً بقائدهم بلاكيت،';
 const passages=[
  {id:'1941-a',content_en:source,content_ar:arabic},
  {id:'1941-b',content_en:'Blackett, conducted studies that led to advancements in early warning radar and bombers.',content_ar:'أجرى بلاكيت دراسات أسهمت في تطور رادارات الإنذار المبكر والقاذفات.'}
 ];
 const result=lessonPlaybackPlan(passages,0,'mixed','read',true);
 assert.deepEqual(result.queue.map(item=>item.parts.map(part=>part.text)),[
  [source,arabic],
  [passages[1].content_en,passages[1].content_ar]
 ]);
 assert.deepEqual(result.queue.flatMap(item=>item.parts.map(part=>part.lang)),[
  'en-US','ar-SA','en-US','ar-SA'
 ]);
});
