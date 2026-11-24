import {chunkText,sourceLanguage} from './speech.js';
/** Retain the exact text-node offsets while preparing normalized speech chunks. */
export function documentSpeechPlan(spans){
 const queue=[];
 for(const span of spans){
  const raw=String(span.text||'');
  let normalized='',offsets=[],space=false;
  for(let i=0;i<raw.length;i++){
   if(/\s/u.test(raw[i])){if(normalized&&!space){normalized+=' ';offsets.push(i);space=true;}}
   else{normalized+=raw[i];offsets.push(i);space=false;}
  }
  normalized=normalized.trimEnd();
  let seek=0;
  for(const text of chunkText(normalized)){
   const at=normalized.indexOf(text,seek);
   if(at<0)continue;
   seek=at+text.length;
   queue.push({text,lang:sourceLanguage(text)==='ar'?'ar-SA':'en-US',spanIndex:span.index,
    offsets:offsets.slice(at,at+text.length).map(i=>i+(span.start||0))});
  }
 }
 return queue;
}
export function speechHighlight(chunk,index=0,length=0){
 if(!chunk?.offsets?.length)return null;
 const start=Math.min(chunk.offsets.length-1,Math.max(0,index));
 const word=chunk.text.slice(start).match(/^\S+/u)?.[0]||'';
 const end=Math.min(chunk.offsets.length-1,start+Math.max(1,length||word.length)-1);
 return {index:chunk.spanIndex,start:chunk.offsets[start],end:chunk.offsets[end]+1};
}
export function pageSpanSelection(divs,selection){
 if(!selection||selection.isCollapsed||selection.rangeCount!==1)return [];
 const range=selection.getRangeAt(0),result=[];
 for(const [index,div] of divs.entries()){
  if(!range.intersectsNode(div))continue;
  const text=div.textContent||'';
  const start=boundaryOffset(div,range.startContainer,range.startOffset)??0;
  const end=boundaryOffset(div,range.endContainer,range.endOffset)??text.length;
  if(end>start&&text.slice(start,end).trim())result.push({index,start,end,text:text.slice(start,end)});
 }
 return result;
}

// A PDF page can split a single word or paragraph across many positioned spans.
// Keep a reversible mapping; never substitute approximate semantic matches.
const ignored=/[\s\u00ad\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
function canonical(value){return Array.from(String(value||'')).flatMap(c=>Array.from(c.normalize('NFKC'))).filter(c=>!ignored.test(c)).join('')}
function pageIndex(spans){
 let text='',positions=[];
 for(const [spanKey,span] of spans.entries()){
  const value=String(span.text||'');
  for(let i=0;i<value.length;){
   const raw=String.fromCodePoint(value.codePointAt(i));
   for(const c of raw.normalize('NFKC'))if(!ignored.test(c)){
    text+=c;for(let j=0;j<c.length;j++)positions.push({spanKey,index:span.index,offset:(span.start||0)+i,end:(span.start||0)+i+raw.length});
   }
   i+=raw.length;
  }
 }
 return {text,positions};
}
function sourceRanges(spans,positions,start,end){
 const ranges=[];
 for(let i=start;i<end;i++){
  const p=positions[i];if(!p)continue;
  const last=ranges.at(-1);
  if(last?.spanKey===p.spanKey){last.end=Math.max(last.end,p.end);}
  else ranges.push({spanKey:p.spanKey,index:p.index,start:p.offset,end:p.end});
 }
 return ranges.map(({spanKey,...r})=>{const span=spans[spanKey];return {...r,text:span.text.slice(r.start-(span.start||0),r.end-(span.start||0))}});
}
export function buildDocumentUnits(spans,sections=[]){
 const {text,positions}=pageIndex(spans);
 if(!text)return [];
 // New imports carry explicit page numbers and ordered text. Match the entire
 // page first, including tiny headings, repeated phrases and numeric labels.
 const mapped=sections.filter(s=>Number.isInteger(s.source_page)).sort((a,b)=>a.position-b.position);
 if(mapped.length&&mapped.map(s=>canonical(s.content_en)).join('')===text){
  let cursor=0;
  return mapped.flatMap(section=>{
   const end=cursor+canonical(section.content_en).length;
   const ranges=sourceRanges(spans,positions,cursor,end);cursor=end;
   const source=String(section.content_en||'');if(!source.trim())return [];
   const native=sourceLanguage(source);
   return [{ranges,source,native,sectionId:section.id,translation:native==='en'?String(section.content_ar||'').trim():'',matched:true,reviewed:!!section.translation_reviewed_at}];
  });
 }
 const matches=new Map();
 const letter=/[\p{L}\p{N}]/u;
 const insideWord=at=>{if(at<=0||at>=positions.length)return false;const a=positions[at-1],b=positions[at];return a.spanKey===b.spanKey&&a.end===b.offset&&letter.test(text[at-1])&&letter.test(text[at]);};
 for(const section of sections){
  const needle=canonical(section.content_en);
  if(!needle||needle.length<5)continue;
  for(let at=text.indexOf(needle);at>=0;at=text.indexOf(needle,at+needle.length)){
   const end=at+needle.length;if(insideWord(at)||insideWord(end))continue;const key=at+':'+end;
   const candidate={start:at,end,section,translation:String(section.content_ar||'').trim()};
   const old=matches.get(key);
   if(old){if(old.translation!==candidate.translation)old.ambiguous=true;}
   else matches.set(key,candidate);
  }
 }
 const candidates=[...matches.values()].sort((a,b)=>a.start-b.start||b.end-a.end);
 const units=[];
 const emit=(start,end,match=null)=>{
  if(end<=start)return;
  const ranges=sourceRanges(spans,positions,start,end);
  const source=ranges.map(r=>r.text).join(' ');
  if(!source.trim())return;
  const native=sourceLanguage(source);
  units.push({ranges,source,native,sectionId:match?.ambiguous?null:match?.section?.id||null,
   translation:match&&!match.ambiguous&&native==='en'?match.translation:'',matched:!!match&&!match.ambiguous,
   reviewed:!!match?.section?.translation_reviewed_at});
 };
 const emitGap=(start,end)=>{
  // Divide unpaired text at visible paragraph gaps or sentence/line boundaries.
  // No translation is invented for such text.
  let segment=start;
  for(let i=start+1;i<end;i++){
   const prev=positions[i-1],next=positions[i];if(prev.spanKey===next.spanKey)continue;
   const a=spans[prev.spanKey],b=spans[next.spanKey];
   const lineChange=Number.isFinite(a.y)&&Number.isFinite(b.y)&&Math.abs(a.y-b.y)>Math.max(3,(a.height||10)*.5);
   const paragraphGap=lineChange&&Math.abs(a.y-b.y)>Math.max(a.height||10,b.height||10)*1.65;
   const endSentence=/[.!?؟؛]/u.test(text[i-1]);
   if(paragraphGap||(lineChange&&endSentence)||(i-segment>280&&lineChange)){emit(segment,i);segment=i;}
  }
  emit(segment,end);
 };
 let cursor=0;
 for(const m of candidates){
  if(m.start<cursor)continue;
  // Reject overlapping non-identical matches; ambiguous source must not acquire a translation.
  if(candidates.some(other=>other!==m&&other.start<m.end&&other.end>m.start&&other.start>=cursor)){
   continue;
  }
  emitGap(cursor,m.start);emit(m.start,m.end,m);cursor=m.end;
 }
 emitGap(cursor,text.length);
 return units;
}
export function unitIntersects(unit,ranges){return unit.ranges.some(a=>ranges.some(b=>a.index===b.index&&a.start<b.end&&b.start<a.end))}
export function sameDocumentRanges(a,b){
 const key=r=>r.flatMap(x=>Array.from({length:x.text.length},(_,i)=>ignored.test(x.text[i])?null:x.index+':'+(x.start+i)).filter(Boolean)).join('|');
 return key(a)===key(b);
}
// Multiple saved highlights may overlap. Merge them rather than reading twice.
export function mergeDocumentRanges(ranges,spans){
 const out=[];
 for(const r of [...ranges].sort((a,b)=>a.index-b.index||a.start-b.start)){
  const last=out.at(-1);
  if(last?.index===r.index&&last.end>=r.start)last.end=Math.max(last.end,r.end);
  else out.push({index:r.index,start:r.start,end:r.end});
 }
 return out.map(r=>({...r,text:(spans.find(s=>s.index===r.index)?.text||'').slice(r.start,r.end)})).filter(r=>r.text.trim());
}
export function documentUnitPlan(unit,track){
 const english=unit.native==='en',arabic=unit.native==='ar';
 if(track==='en'&&!english||track==='ar'&&english&&!unit.translation||track==='mixed'&&(!english||!unit.translation))
  return {parts:[],missing:true};
 const parts=[];
 if(track==='en'||track==='mixed'||track==='ar'&&arabic){
  // Combine the source words naturally, while preserving per-character mapping.
  const joined=unit.ranges.map(r=>r.text).join(' ');
  const normalized=joined.replace(/\s+/g,' ').trim();
  let rawIndex=0,locations=[];
  for(let i=0;i<unit.ranges.length;i++){
   const r=unit.ranges[i];for(let j=0;j<r.text.length;j++)locations.push({index:r.index,start:r.start+j,end:r.start+j+1});
   if(i<unit.ranges.length-1)locations.push(null);
  }
  const normalizedLocations=[];
  for(let i=0;i<joined.length;i++){
   const c=joined[i];if(/\s/u.test(c)){
    if(normalizedLocations.length&&i>0&&!/\s/u.test(joined[i-1]))normalizedLocations.push(locations[i]||null);
   }else normalizedLocations.push(locations[i]||null);
  }
  for(const text of chunkText(normalized)){
   const at=normalized.indexOf(text,rawIndex);if(at<0)continue;rawIndex=at+text.length;
   parts.push({text,lang:english?'en-US':'ar-SA',locations:normalizedLocations.slice(at,at+text.length),ranges:unit.ranges,translated:false});
  }
 }
 if((track==='ar'&&english)||track==='mixed')for(const text of chunkText(unit.translation))parts.push({text,lang:'ar-SA',ranges:unit.ranges,translated:true});
 return {parts,missing:false};
}
export function documentPartHighlight(part,index=null,length=0){
 if(!part)return [];
 if(part.translated||index===null||!part.locations)return part.ranges||[];
 const start=Math.max(0,index),word=part.text.slice(start).match(/^\S+/u)?.[0]||'';
 const ranges=[];
 for(const loc of part.locations.slice(start,start+Math.max(1,length||word.length))){
  if(!loc)continue;const last=ranges.at(-1);
  if(last?.index===loc.index)last.end=Math.max(last.end,loc.end);
  else ranges.push({...loc});
 }
 return ranges.length?ranges:part.ranges;
}
function boundaryOffset(div,container,offset){
 if(container===div||div.contains(container)){
  const prefix=document.createRange();prefix.selectNodeContents(div);prefix.setEnd(container,offset);return prefix.toString().length;
 }
 return null;
}
export function rangeForDocumentText(div,start,end){
 if(!div||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start)return null;
 const walker=document.createTreeWalker(div,NodeFilter.SHOW_TEXT),range=document.createRange();
 let pos=0,a=false,b=false;
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  const next=pos+node.length;
  if(!a&&start<next){range.setStart(node,start-pos);a=true;}
  if(a&&end<=next){range.setEnd(node,end-pos);b=true;break;}
  pos=next;
 }
 return a&&b?range:null;
}

export function pageSections(spans,page){
 return buildDocumentUnits(spans,[]).flatMap(unit=>{
  // Split by original span boundaries only; never split a word or omit any text.
  const chunks=[];let buffer=[];
  for(const range of unit.ranges){
   if(buffer.length&&buffer.map(x=>x.text).join(' ').length+range.text.length>420){chunks.push(buffer);buffer=[]}
   buffer.push(range);
  }
  if(buffer.length)chunks.push(buffer);
  return chunks.map(ranges=>({text:ranges.map(r=>r.text).join(' '),page}));
 });
}
export function documentUnitKey(unit){return unit.sectionId||unit.ranges.map(r=>r.index+':'+r.start+':'+r.end).join('|')}
export function toggleParagraphSelection(items,page,unit){
 const key=documentUnitKey(unit);
 const index=items.findIndex(x=>x.page===page&&x.key===key);
 if(index>=0)return items.filter((_,i)=>i!==index);
 return [...items,{key,page,spans:unit.ranges}];
}
export function recordDocumentProgress(progress,track,page,unitKey,completed=false){
 const tracks={...(progress.tracks||{})},old=tracks[track]||{pages:[],units:{}};
 const units={...(old.units||{})},pages=new Set(old.pages||[]);
 if(completed){if(unitKey)units[page]=[...new Set([...(units[page]||[]),unitKey])];else pages.add(page)}
 tracks[track]={...old,pages:[...pages].sort((a,b)=>a-b),units,lastPage:page,lastUnit:unitKey||null};
 return {...progress,page,tracks};
}

export const MARK_COLORS={yellow:'#f4d34b',green:'#55c78b',blue:'#64b5ed',pink:'#ec91bd',purple:'#b49aee',orange:'#f4a65d'};
export const MARK_TYPES={normal:'عادي',important:'مهم',review:'للمراجعة',difficult:'صعب',definition:'مصطلح'};
/** Snap ranges to whole words, retaining exact UTF-16 positions in each PDF span. */
export function snapWordRanges(ranges,spans){
 const out=[];
 for(const r of ranges){
  const span=spans.find(x=>x.index===r.index);if(!span)continue;
  const base=span.start||0,value=String(span.text||'');
  let start=Math.max(0,r.start-base),end=Math.min(value.length,r.end-base);
  if(end<=start)continue;
  // Arabic diacritics and apostrophes/hyphens inside words stay attached.
  for(const m of value.matchAll(/[\p{L}\p{N}\p{M}]+(?:['’\-][\p{L}\p{N}\p{M}]+)*/gu)){
   const a=m.index,b=a+m[0].length;
   if(a<end&&b>start){start=Math.min(start,a);end=Math.max(end,b);}
  }
  out.push({index:r.index,start:start+base,end:end+base,text:value.slice(start,end)});
 }
 return mergeDocumentRanges(out,spans);
}
export function changeMarkRanges(existing,selected,spans,mode='replace'){
 if(mode==='replace')return snapWordRanges(selected,spans);
 if(mode==='add')return mergeDocumentRanges([...existing,...snapWordRanges(selected,spans)],spans);
 if(mode==='subtract'){
  let result=existing.map(r=>({...r}));
  for(const cut of snapWordRanges(selected,spans)){
   result=result.flatMap(r=>{
    if(r.index!==cut.index||r.end<=cut.start||r.start>=cut.end)return [r];
    const pieces=[];
    if(r.start<cut.start)pieces.push({...r,end:cut.start});
    if(r.end>cut.end)pieces.push({...r,start:cut.end});
    return pieces;
   });
  }
  return mergeDocumentRanges(result,spans);
 }
 return existing;
}
export function normalizedMark(mark){
 return {...mark,color:MARK_COLORS[mark.color]?mark.color:'yellow',type:MARK_TYPES[mark.type]?mark.type:'normal',note:String(mark.note||'').slice(0,2500)};
}
export function selectionExplanationPlan(units,sections,track){
 const parts=[];
 for(const unit of units){
  const section=sections.find(s=>s.id===unit.sectionId);
  const en=String(section?.explanation_en||'').trim(),ar=String(section?.explanation_ar||'').trim();
  if((track!=='ar'&&!en)||(track!=='en'&&!ar))return {parts:[],missing:true};
  for(const [lang,text] of [['en-US',en],['ar-SA',ar]]){
   if((lang==='en-US'&&track==='ar')||(lang==='ar-SA'&&track==='en'))continue;
   for(const chunk of chunkText(text))parts.push({lang,text:chunk,ranges:unit.ranges,sectionId:unit.sectionId});
  }
 }
 return {parts,missing:!parts.length};
}

/** Prepare one queue per page, retaining the original paragraph and language of each chunk.
 * Missing translations must not prevent the original English from being read.
 * Never pass an English passage to an Arabic-only voice or vice versa.
 */
export function pagePlaybackPlan(units,track){
 const parts=[],incomplete=[],completeKeys=[];
 for(const unit of units){
  let plan=documentUnitPlan(unit,track);
  const key=documentUnitKey(unit);
  if(plan.missing){
   incomplete.push(key);
   if(track==='mixed'&&unit.native==='en')plan=documentUnitPlan(unit,'en');
   else if(track==='mixed'&&unit.native==='ar')plan=documentUnitPlan(unit,'ar');
   else continue;
  }else completeKeys.push(key);
  const chunks=plan.parts.map(p=>({...p,unitKey:key,unit,completesUnit:false}));
  if(chunks.length&&!incomplete.includes(key))chunks.at(-1).completesUnit=true;
  parts.push(...chunks);
 }
 return {parts,incomplete,completeKeys};
}
export function playbackPage(value,total,fallback=1){
 const page=Number(value);
 return Number.isInteger(page)&&page>=1&&page<=total?page:Math.max(1,Math.min(total,fallback));
}

/** The reading order is document order, not save time or the current search filter. */
export function orderedAnnotations(items){
 return [...items].filter(m=>Number.isInteger(m.page)&&m.spans?.length).sort((a,b)=>a.page-b.page||Math.min(...a.spans.map(r=>r.index))-Math.min(...b.spans.map(r=>r.index))||a.spans[0].start-b.spans[0].start||String(a.id||a.key).localeCompare(String(b.id||b.key)));
}
export function annotationId(item){return item.id||item.page+':'+item.key}
export function annotationPlayback(items,mode='all',ids=[],startId=null){
 const sorted=orderedAnnotations(items);
 if(mode==='checked'){const selected=new Set(ids);return sorted.filter(m=>selected.has(annotationId(m)))}
 if(mode==='from'||mode==='single'){const i=sorted.findIndex(m=>annotationId(m)===startId);return i<0?[]:mode==='single'?[sorted[i]]:sorted.slice(i)}
 return sorted;
}
/** Each disjoint selected range is a separate translation target. No unselected
 * source words or whole-paragraph translation can enter a partial selection. */
export function selectedDocumentUnits(units,picked,spans){
 return units.flatMap(unit=>{
  const runs=[];let current=[];
  const flush=()=>{if(current.length){runs.push(current);current=[];}};
  for(const a of unit.ranges){
   const cuts=mergeDocumentRanges(picked.filter(b=>a.index===b.index).map(b=>({index:a.index,start:Math.max(a.start,b.start),end:Math.min(a.end,b.end)})).filter(b=>b.end>b.start),spans);
   if(!cuts.length){if(a.text.trim())flush();continue;}
   let cursor=a.start;
   for(const cut of cuts){
    if(a.text.slice(cursor-a.start,cut.start-a.start).trim())flush();
    current.push(cut);cursor=cut.end;
   }
   if(a.text.slice(cursor-a.start).trim())flush();
  }
  flush();
  return runs.map(ranges=>{
   const partial=!sameDocumentRanges(unit.ranges,ranges);
   return {...unit,ranges,source:ranges.map(r=>r.text).join(' '),partial,translation:partial?'':unit.translation,reviewed:partial?false:unit.reviewed};
  });
 });
}
export function selectionTranslationKey(unit){return JSON.stringify([unit.sectionId||'',unit.source]);}
export async function resolveSelectionTranslations(units,translate,cache=new Map()){
 const result=[];
 for(const unit of units){
  if(unit.native==='ar'||unit.translation){result.push(unit);continue;}
  if(!/[\p{L}]/u.test(unit.source)){result.push({...unit,translation:unit.source});continue;}
  const key=selectionTranslationKey(unit);
  let translation=cache.get(key);
  if(!translation){
   const result=await translate(unit);
   translation=typeof result==='object'&&result!==null?{translation:String(result.translation||'').trim(),method:result.method||'ai'}:String(result||'').trim();
   if(!(typeof translation==='string'?translation:translation.translation))throw Error('لم تصل ترجمة للنص المحدد.');
   if(cache.size>=200)cache.delete(cache.keys().next().value);
   cache.set(key,translation);
  }
  result.push({...unit,translation:typeof translation==='string'?translation:translation.translation,translationMethod:typeof translation==='string'?'ai':translation.method,reviewed:false});
 }
 return result;
}

export function documentWordAt(spans,index,offset){
 const span=spans.find(s=>s.index===index);if(!span||!Number.isInteger(offset))return [];
 const base=span.start||0,at=offset-base;
 const words=[...String(span.text||'').matchAll(/[\p{L}\p{N}\p{M}]+(?:['’\-][\p{L}\p{N}\p{M}]+)*/gu)];
 const match=words.find(m=>m.index<=at&&at<m.index+m[0].length)||words.find(m=>m.index+m[0].length===at);
 return match?[{index,start:base+match.index,end:base+match.index+match[0].length,text:match[0]}]:[];
}
export function wordPlaybackPlan(units,track){
 if(track!=='ar-first')return pagePlaybackPlan(units,track);
 const parts=[],incomplete=[],completeKeys=[];
 for(const unit of units){
  const plan=pagePlaybackPlan([unit],'mixed');
  const reordered=[...plan.parts.filter(p=>p.lang.startsWith('ar')),...plan.parts.filter(p=>!p.lang.startsWith('ar'))];
  for(const part of reordered)part.completesUnit=false;
  if(reordered.length&&!plan.incomplete.length)reordered.at(-1).completesUnit=true;
  parts.push(...reordered);incomplete.push(...plan.incomplete);completeKeys.push(...plan.completeKeys);
 }
 return {parts,incomplete,completeKeys};
}
