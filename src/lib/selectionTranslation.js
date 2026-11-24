import {translateSelectedText} from './api.js';
// Public readers can translate locally on compatible browsers. No anonymous
// access to the administrator's model endpoint and no new external provider.
export async function translateDocumentSelection(unit,{isAdmin=false}={}){
 if(unit.native==='ar')return unit.source;
 if(isAdmin&&unit.sectionId&&navigator.onLine!==false)return translateSelectedText(unit.sectionId,unit.source);
 const translator=globalThis.Translator;
 if(!translator)throw Error('ترجمة النص المحدد تحتاج متصفحًا يدعم الترجمة المباشرة أو حساب مشرف متصلًا بالإنترنت.');
 const options={sourceLanguage:'en',targetLanguage:'ar'};
 const available=await translator.availability(options);
 if(available==='unavailable')throw Error('الترجمة المباشرة غير متاحة على هذا الجهاز.');
 const instance=await translator.create(options);
 try{const result=String(await instance.translate(unit.source)||'').trim();if(!result||!/[\u0621-\u064a]/u.test(result))throw Error('لم تتوفر ترجمة عربية للنص المحدد.');return result;}
 finally{instance.destroy?.();}
}
