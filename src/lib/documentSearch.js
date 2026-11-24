import {normalizeStudyQuery} from './lessonSearch.js';
// Search original PDF text independently of generated academic paragraphs.
function mappedText(spans){
 let text='',positions=[];
 const append=(c,p)=>{if(c===' '&&(!text||text.endsWith(' ')))return;text+=c;for(let n=0;n<c.length;n++)positions.push(p)};
 for(const span of spans){
  const value=String(span.text||'');const base=span.start||0;
  for(let i=0;i<value.length;){
   const raw=String.fromCodePoint(value.codePointAt(i));const p={index:span.index,start:base+i,end:base+i+raw.length};
   if(!/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u00ad\u200b]/u.test(raw)){
    const norm=normalizeStudyQuery(raw);if(norm)for(const c of norm)append(c,p);else append(' ',p);
   }
   i+=raw.length;
  }
  append(' ',null);
 }
 return {text:text.trimEnd(),positions};
}
export function documentSearchRanges(spans,query,mode='phrase'){
 const q=normalizeStudyQuery(query);if(!q)return [];
 const {text,positions}=mappedText(spans),terms=[...new Set(q.split(' '))];
 const find=term=>{const results=[];for(let at=text.indexOf(term);at>=0;at=text.indexOf(term,at+Math.max(1,term.length))){
  const end=at+term.length;if(mode==='word'&&((at>0&&text[at-1]!==' ')||(end<text.length&&text[end]!==' ')))continue;
  const ranges=[];for(const p of positions.slice(at,end)){if(!p)continue;const last=ranges.at(-1);if(last?.index===p.index)last.end=Math.max(last.end,p.end);else ranges.push({...p});}
  if(ranges.length)results.push(ranges);if(results.length>=100)break;
 }return results;};
 if(mode==='phrase')return find(q);
 const lists=terms.map(find);if(mode!=='any'&&lists.some(x=>!x.length))return [];
 return lists.flat().sort((a,b)=>a[0].index-b[0].index||a[0].start-b[0].start);
}
export function textMatchesDocument(text,query,mode='phrase'){
 const norm=normalizeStudyQuery(text),q=normalizeStudyQuery(query);if(!q)return false;const terms=q.split(' ');
 if(mode==='phrase')return norm.includes(q);if(mode==='word')return terms.every(t=>(' '+norm+' ').includes(' '+t+' '));if(mode==='any')return terms.some(t=>norm.includes(t));return terms.every(t=>norm.includes(t));
}
export function searchSavedDocumentItems(items,sections,query,mode='phrase',field='all',page='all'){
 const hits=[];
 if(['all','marks'].includes(field))for(const m of items){if(page!=='all'&&m.page!==Number(page))continue;const text=m.spans.map(r=>r.text).join(' ');if(textMatchesDocument(text+' '+(m.note||''),query,mode))hits.push({kind:'mark',id:'mark:'+m.id,page:m.page,text:text+(m.note?' — '+m.note:''),mark:m});}
 if(['all','translation','explanation','paragraph'].includes(field))for(const row of sections){if(!row.source_page||page!=='all'&&row.source_page!==Number(page))continue;
 const fields=field==='all'?[['paragraph',row.content_en],['translation',row.content_ar],['explanation',row.explanation_ar],['explanation',row.explanation_en]]:field==='paragraph'?[['paragraph',row.content_en]]:field==='translation'?[['translation',row.content_ar]]:[['explanation',row.explanation_ar],['explanation',row.explanation_en]];
 const matched=fields.find(([,text])=>textMatchesDocument(text,query,mode));if(matched)hits.push({kind:matched[0],id:'section:'+row.id,page:row.source_page,text:matched[1],sectionId:row.id,source:row.content_en});
 }
 return hits.sort((a,b)=>a.page-b.page);
}
