// Direct, authenticated access to the account-owned AI Worker.
// Avoids Netlify's ~30-second serverless request timeout for two-pass translations.
// No secret credentials, user content, or provider tokens are embedded here.
export const ACADEMIC_AI_URL='https://kaada-study-ai.kaada-p.workers.dev';
export async function managedAIStatus(fetcher=fetch){
  try{
    const res=await fetcher(ACADEMIC_AI_URL+'/health',{method:'GET',cache:'no-store',signal:AbortSignal.timeout(9000)});
    if(!res.ok)return {ready:false,message:'خدمة الترجمة غير متاحة مؤقتًا.'};
    const data=await res.json();
    return {ready:data?.ready===true,message:data?.ready===true?'خدمة الترجمة والشرح جاهزة.':'خدمة الترجمة غير متاحة مؤقتًا.'};
  }catch{return {ready:false,message:'تعذر الاتصال بخدمة الترجمة. تحقق من اتصال الإنترنت.'}}
}
export async function requestManagedAI({mode,sectionId,level='intermediate',accessToken,allowExternalProcessing,selectionText,fetcher=fetch}){
  if(!['translate','generate'].includes(mode))throw Error('نوع المعالجة غير صالح.');
  if(typeof accessToken!=='string'||!accessToken.trim())throw Error('سجّل الدخول أولًا.');
  if(allowExternalProcessing!==true)throw Error('يجب الموافقة على معالجة نص المادة خارجيًا.');
  if(typeof sectionId!=='string'||!sectionId.trim())throw Error('اختر فقرة صالحة أولًا.');
  let response;
  try{
    response=await fetcher(ACADEMIC_AI_URL+'/'+mode,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},
      body:JSON.stringify({section_id:sectionId,level,allow_external_processing:true,...(selectionText!==undefined?{selection_text:selectionText}:{})}),
      signal:AbortSignal.timeout(110000),
      cache:'no-store',
    });
  }catch(e){
    const timeout=e?.name==='TimeoutError'||e?.name==='AbortError';
    throw Error(timeout?'استغرقت الترجمة وقتًا أطول من المتوقع. حاول إعادة المحاولة لهذه الفقرة.':'انقطع الاتصال بخدمة الترجمة. تحقق من الإنترنت وحاول مرة أخرى.');
  }
  let data;
  try{data=await response.json()}catch{throw Error('وصل رد غير مكتمل من خدمة الذكاء الاصطناعي. أعد المحاولة.')}
  if(!response.ok){
    if(response.status===429)throw Error(data?.message||'تم بلوغ حد الاستخدام الحالي للخدمة. حاول لاحقًا.');
    if(response.status===401)throw Error('انتهت جلسة حسابك. سجّل الدخول مجددًا.');
    if(response.status===403)throw Error('هذه المعالجة متاحة للمشرف المصرح له فقط.');
    if(response.status===404)throw Error('لم يُعثر على الفقرة؛ افتح الدرس مجددًا.');
    throw Error(data?.message||('تعذّرت المعالجة (رمز '+response.status+'). حاول مرة أخرى.'));
  }
  return data;
}
