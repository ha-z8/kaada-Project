export const LOCAL_TRANSLATION_CACHE='hsa-local-translation-v1';
export const LOCAL_TRANSLATION_MODEL='Xenova/opus-mt-en-ar';
export const LOCAL_TRANSLATION_REVISION='665d6d37d9998fd81676866b1874a700a38b53c8';
export const LOCAL_TRANSLATION_READY='/translation-runtime/ready-v1';
export const LOCAL_TRANSLATION_EVENT='hsa:local-translation-ready';
export const LOCAL_TRANSLATION_SAMPLE='The student reads a book.';
export function translationInput(text){return String(text||'').normalize('NFC').replace(/[\u00ad\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu,'').replace(/\s+/gu,' ').trim();}
export function translationChunks(text,limit=220){
 const normalized=translationInput(text),chunks=[];let current='';
 for(const word of normalized.split(' ')){if(!word)continue;if(word.length>limit)throw Error('النص المحدد يتضمن كلمة طويلة جدًا للترجمة المحلية.');if(current&&(current+' '+word).length>limit){chunks.push(current);current='';}current+=(current?' ':'')+word;}if(current)chunks.push(current);return chunks;
}
