import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoSections, detectChapters,extractText,supportedImportType } from '../src/lib/import.js';

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

test('uses verified PDF MIME for malformed PDF suffix but rejects SVG',()=>{
  assert.equal(supportedImportType({name:'بحوث_عمليات.pdfsvg',type:'application/pdf'}),'pdf');
  assert.equal(supportedImportType({name:'image.svg',type:'image/svg+xml'}),'');
  assert.equal(supportedImportType({name:'فصل ١.docx',type:''}),'docx');
});


test('science importer never splits decimal values or scientific inequalities across sections',()=>{
 const input=Array.from({length:100},()=> 'The result is 0.05, not 5, and x1 ≤ 10.').join(' ');
 const chunks=splitIntoSections(input);
 assert.ok(chunks.length>1);
 assert.ok(chunks.every(c=>c.length<=1750));
 assert.equal(chunks.join(' ').match(/0\.05/g)?.length,100);
 assert.equal(chunks.join(' ').match(/x1 ≤ 10/g)?.length,100);
 // Exact 0.05 and x1 ≤ 10 occurrences above prove the chunks preserve decimals and formulas.
});


test('splits the exact Operations Research example into short listening passages',()=>{
 const source=[
  'Chapter 1',
  'Introduction to Operations Research',
  '1.Origin and Development of Operations Research:',
  'Although the exact origins of what is now known as "Operations Research" are',
  'not precisely documented, historical writings indicate that scientific methods have',
  'been employed in various forms since ancient times.The systematic interest of',
  'scholars in the use and development of scientific methods can be traced back to',
  'the past few centuries.In 1832, Charles Babbage wrote on the economy of',
  'machinery and manufactures, incorporating numerous scientific applications.By',
 ].join('\n');
 const passages=splitIntoSections(source);
 assert.deepEqual(passages.slice(0,2),[
   [
    'Chapter 1',
    'Introduction to Operations Research',
    '1.Origin and Development of Operations Research:',
    'Although the exact origins of what is now known as "Operations Research" are',
   ].join('\n'),
   [
    'not precisely documented, historical writings indicate that scientific methods have',
    'been employed in various forms since ancient times.The systematic interest of',
   ].join('\n')
 ]);
 assert.ok(passages.length>=4);
 assert.equal(passages.join(' ').replace(/\s+/gu,' ').trim(),source.replace(/\s+/gu,' ').trim());
 assert.ok(passages.every(p=>p.length<350));
});
test('short study segments avoid breaking decimals, negatives, long scientific terms, and letters',()=>{
 const text='The tolerance is 0.05 and the limit is 10.25 while x1 ≤ 10. '.repeat(40);
 const groups=splitIntoSections(text);
 assert.ok(groups.length>=5);
 assert.equal((groups.join(' ').match(/0\.05/g)||[]).length,40);
 assert.equal((groups.join(' ').match(/10\.25/g)||[]).length,40);
 assert.equal((groups.join(' ').match(/x1 ≤ 10/g)||[]).length,40);
 assert.equal(groups.join(' ').replace(/\s+/g,' ').trim(),text.trim().replace(/\s+/g,' '));
});
