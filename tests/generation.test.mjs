import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedDraft, GENERATED_FIELDS } from '../src/lib/generation.js';

test('validates a complete bilingual generated draft',()=>{
  const input=Object.fromEntries(GENERATED_FIELDS.map(x=>[x,'example '+x]));
  assert.deepEqual(validateGeneratedDraft(input),input);
});
test('rejects incomplete drafts instead of saving partial results',()=>{
  assert.throws(()=>validateGeneratedDraft({content_ar:'ترجمة فقط'}),/غير مكتمل/);
});
test('ignores unexpected provider fields',()=>{
  const input=Object.fromEntries(GENERATED_FIELDS.map(x=>[x,'value']));
  input.role='administrator';
  assert.equal(validateGeneratedDraft(input).role,undefined);
});
