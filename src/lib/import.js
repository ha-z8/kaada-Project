/**
 * Browser-only extraction. Keep original files client-side until the user explicitly saves.
 * PDF may contain complex multi-column pages or scans, so always show an editable preview.
 */
function normalize(text) {
  return String(text || '').replace(/\r/g, '\n').replace(/\u00ad/g,'').replace(/([A-Za-z])-\n([A-Za-z])/g,'$1$2').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
/**
 * A study "paragraph" is a short listening passage, NOT a PDF page or a
 * several-thousand-character database row. Keep the original text order so
 * the corresponding Arabic translation is generated for exactly this passage.
 *  - headings stay with the first following content line
 *  - subsequent passages contain about two physical PDF lines
 *  - DOCX/clipboard prose without visual breaks is word-wrapped into short lines
 *  - never split in the middle of a word, mathematical token, or decimal
 */
const HEADING=/^(?:#{1,4}\s*)?(?:chapter|unit|module|lecture|section|الفصل|الوحدة|المحاضرة|الباب)\s+[0-9٠-٩IVXLCDM]+\b/i;
const NUMBERED_HEADING=/^\d+(?:\.\d+)*\.?\s*[^\n.!?؟]{5,}:\s*$/u;
export function wrapStudyLine(input,maxChars=128){
  const text=String(input||'').replace(/\s+/gu,' ').trim();
  if(!text)return [];
  if(text.length<=maxChars)return [text];
  const words=text.split(' ');
  const lines=[];
  let line='';
  for(const word of words){
    // Keep short mathematical expressions together, e.g. "x1 ≤ 10" or
    // "Z = 5x1": never wrap immediately before/after a comparison operator.
    const mathBoundary=/(?:[=≤≥<>+×÷*/-])$/u.test(line)
      ||/^[=≤≥<>+×÷*/-]$/u.test(word);
    if(line && (line.length+1+word.length>maxChars) && !mathBoundary){
      lines.push(line);line='';
    }
    line=line?line+' '+word:word;
  }
  if(line)lines.push(line);
  return lines;
}
export function splitIntoSections(text){
  const clean=normalize(text);
  if(!clean)return [];
  const result=[];
  for(const paragraph of clean.split(/\n\s*\n/u).filter(x=>x.trim())){
    const visualLines=paragraph.split('\n').flatMap(line=>wrapStudyLine(line));
    let buffer=[],proseLines=0,hasHeadings=false,followingChapter=false;
    const flush=()=>{
      if(buffer.length)result.push(buffer.join('\n').trim());
      buffer=[];proseLines=0;hasHeadings=false;
    };
    for(const line of visualLines){
      const chapterHeading=HEADING.test(line);
      // A chapter's title (e.g. "Introduction to Operations Research") is
      // normally a separate printed line without terminal punctuation.
      const chapterTitle=followingChapter && line.length<=100
        && !/[.!?؟:]\s*$/u.test(line) && !/^\d/.test(line);
      followingChapter=chapterHeading;
      const heading=chapterHeading||chapterTitle||NUMBERED_HEADING.test(line);
      if(heading){
        if(proseLines)flush();
        buffer.push(line);
        hasHeadings=true;
        continue;
      }
      const maxLines=hasHeadings?1:2;
      if(proseLines>=maxLines||(
        proseLines>0 && (buffer.join('\n').length+1+line.length)>275
      ))flush();
      buffer.push(line);
      proseLines++;
      if(hasHeadings)flush();
    }
    flush();
  }
  return result;
}
export function supportedImportType(file){
  const ext=String(file?.name||'').split('.').pop()?.toLowerCase();
  if(['pdf','docx','txt','md'].includes(ext))return ext;
  const mime=String(file?.type||'').toLowerCase();
  if(mime==='application/pdf')return 'pdf';
  if(mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return 'docx';
  if(mime==='text/plain')return 'txt';
  if(mime==='text/markdown')return 'md';
  return '';
}
export async function extractText(file) {
  if (file.size > 30 * 1024 * 1024) throw Error('الحد الأقصى للملف 30 ميجابايت.');
  const suffix = supportedImportType(file);
  if (['txt','md'].includes(suffix)) return normalize(await file.text());
  if (suffix === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return normalize(result.value);
  }
  if (suffix === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const text = await page.getTextContent();
      const lines = [];
      let row = []; let lastY = null;
      for (const item of text.items) {
        if (!('str' in item)) continue;
        const y = item.transform?.[5] ?? 0;
        if (lastY !== null && Math.abs(y - lastY) > 3 && row.length) { lines.push(row.join(' ')); row = []; }
        if (item.str.trim()) row.push(item.str.trim());
        if (item.hasEOL) { if (row.length) lines.push(row.join(' ')); row = []; lastY = null; }
        else lastY = y;
      }
      if (row.length) lines.push(row.join(' '));
      pages.push(lines.join('\n'));
    }
    return normalize(pages.join('\n\n'));
  }
  throw Error('الصيغ المدعومة: PDF أو DOCX أو TXT أو Markdown.');
}

/**
 * Detect chapter headings without treating dotted table-of-contents lines as actual chapters.
 * This heuristic must be checked in the import preview for real academic layouts.
 */
export function detectChapters(raw, filename = 'درس جديد') {
  const lines = String(raw || '').split(/\n/);
  const chapters = [];
  let current = null;
  const preface=[];
  for (let index=0; index<lines.length; index++) {
    const line = lines[index].trim();
    const hit = line.length < 115 && !/\.{3,}/.test(line)
      ? line.match(/^#{0,3}\s*(chapter|unit|module|lecture|الفصل|الوحدة|الباب|المحاضرة)\s+([0-9٠-٩]+|[IVXLC]+)\s*[:.\-–]?\s*(.*?)$/i)
      : null;
    if (hit) {
      const key = hit[1].toLowerCase() + ':' + hit[2].toLowerCase();
      if (current?.key === key) { current.lines.push(line); continue; }
      if (current) chapters.push(current);
      const next = lines.slice(index+1).find(x=>x.trim() && !/^restricted$/i.test(x.trim()))?.trim() || '';
      const subtitle = hit[3] || (next.length < 100 && !/^\d+$/.test(next) ? next : '');
      current = { key, title: (hit[1]+' '+hit[2]+(subtitle ? ' — '+subtitle : '')).trim(), lines:[line] };
    } else if(current) current.lines.push(lines[index]);
    else if(!/\.{3,}/.test(line))preface.push(lines[index]);
  }
  if(current) chapters.push(current);
  const opening=preface.join('\n').trim();
  // Preserve substantial introductory study content preceding the first chapter.
  if(chapters.length && opening.length>120)chapters.unshift({title:'مقدمة الملف',lines:preface});
  const derived = chapters.map(c=>({ title:c.title, text:c.lines.join('\n').trim() }))
    .filter(c=>c.text.length > 60)
    .map(c=>({ ...c, sections: splitIntoSections(c.text) }))
    .filter(c=>c.sections.length);
  return derived.length ? derived : [{title:filename, text:String(raw||''), sections:splitIntoSections(raw)}];
}
