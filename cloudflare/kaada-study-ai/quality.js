/**
 * Deterministic structural checks for scientific English → Arabic translations.
 * These checks cannot prove semantic accuracy, so every AI translation is a reviewable draft.
 */
const digits=Object.freeze({'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'});
export function normalizeScientificSymbols(value=''){
  return String(value).replace(/[٠-٩۰-۹]/gu,ch=>digits[ch]).replace(/\\(?:leq|le)(?![a-z])/gi,'≤').replace(/\\(?:geq|ge)(?![a-z])/gi,'≥')
    .replace(/\\times/gi,'×').replace(/\\div/gi,'÷').replace(/−/g,'-').replace(/٫/g,'.').replace(/٬/g,',');
}
export function numericTokens(text){
  const normalized=normalizeScientificSymbols(text);
  return (normalized.match(/\d+(?:[.,]\d+)*(?:%|٪)?/g)||[]).map(v=>v.replace(/,/g,'')).sort();
}
function tally(text,chars){
  const normalized=normalizeScientificSymbols(text);
  return Object.fromEntries(chars.map(ch=>[ch,(normalized.split(ch).length-1)]));
}
export function assessArabicTranslation(source,translated){
  const original=String(source||'').trim(),arabic=String(translated||'').trim();
  const warnings=[];
  if(!arabic)warnings.push('empty');
  if(original.length>0 && arabic.length < Math.max(2,Math.min(35,original.length*.14)))warnings.push('too-short');
  if(arabic.length>Math.max(450,original.length*3.5))warnings.push('too-long');
  const arabicLetters=(arabic.match(/[\u0621-\u064A]/gu)||[]).length;
  const englishLetters=(arabic.match(/[a-zA-Z]/g)||[]).length;
  if(/[a-zA-Z]/.test(original)&&arabicLetters===0)warnings.push('no-arabic');
  if(arabicLetters<englishLetters*.15&&englishLetters>20)warnings.push('untranslated');
  const expected=numericTokens(original),actual=numericTokens(arabic);
  if(JSON.stringify(expected)!==JSON.stringify(actual))warnings.push('numbers-changed');
  const maths=['=','≤','≥','<','>'];
  const inSource=tally(original,maths),inArabic=tally(arabic,maths);
  if(maths.some(ch=>inSource[ch]!==inArabic[ch]))warnings.push('math-operators-changed');
  return {ok:warnings.length===0,warnings,sourceDigits:expected,translationDigits:actual};
}
export const OPERATIONS_RESEARCH_TERMS=Object.freeze([
  ['operations research','بحوث العمليات'],
  ['linear programming','البرمجة الخطية'],
  ['objective function','دالة الهدف'],
  ['constraints','القيود'],
  ['decision variables','متغيرات القرار'],
  ['feasible solution','حل ممكن'],
  ['feasible region','المنطقة الممكنة'],
  ['optimal solution','حل أمثل'],
  ['minimize','تقليل / إيجاد القيمة الصغرى'],
  ['maximize','تعظيم / إيجاد القيمة العظمى'],
  ['simplex method','طريقة السمبلكس'],
  ['duality','الثنائية'],
  ['transportation problem','مسألة النقل'],
]);
