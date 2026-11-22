import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL,PUBLIC_SUPABASE_KEY } from '../../src/lib/publicSupabaseConfig.js';
import { NATURAL_VOICES, buildVoiceText, voiceChunks } from '../../src/lib/naturalVoice.js';

const respond=(message,status)=>Response.json({message},{status,headers:{'Cache-Control':'no-store'}});
export default async function handler(req){
  if(req.method!=='POST')return respond('طريقة الطلب غير صحيحة.',405);
  const raw=req.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+$/i.test(raw))return respond('سجّل الدخول حتى تستخدم الصوت الذكي.',401);
  let body;
  try{body=await req.json()}catch{return respond('بيانات الطلب غير صحيحة.',400)}
  const {section_id,voice,track,purpose,part_index,allow_external_processing}=body||{};
  if(allow_external_processing!==true)return respond('يلزم موافقتك على إرسال الفقرة إلى مزود الصوت.',403);
  if(typeof section_id!=='string'||!/^[0-9a-f-]{36}$/i.test(section_id)
    ||!NATURAL_VOICES.some(v=>v.id===voice)
    ||!['ar','en','mixed'].includes(track)||!['read','explain'].includes(purpose)
    ||!Number.isInteger(part_index)||part_index<0||part_index>11)return respond('اختيار الصوت أو الفقرة غير صحيح.',400);
  const supabaseUrl=process.env.SUPABASE_URL||PUBLIC_SUPABASE_URL;
  const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY||PUBLIC_SUPABASE_KEY;
  if(!process.env.OPENAI_API_KEY)return respond('ميزة الصوت الواقعي تحتاج تفعيل خدمة الذكاء الاصطناعي أو مفتاحها السري في Netlify Functions.',503);
  try {
    const jwt=raw.replace(/^Bearer\s+/i,'');
    const db=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+jwt}}});
    const {data:auth,error:authError}=await db.auth.getUser(jwt);
    if(authError||!auth?.user)return respond('انتهت جلسة الدخول. سجّل الدخول من جديد.',401);
    const {data:section,error:loadError}=await db.from('sections').select('id,content_en,content_ar,explanation_en,explanation_ar,explanation_mixed,speech_en,speech_ar').eq('id',section_id).single();
    if(loadError||!section)return respond('الفقرة غير متاحة.',404);
    const text=buildVoiceText(section,track,purpose);
    if(!text.trim())return respond('هذا المسار لا يحتوي على شرح أو ترجمة بعد.',422);
    let chunks;
    try{chunks=voiceChunks(text)}catch{return respond('الفقرة طويلة جدًا، قسّمها إلى فقرات أصغر أولًا.',422)}
    if(part_index>=chunks.length)return respond('جزء الصوت المطلوب غير موجود.',400);
    const client=new OpenAI({timeout:45000,maxRetries:0});
    const audio=await client.audio.speech.create({
      model:process.env.KAADA_TTS_MODEL||'gpt-4o-mini-tts',
      voice,
      input:chunks[part_index],
      instructions:track==='ar'
        ? 'Speak clear natural Modern Standard Arabic with a warm, engaging teaching tone, moderate pace and careful scientific terminology pronunciation. Avoid exaggeration.'
        : track==='en'
          ? 'Teach in clear, warm, natural English. Speak at a comfortable learning pace, pronounce scientific terminology precisely, and pause briefly at sentence endings.'
          : 'Read this bilingual educational content naturally: pronounce Arabic in clear Modern Standard Arabic and pronounce English technical terms in English. Speak warmly and deliberately.',
      response_format:'mp3',
    });
    const bytes=await audio.arrayBuffer();
    return new Response(bytes,{status:200,headers:{
      'Content-Type':'audio/mpeg','Cache-Control':'private, no-store',
      'X-Kaada-Parts':String(chunks.length),'X-Kaada-Part':String(part_index),
      'X-AI-Generated':'true',
    }});
  }catch(e) {
    if(e?.status===429)return respond('تم بلوغ الحد المسموح للصوت الذكي. حاول بعد قليل.',429);
    if(e?.status===401||e?.status===403)return respond('مفتاح مزود الصوت غير صالح أو البوابة غير مفعلة.',503);
    console.error('natural-voice-error',{name:e?.name,status:e?.status});
    return respond('تعذر توليد الصوت الواقعي حاليًا. استخدم صوت الجهاز كبديل.',502);
  }
}
export const config={
  path:'/api/study/voice',
  method:'POST',
  rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:12},
};
