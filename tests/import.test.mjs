import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoSections } from '../src/lib/import.js';

test('splits paragraphs and preserves source text', () => {
  assert.deepEqual(splitIntoSections('Alpha sentence.\n\nBeta sentence.'), ['Alpha sentence.', 'Beta sentence.']);
});

test('handles empty text', () => {
  assert.deepEqual(splitIntoSections('   \n   '), []);
});

test('chunks large paragraphs without dropping words', () => {
  const text = Array(200).fill('A living cell has a membrane.').join(' ');
  const segments = splitIntoSections(text);
  assert.ok(segments.length > 1);
  assert.ok(segments.every(s => s.length <= 1750));
});
