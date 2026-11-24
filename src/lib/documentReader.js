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
  const node=div.firstChild;
  if(!node||node.nodeType!==3||!range.intersectsNode(node))continue;
  const start=range.startContainer===node?range.startOffset:0;
  const end=range.endContainer===node?range.endOffset:node.length;
  if(end>start&&node.data.slice(start,end).trim())result.push({index,start,end,text:node.data.slice(start,end)});
 }
 return result;
}
