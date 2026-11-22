import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoSections, detectChapters } from '../src/lib/import.js';

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

test('detects chapter sections and ignores dotted TOC entries', () => {
 const input = 'Index\nCHAPTER 1 Introduction...........4\n\nChapter 1\nFundamentals\n'+
  'A '.repeat(80)+'\n\nChapter 2\nApplications\n'+'B '.repeat(80);
 const chapters = detectChapters(input, 'Course');
 assert.equal(chapters.length, 2);
 assert.match(chapters[0].title,/Chapter 1/i);
 assert.match(chapters[1].title,/Chapter 2/i);
});
