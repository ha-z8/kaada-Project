import { speechParts, chunkText } from './speech.js';

export const NATURAL_VOICES = Object.freeze([
  {id:'coral',label:'كورال — واضح وحيوي'},
  {id:'nova',label:'نوفا — هادئ ومريح'},
  {id:'onyx',label:'أونيكس — عميق ورزين'},
  {id:'sage',label:'سيج — متوازن'},
  {id:'shimmer',label:'شيمر — ناعم'},
  {id:'alloy',label:'ألوي — محايد'},
]);
export function buildVoiceText(section,track,purpose) {
  if (!section||!['ar','en','mixed'].includes(track)||!['read','explain'].includes(purpose))return '';
  if(purpose==='explain'&&track==='mixed'&&section.explanation_mixed?.trim())
    return section.explanation_mixed.trim();
  const parts=speechParts(section,track,purpose);
  return parts.map(item=>item.text).filter(Boolean).join('\n\n');
}
export function voiceChunks(text,maxChars=1500) {
  const chunks=chunkText(text,maxChars);
  if(chunks.length>12)throw Error('النص طويل جدًا للتوليد الصوتي. قسّمه إلى فقرات أصغر.');
  return chunks;
}
