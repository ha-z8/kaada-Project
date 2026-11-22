/**
 * Browser-only extraction. Keep original files client-side until the user explicitly saves.
 * PDF may contain complex multi-column pages or scans, so always show an editable preview.
 */
function normalize(text) {
  return String(text || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
export function splitIntoSections(text) {
  const clean = normalize(text);
  if (!clean) return [];
  const paragraphs = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const output = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 1750) { output.push(paragraph); continue; }
    const sentences = paragraph.match(/[^.!?。؟]+[.!?。؟]*\s*/g) || [paragraph];
    let chunk = '';
    for (const sentence of sentences) {
      if ((chunk + sentence).length > 1750 && chunk) { output.push(chunk.trim()); chunk = ''; }
      if (sentence.length > 1750) {
        if (chunk) { output.push(chunk.trim()); chunk = ''; }
        for (let i = 0; i < sentence.length; i += 1750) output.push(sentence.slice(i, i + 1750).trim());
      } else chunk += sentence;
    }
    if (chunk.trim()) output.push(chunk.trim());
  }
  return output.slice(0, 500);
}
export async function extractText(file) {
  if (file.size > 30 * 1024 * 1024) throw Error('الحد الأقصى للملف 30 ميجابايت.');
  const suffix = file.name.split('.').pop()?.toLowerCase();
  if (suffix === 'txt') return normalize(await file.text());
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
  throw Error('الصيغ المدعومة: PDF أو DOCX أو TXT.');
}

/**
 * Detect chapter headings without treating dotted table-of-contents lines as actual chapters.
 * This heuristic must be checked in the import preview for real academic layouts.
 */
export function detectChapters(raw, filename = 'درس جديد') {
  const lines = String(raw || '').split(/\n/);
  const chapters = [];
  let current = null;
  for (let index=0; index<lines.length; index++) {
    const line = lines[index].trim();
    const hit = line.length < 115 && !/\.{3,}/.test(line)
      ? line.match(/^(chapter|unit|الفصل|الوحدة)\s+([0-9]+|[IVXLC]+)\s*[:.\-–]?\s*(.*?)$/i)
      : null;
    if (hit) {
      const key = hit[1].toLowerCase() + ':' + hit[2].toLowerCase();
      if (current?.key === key) { current.lines.push(line); continue; }
      if (current) chapters.push(current);
      const next = lines.slice(index+1).find(x=>x.trim() && !/^restricted$/i.test(x.trim()))?.trim() || '';
      const subtitle = hit[3] || (next.length < 100 && !/^\d+$/.test(next) ? next : '');
      current = { key, title: (hit[1]+' '+hit[2]+(subtitle ? ' — '+subtitle : '')).trim(), lines:[line] };
    } else if(current) current.lines.push(lines[index]);
  }
  if(current) chapters.push(current);
  const derived = chapters.map(c=>({ title:c.title, text:c.lines.join('\n').trim() }))
    .filter(c=>c.text.length > 60)
    .map(c=>({ ...c, sections: splitIntoSections(c.text) }))
    .filter(c=>c.sections.length);
  return derived.length ? derived : [{title:filename, text:String(raw||''), sections:splitIntoSections(raw)}];
}
