import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSourcePath,safeAudioPath,sourceExtension} from '../src/lib/storagePaths.js';
const user='2c78de9c-68e9-4727-80ce-d11b60123e12',id='3b34c0b4-3eaa-4efa-b3a6-4f080f206fa6';
test('Arabic filename never enters Supabase object key; original metadata stays intact',()=>{
  const file={name:'بحوث_عمليات.pdf',type:'application/pdf'};
  const path=safeSourcePath(user,id,file);
  assert.equal(path,user+'/'+id+'/source.pdf');
  assert.match(path,/^[a-zA-Z0-9/_.-]+$/);
  assert.equal(file.name,'بحوث_عمليات.pdf');
});
test('invalid merged extension pdfsvg uses MIME instead of injecting filename',()=>{
  const key=safeSourcePath(user,id,{name:'بحوث_عمليات.pdfsvg',type:'application/pdf'});
  assert.equal(key,user+'/'+id+'/source.pdf');
});
test('native uploads with Unicode names use safe extensions',()=>{
  assert.equal(safeSourcePath(user,id,{name:'الفصل ١.docx'}),user+'/'+id+'/source.docx');
  assert.equal(sourceExtension({name:'ملخص.md'}),'md');
  assert.equal(safeAudioPath(user,id,id,{name:'صوت شرح عربي.m4a'}),user+'/'+id+'/audio-'+id+'.m4a');
});
test('invalid user segment is never accepted as storage key',()=>{
  assert.throws(()=>safeSourcePath('../admin',id,{name:'safe.pdf'}));
});
