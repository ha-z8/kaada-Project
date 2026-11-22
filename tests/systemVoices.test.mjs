import test from 'node:test';
import assert from 'node:assert/strict';
import {friendlySystemVoices,groupedSystemVoices,classifyVoiceGender} from '../src/lib/systemVoices.js';

test('Arabic voices are strictly Arabic, provider names never appear as labels',()=>{
  const voices=[
    {name:'Microsoft Arabic Neural Alpha',lang:'ar-SA'},
    {name:'Arabic Beta',lang:'ar-EG'},
    {name:'English Charlie',lang:'en-US'},
    {name:'Arabic Gamma',lang:'ar-SA'},
    {name:'Arabic Delta',lang:'ar-SA'},
  ];
  const ar=friendlySystemVoices(voices,'ar');
  assert.equal(ar.length,3);
  assert.deepEqual(ar.map(x=>x.label),['سَنا','أثير','مَزن']);
  assert.ok(ar.every(x=>x.lang.startsWith('ar')));
  assert.ok(ar.every(x=>!x.label.toLowerCase().includes('microsoft')));
});
test('English voices have separate readable names with at most three choices',()=>{
  const source=Array.from({length:15},(_,i)=>({name:'Voice '+i,lang:i===5?'ar-SA':'en-US'}));
  const en=friendlySystemVoices(source,'en');
  assert.deepEqual(en.map(x=>x.label),['Ava','Leo','Mia']);
  assert.equal(en.length,3);
});
test('never invent system voices when they are not installed',()=>{
  assert.deepEqual(friendlySystemVoices([], 'ar'),[]);
  assert.deepEqual(friendlySystemVoices([{name:'English',lang:'en-US'}], 'ar'),[]);
});

test('three known male and female Arabic voices per language are labelled without provider names',()=>{
  const names=['Hamed','Naayf','Shakir','Majed','Zariyah','Salma','Layla','Maryam'];
  const result=groupedSystemVoices(names.map(name=>({name:'Microsoft '+name+' Natural - Arabic',lang:'ar-SA'})),'ar');
  assert.equal(result.male.length,3);
  assert.equal(result.female.length,3);
  assert.equal(result.other.length,0);
  assert.deepEqual(result.male.map(v=>v.label),['راشد','فهد','ناصر']);
  assert.deepEqual(result.female.map(v=>v.label),['نورة','سَنا','مها']);
});
test('English voices are not mixed with Arabic and unknown gender stays explicitly unknown',()=>{
  const voices=['David','Mark','Guy','Christopher','Jenny','Aria','Zira','Samantha'].map(name=>({name,lang:'en-US'}));
  voices.push({name:'Unknown Device English Voice',lang:'en-GB'});
  const grouped=groupedSystemVoices(voices,'en');
  assert.equal(grouped.male.length,3);
  assert.equal(grouped.female.length,3);
  assert.equal(grouped.other.length,1);
  assert.equal(classifyVoiceGender({name:'Mystery Voice',lang:'ar-SA'},'ar'),null);
});
test('missing installed voices are never manufactured and gender is not guessed',()=>{
 const actual=groupedSystemVoices([{name:'Random Arabic voice',lang:'ar-SA'}],'ar');
 assert.deepEqual(actual.male,[]);
 assert.deepEqual(actual.female,[]);
 assert.equal(actual.other.length,1);
});


test('restored Arabic voice selector keeps original easy names and includes a woman and a man when available',()=>{
 const catalog=[
  {name:'Microsoft Hoda Natural',lang:'ar-EG'},
  {name:'Microsoft Naayf Natural',lang:'ar-SA'},
  {name:'Arabic General',lang:'ar-SA'},
  {name:'Another Arabic Voice',lang:'ar-SA'},
 ];
 const chosen=friendlySystemVoices(catalog,'ar');
 assert.deepEqual(chosen.map(x=>x.label),['سَنا','أثير','مَزن']);
 assert.equal(chosen.length,3);
 assert.ok(chosen.some(x=>x.gender==='female'));
 assert.ok(chosen.some(x=>x.gender==='male'));
 assert.ok(chosen.every(x=>x.id===catalog.find(y=>y.name===x.id)?.name));
});
