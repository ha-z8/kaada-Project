import { speechParts, chunkText } from './speech.js';

export const NATURAL_VOICE_CHOICES=Object.freeze({
  ar:Object.freeze([
    {id:'coral',label:'نَدى'},
    {id:'onyx',label:'راوي'},
    {id:'sage',label:'رِواء'},
  ]),
  en:Object.freeze([
    {id:'nova',label:'Olivia'},
    {id:'alloy',label:'Noah'},
    {id:'shimmer',label:'Grace'},
  ]),
});
export const NATURAL_VOICES=Object.freeze([
  ...NATURAL_VOICE_CHOICES.ar.map(v=>({...v,language:'ar'})),
  ...NATURAL_VOICE_CHOICES.en.map(v=>({...v,language:'en'})),
]);
export const naturalVoiceChoices=track=>NATURAL_VOICE_CHOICES[track==='en'?'en':'ar'];
export function chooseNaturalVoice(track,preferred){
  const choices=naturalVoiceChoices(track);
  return choices.find(x=>x.id===preferred)?.id||choices[0].id;
}
export function isAllowedNaturalVoice(track,voice){
  return naturalVoiceChoices(track).some(x=>x.id===voice);
}
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
