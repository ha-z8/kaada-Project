export function cleanVoiceText(text){return String(text||'').normalize('NFKC').replace(/[\u00ad\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu,'').replace(/ـ/gu,'').replace(/\s+/gu,' ').trim();}
export function modelPhonemeIds(phonemes,config){
 const map=config?.phoneme_id_map;
 if(!map||!Array.isArray(phonemes))throw Error('خريطة نطق النموذج غير صالحة.');
 const ids=[...(map['^']||[1]),...(map['_']||[0])];let mapped=0;
 for(const p of phonemes){
  const symbols=config.phoneme_map?.[p]||[p];
  for(const symbol of symbols){const values=map[symbol];if(!Array.isArray(values))continue;ids.push(...values,...(map['_']||[0]));mapped++;}
 }
 if(!mapped)throw Error('تعذّر تحويل النص إلى نطق النموذج.');
 ids.push(...(map['$']||[2]));return ids.map(BigInt);
}
export function languageRuns(text,defaultLang='en-US'){
 const source=String(text||''),out=[];let current='',lang='',start=0;
 for(const match of source.matchAll(/\p{Script=Arabic}+(?:\p{M}+)?|[\p{Script=Latin}\p{M}]+|[^\p{Script=Arabic}\p{Script=Latin}\p{M}]+|\p{M}+/gu)){
  const word=match[0];const next=/\p{Script=Arabic}/u.test(word)?'ar-SA':/\p{Script=Latin}/u.test(word)?'en-US':lang||defaultLang;
  if(lang&&lang!==next){out.push({lang,text:current,offset:start});current='';start=match.index;}
  if(!current)start=match.index;
  lang=next;current+=word;
 }
 if(current)out.push({lang,text:current,offset:start});
 return out.filter(r=>r.text.trim());
}
