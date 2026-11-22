import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername,validUsername,usernameLoginEmail } from '../src/lib/username.js';

test('usernames are case-normalized and accept numbers',()=>{
  assert.equal(normalizeUsername('  STUDENT_990  '),'student_990');
  assert.equal(usernameLoginEmail('student_990'),'student_990@accounts.kaada.invalid');
  assert.equal(usernameLoginEmail('990'), '990@accounts.kaada.invalid');
});
test('rejects short and ambiguous login identifiers',()=>{
  assert.equal(validUsername('ab'),false);
  assert.equal(validUsername('bad name'),false);
  assert.equal(validUsername('name@domain.com'),false);
  assert.equal(validUsername('محمد'),false);
  assert.throws(()=>usernameLoginEmail('a@a.com'),/اسم المستخدم/);
});
