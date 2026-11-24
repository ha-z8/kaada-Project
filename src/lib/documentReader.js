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
