import { speechParts } from './speech.js';

/**
 * Deterministic passage-by-passage narration.
 * Mixed ALWAYS means original English then the matching Arabic text, never
 * separate all-English and all-Arabic passes over the whole lesson.
 * Stop at first incomplete pair: never read the next English paragraph
 * as if it were the Arabic translation of the current paragraph.
 */
export function lessonPlaybackPlan(sections,startIndex=0,track='mixed',purpose='read',continueNext=true){
 const list=Array.isArray(sections)?sections:[];
 if(!['mixed','en','ar'].includes(track))return {queue:[],stopReason:'invalid-track'};
 const start=Math.max(0,Math.min(list.length,Math.trunc(Number(startIndex)||0)));
 const queue=[];
 for(let i=start;i<list.length;i++){
  const section=list[i];
  const parts=speechParts(section,track,purpose);
  if(!parts.length)return {queue,stopAt:i,stopReason:purpose==='explain'?'missing-explanation':'missing-translation'};
  queue.push({sectionIndex:i,sectionId:section.id,parts});
  if(!continueNext)break;
 }
 return {queue,stopAt:null,stopReason:null};
}
