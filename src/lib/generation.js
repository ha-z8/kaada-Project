/** Generated drafts must be manually reviewed and saved by the user. */
export const GENERATED_FIELDS=Object.freeze([
  'content_ar','explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en'
]);
export function validateGeneratedDraft(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw Error('لم تُرجع خدمة التوليد بيانات صالحة.');
  const output={};
  for(const name of GENERATED_FIELDS){
    if(typeof value[name]!=='string'||!value[name].trim())
      throw Error('شرح الذكاء الاصطناعي غير مكتمل. لم تُحفظ أي تغييرات.');
    output[name]=value[name].trim().slice(0,25000);
  }
  return output;
}
