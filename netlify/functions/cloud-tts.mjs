/**
 * HSA 4 Study -- same-origin, server-only Google Cloud TTS proxy.
 * Google API credentials MUST be set as a Netlify Functions secret. Never
 * ship the credential to JS or git. Every requested speaker is allowlisted.
 * No OS/browser speech fallback is used for these twelve voices.
 */
import {CLOUD_VOICES,findCloudVoice} from '../../src/lib/cloudVoiceCatalog.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
}});
const MAX_TEXT=650;
const MAX_BODY=2500;
const VOICE_IDS=new Set(CLOUD_VOICES.map(v=>v.id));
const validOrigin=origin=>!origin||origin==='https://kaada-pro.netlify.app'
 ||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173';

export const config={
 rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:45},
};
export default async function handler(request){
 if(request.method==='GET'){
  return json({ready:Boolean(process.env.GOOGLE_CLOUD_TTS_API_KEY),
   voices:CLOUD_VOICES.length,
   provider:'google-chirp3-hd',
   arabicAccent:'ar-XA',
   configured:Boolean(process.env.GOOGLE_CLOUD_TTS_API_KEY)});
 }
 if(request.method!=='POST')return json({message:'استخدم طلب POST.'},405);
 const origin=request.headers.get('origin')||'';
 if(!validOrigin(origin))return json({message:'هذا المصدر غير مصرح.'},403);
 if(Number(request.headers.get('content-length')||0)>MAX_BODY)
  return json({message:'النص طويل. اختر فقرة أقصر.'},413);
 const secret=process.env.GOOGLE_CLOUD_TTS_API_KEY;
 if(!secret)return json({code:'TTS_NOT_CONFIGURED',
  message:'يلزم تفعيل مفتاح Google Cloud Text-to-Speech داخل إعدادات Netlify ليعمل استوديو الأصوات الاثنا عشر.'},503);
 let input;
 try{
  const raw=await request.text();
  if(raw.length>MAX_BODY)return json({message:'الطلب أكبر من المسموح.'},413);
  input=JSON.parse(raw);
 }catch{return json({message:'صيغة الطلب غير صحيحة.'},400)}
 const voiceId=String(input?.voiceId||'');
 const spoken=typeof input?.text==='string'?input.text.trim():'';
 if(!VOICE_IDS.has(voiceId)||!spoken||spoken.length>MAX_TEXT
    ||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(spoken))
   return json({message:'الصوت أو النص المطلوب غير صحيح.'},422);
 const voice=findCloudVoice(voiceId);
 // Google Chirp3-HD uses text input (not SSML). No server-side speed/pitch
 // manipulation: provider voices are distinct actual trained speakers.
 const requestBody={input:{text:spoken},
  voice:{languageCode:voice.locale,name:voice.providerId},
  audioConfig:{audioEncoding:'MP3'}};
 try{
  const response=await fetch('https://texttospeech.googleapis.com/v1/text:synthesize',{
   method:'POST',
   headers:{'Content-Type':'application/json','X-Goog-Api-Key':secret},
   body:JSON.stringify(requestBody),
   signal:AbortSignal.timeout(25000)
  });
  if(!response.ok){
   // Never return the raw Google error (could expose project/billing details).
   if(response.status===429)return json({message:'وصلت خدمة الصوت إلى حد الاستخدام. حاول مرة أخرى لاحقًا.'},429);
   if([400,401,403].includes(response.status))
    return json({message:'خدمة الصوت غير مفعلة بالكامل أو رُفض طلبها. تحقق من المفتاح والفوترة والصلاحيات.'},503);
   return json({message:'تعذّر إنشاء الصوت الآن. حاول لاحقًا.'},502);
  }
  const body=await response.json();
  const encoded=body?.audioContent;
  if(typeof encoded!=='string'||encoded.length<60)
   return json({message:'عاد مزوّد الصوت بنتيجة غير مكتملة.'},502);
  const bytes=Buffer.from(encoded,'base64');
  if(bytes.length<32||bytes.length>4000000)
   return json({message:'ملف الصوت غير صالح أو تجاوز الحد.'},502);
  return new Response(bytes,{status:200,headers:{
   'Content-Type':'audio/mpeg','Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff','Content-Length':String(bytes.length)
  }});
 }catch{
  return json({message:'تعذّر الوصول إلى مزوّد الصوت السحابي. تحقق من الاتصال ثم أعد المحاولة.'},502);
 }
}
