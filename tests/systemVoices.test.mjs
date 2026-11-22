import test from 'node:test';
import assert from 'node:assert/strict';
import {friendlySystemVoices} from '../src/lib/systemVoices.js';

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
