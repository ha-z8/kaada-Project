import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoSections, detectChapters,extractText } from '../src/lib/import.js';

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

test('the importer does not silently discard paragraphs beyond 500',()=>{
  const input=Array.from({length:503},(_,i)=>'Paragraph '+i).join('\n\n');
  assert.equal(splitIntoSections(input).length,503);
});

test('detects Arabic chapter and English lecture headings',()=>{
  const input='الفصل ١: مقدمة\n'+'هذا شرح مفصل بالعربية. '.repeat(9)
    +'\n\nLecture 2 — Introduction\n'+'The study material continues. '.repeat(8);
  const chapters=detectChapters(input,'Course');
  assert.equal(chapters.length,2);
  assert.match(chapters[0].title,/الفصل ١/);
  assert.match(chapters[1].title,/Lecture 2/);
});

test('keeps a meaningful introduction before the first chapter',()=>{
  const intro='This is the full course introduction and its learning outcomes. '.repeat(4);
  const ch='\n\nChapter 1\n'+'A scientific paragraph about data. '.repeat(8);
  const result=detectChapters(intro+ch,'Course');
  assert.equal(result.length,2);
  assert.equal(result[0].title,'مقدمة الملف');
  assert.ok(result[0].text.includes('learning outcomes'));
});

test('imports plain Markdown locally without remote uploads',async()=>{
  const file={name:'course.md',size:100,text:async()=> '# Intro\n\nThis is the first paragraph.'};
  const text=await extractText(file);
  assert.match(text,/This is the first paragraph/);
});
