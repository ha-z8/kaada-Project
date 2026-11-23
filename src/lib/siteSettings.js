import { supabase } from './supabase.js';

export const SOCIAL_PLATFORMS=Object.freeze([
 {id:'website',label:'موقع إلكتروني'},
 {id:'github',label:'GitHub'},
 {id:'x',label:'X / تويتر'},
 {id:'instagram',label:'Instagram'},
 {id:'tiktok',label:'TikTok'},
 {id:'youtube',label:'YouTube'},
 {id:'linkedin',label:'LinkedIn'},
 {id:'snapchat',label:'Snapchat'},
 {id:'discord',label:'Discord'},
 {id:'telegram',label:'Telegram'},
 {id:'whatsapp',label:'WhatsApp'},
 {id:'facebook',label:'Facebook'},
 {id:'threads',label:'Threads'},
 {id:'email',label:'البريد الإلكتروني'},
]);
const PLATFORM_IDS=new Set(SOCIAL_PLATFORMS.map(p=>p.id));

export const DEFAULT_SITE_SETTINGS=Object.freeze({
 siteName:'HSA 4 Study',
 shortName:'HSA',
 tagline:'كل مادة، فهم أعمق.',
 heroLead:'كل مادة،',
 heroAccent:'فهم أعمق.',
 aboutTitle:'منصة تعليمية تساعدك تفهم قبل أن تحفظ',
 aboutIntro:'HSA 4 Study مساحة دراسية عربية صُممت لتجميع المواد والفصول، وقراءة النصوص العلمية بلغتها الأصلية وترجمتها العربية، مع شرح ثنائي اللغة واستماع صوتي يساعد على الفهم والمراجعة.',
 mission:'تسهيل الوصول إلى محتوى المنهج، وربط كل مقطع من النص الأصلي بترجمته وشرحه، حتى ينتقل المتعلم بين الإنجليزية والعربية دون فقد السياق.',
 footerText:'HSA 4 Study — منصة تفاعلية للدراسة الثنائية',
 footerNote:'صُممت للتركيز على الفهم لا الحفظ فقط',
 socials:[],
 team:[
  {id:'project-owner',name:'هزاع الهزاع',role:'صاحب فكرة المشروع',bio:'الإشراف على فكرة المنصة وتطوير تجربتها التعليمية.',socials:[{id:'github',platform:'github',url:'https://github.com/ha-z8'}]},
 ],
});
const trim=(value,max)=>String(value??'').trim().slice(0,max);
const safeId=(id,fallback)=>/^[a-zA-Z0-9_-]{1,60}$/.test(String(id||''))?id:fallback;

export function socialHref(platform,value){
 const raw=trim(value,500);
 if(!raw)return '';
 if(platform==='email'){
   const mail=raw.toLowerCase().startsWith('mailto:')?raw.slice(7):raw;
   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)?'mailto:'+mail:'';
 }
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&url.hostname&&!url.username&&!url.password?url.href:'';
 }catch{return '';}
}
export function normalizeSocials(socials){
 if(!Array.isArray(socials))return [];
 return socials.slice(0,24).map((s,i)=>{
  const platform=PLATFORM_IDS.has(s?.platform)?s.platform:'website';
  return {id:safeId(s?.id,'link-'+i),platform,url:trim(s?.url,500)};
 }).filter(s=>s.url&&socialHref(s.platform,s.url));
}
export function normalizeSiteSettings(raw){
 const input=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const textFields=['siteName','shortName','tagline','heroLead','heroAccent','aboutTitle','aboutIntro','mission','footerText','footerNote'];
 const limits={siteName:80,shortName:30,tagline:160,heroLead:80,heroAccent:80,aboutTitle:160,aboutIntro:1600,mission:1600,footerText:200,footerNote:200};
 const output={...DEFAULT_SITE_SETTINGS};
 for(const key of textFields)output[key]=trim(input[key]??output[key],limits[key]);
 output.socials=normalizeSocials(input.socials??DEFAULT_SITE_SETTINGS.socials);
 output.team=(Array.isArray(input.team)?input.team:DEFAULT_SITE_SETTINGS.team).slice(0,25)
  .map((p,i)=>({
   id:safeId(p?.id,'member-'+i),name:trim(p?.name,100),
   role:trim(p?.role,120),bio:trim(p?.bio,500),
   socials:normalizeSocials(p?.socials),
  })).filter(p=>p.name);
 return output;
}
export async function loadSiteSettings(){
 if(!supabase)return normalizeSiteSettings();
 const {data,error}=await supabase.from('site_settings').select('content').eq('id',1).maybeSingle();
 if(error)throw error;
 return normalizeSiteSettings(data?.content);
}
export async function saveSiteSettings(raw){
 if(!supabase)throw Error('الحفظ متاح بعد الاتصال بقاعدة البيانات.');
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw Error('يجب تسجيل الدخول أولًا.');
 const content=normalizeSiteSettings(raw);
 if(!content.siteName||!content.aboutTitle)throw Error('اسم المنصة وعنوان التعريف مطلوبان.');
 const {error}=await supabase.from('site_settings').upsert({
  id:1, content, updated_by:user.id, updated_at:new Date().toISOString()
 },{onConflict:'id'});
 if(error)throw error;
 return content;
}
