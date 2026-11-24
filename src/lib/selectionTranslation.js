import {lookupAcademicTerm,selectionKeyText} from './academicGlossary.js';
const friendly='لا تتوفر ترجمة لهذا النص حاليًا. جرّب اختيار كلمة أخرى أو فتح ترجمة الفقرة عند توفرها.';
export function findSavedSelection(unit,sections=[]){
 const key=selectionKeyText(unit.source);if(!key)return '';
 const matches=sections.filter(s=>selectionKeyText(s.content_en)===key&&s.content_ar?.trim());
 const distinct=[...new Set(matches.map(s=>s.content_ar.trim()))];return distinct.length===1?distinct[0]:'';
}
async function nativeTranslation(source,translator){
 if(!translator||typeof translator.availability!=='function'||typeof translator.create!=='function')return '';
 let instance,timer;
 const controller=new AbortController();
 try{
  const options={sourceLanguage:'en',targetLanguage:'ar'};
  const task=(async()=>{
   const state=await translator.availability(options);
   if(!['available','downloadable','downloading'].includes(state))return '';
   // Model installation may require activation. If absent, skip rather than fail.
   if(state!=='available'&&globalThis.navigator?.userActivation?.isActive===false)return '';
   instance=await translator.create({...options,signal:controller.signal});
   if(controller.signal.aborted){instance?.destroy?.();return '';}
   const result=String(await instance.translate(source,{signal:controller.signal})||'').trim();
   return /[\u0621-\u064a]/u.test(result)?result:'';
  })();
  return await Promise.race([task,new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve('')},25000)})]);
 }catch{return ''}finally{clearTimeout(timer);try{instance?.destroy?.()}catch{}}
}
/** Browser-independent exact saved translations and local glossary. Native
 * translation is optional, never an assumption based on browser name.
 * No new third-party service and no public access to privileged AI operations. */
export async function translateDocumentSelection(unit,{isAdmin=false,sections=[],translator=globalThis.Translator,online=globalThis.navigator?.onLine!==false,translateAdmin,translateLocal,readSaved,writeSaved}={}){
 const source=String(unit?.source||'').trim();if(!source)throw Error('حدد نصًا أولًا.');
 if(unit.native==='ar')return {translation:source,method:'original'};
 const saved=findSavedSelection(unit,sections);if(saved)return {translation:saved,method:'saved'};
 let cached;try{cached=await readSaved?.(source);}catch{}if(cached?.translation)return cached;
 const remember=async result=>{try{await writeSaved?.(source,result)}catch{}return result;};
 if(!/[\p{L}]/u.test(source))return {translation:source,method:'literal'};
 if(isAdmin&&unit.sectionId&&online){
  try{const request=translateAdmin||(await import('./api.js')).translateSelectedText;const translated=String(await request(unit.sectionId,source)||'').trim();if(translated)return remember({translation:translated,method:'ai'});}catch{}
 }
 // A known exact term is instant and avoids a failed native model download.
 const term=lookupAcademicTerm(source);if(term)return {translation:term,method:'glossary'};
 try{const local=translateLocal||(typeof window!=='undefined'?(await import('./localTranslation.js')).translateLocally:null);const result=await local?.(source);if(result)return remember({translation:result,method:'local'});}catch(e){if(!online)throw Error(e?.message||'تعذّر تشغيل المترجم المحلي.');}
 const translated=await nativeTranslation(source,translator);if(translated)return remember({translation:translated,method:'browser'});
 throw Error(online?friendly:'لا توجد ترجمة محفوظة لهذا النص. جهّز المترجم المحلي من إعدادات الاستماع قبل انقطاع الاتصال.');
}
