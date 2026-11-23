import {avatarFrameProperties,getAvatarFrame} from './avatarFrame.js';
import {DEFAULT_SIDEBAR_MENU,normalizeSidebarMenu} from './sidebarMenu.js';
export const SOCIAL_PLATFORMS=Object.freeze([
 {id:'website',label:'موقع إلكتروني'},
 {id:'github',label:'GitHub'},
 {id:'x',label:'X'},
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
// These fields can be edited only by the authenticated site-owner account.
export const SITE_OWNER_FIELDS=Object.freeze([
 'team','teamKicker','teamTitle','teamIntro','teamEmpty',
 'siteName','shortName','tagline','heroLead','heroAccent','footerText','footerNote',
]);
const OWNER_FIELDS=new Set(SITE_OWNER_FIELDS);

export const ABOUT_SECTION_IDS=Object.freeze(['mission','features','steps','sample','notes','team']);
export const FEATURE_ICON_OPTIONS=Object.freeze([
 {id:'book',label:'كتاب'}, {id:'library',label:'المكتبة'},
 {id:'file',label:'ملفات'}, {id:'language',label:'لغات'},
 {id:'headphones',label:'استماع'}, {id:'speaker',label:'صوت'},
 {id:'heart',label:'فائدة'}, {id:'settings',label:'إعدادات'},
 {id:'sun',label:'مظهر'}, {id:'check',label:'إنجاز'},
 {id:'sparkles',label:'فهم'}, {id:'search',label:'بحث'},
 {id:'user',label:'حساب'}, {id:'shield',label:'خصوصية'},
]);
const FEATURE_IDS=new Set(FEATURE_ICON_OPTIONS.map(x=>x.id));
export const DEFAULT_SITE_SETTINGS=Object.freeze({
 siteName:'HSA 4 Study',
 shortName:'HSA',
 tagline:'كل مادة، فهم أعمق.',
 heroLead:'كل مادة،',
 heroAccent:'فهم أعمق.',
 footerText:'HSA 4 Study — منصة تفاعلية للدراسة الثنائية',
 footerNote:'صُممت للتركيز على الفهم لا الحفظ فقط',
 aboutEyebrow:'دليلك لاستخدام المنصة',
 aboutTitle:'ابدأ مذاكرتك بخطوات واضحة',
 aboutIntro:'تجمع لك HSA 4 Study موادك ودروسك في مكان واحد، وتساعدك على قراءة النص الإنجليزي وترجمته العربية والاستماع إلى الشرح بالطريقة التي تناسبك. هنا تجد طريقة الاستخدام من أول دخولك وحتى متابعة الدرس.',
 heroVisualLabel:'قراءة مترابطة',
 heroVisualLanguages:'EN → AR',
 missionKicker:'فكرة المنصة',
 missionTitle:'ليش تستخدم HSA 4 Study؟',
 mission:'بدل التنقل بين الملفات والترجمات والمقاطع الصوتية، تقدر تقرأ كل مقطع من الدرس مع ترجمته وتشغيله صوتيًا، ثم تكمل للمقطع التالي. الهدف هو تسهيل فهم المادة ومراجعتها على راحتك.',
 highlights:[
  {id:'source',text:'النص الإنجليزي والترجمة أمامك'},
  {id:'explain',text:'شرح مبسط بلغتين'},
  {id:'resume',text:'تكمل من آخر موضع'},
 ],
 featuresKicker:'أدوات المذاكرة',
 featuresTitle:'وش تقدر تسوي داخل الموقع؟',
 featuresIntro:'كل خدمة هنا تقدر تستفيد منها خلال مذاكرتك من صفحات الموقع.',
 features:[
  {id:'library',icon:'library',title:'استعراض المواد والدروس',text:'من لوحة المذاكرة اختر المادة التي تحتاجها، ثم افتح الفصل أو الدرس الموجود داخلها.'},
  {id:'bilingual',icon:'language',title:'القراءة بلغتين',text:'تقدر تعرض النص الإنجليزي وترجمته العربية معًا، أو تختار عرض لغة واحدة للتركيز.'},
  {id:'explain',icon:'book',title:'فهم الشرح المبسّط',text:'تحت كل مقطع ستجد شرحه المتوفر بالعربية أو الإنجليزية، وتقدر تقارن الشرح بالنص الأصلي.'},
  {id:'listen',icon:'headphones',title:'الاستماع للمقاطع',text:'اختر الإنجليزية فقط أو العربية فقط أو «إنجليزي ثم عربي» لسماع كل مقطع وترجمته بالتتابع.'},
  {id:'voice',icon:'speaker',title:'تخصيص صوت القراءة',text:'اختر صوتًا متوفرًا على جهازك وعدّل سرعة الاستماع والصوت، وأوقف المقطع أو تابع من مكانه.'},
  {id:'progress',icon:'check',title:'متابعة تقدمك',text:'انتقل بين المقاطع باستخدام السابق والتالي، ويحفظ حسابك آخر مقطع درستَه.'},
  {id:'theme',icon:'sun',title:'واجهة تناسبك',text:'استخدم الوضع النهاري أو الليلي، وافتح الموقع من الكمبيوتر أو الجوال.'},
  {id:'account',icon:'user',title:'حسابك الشخصي',text:'بعد تسجيل الدخول، تستطيع الوصول إلى موادك ومتابعة تقدمك وتحديث كلمة المرور من «حسابي».'},
 ],
 stepsKicker:'ابدأ هنا',
 stepsTitle:'كيف تستخدم الموقع من البداية للنهاية؟',
 stepsIntro:'اتبع هالخطوات بالترتيب أول مرة، وبعدها تقدر تبدأ بأي درس بشكل مباشر.',
 steps:[
  {id:'signup',title:'افتح الموقع وسجّل الدخول',text:'من شاشة البداية أدخل اسم المستخدم وكلمة المرور. إذا ما عندك حساب اضغط «ليس لديك حساب؟ أنشئ حسابًا»، واكتب اسم المستخدم وكلمة المرور ثم ادخل. وتقدر تجرب الواجهة دون حفظ عبر «تجربة الواجهة دون حساب».'},
  {id:'library',title:'اختر المادة المناسبة',text:'بعد الدخول تفتح «لوحة المذاكرة». بتلقى المواد الموجودة في المكتبة؛ اضغط على المادة التي تدرسها.'},
  {id:'lesson',title:'افتح الدرس أو الفصل',text:'داخل المادة تظهر قائمة الدروس. اضغط «ابدأ الدراسة» بجانب الدرس، وبتنتقل لقارئ الدروس.'},
  {id:'read',title:'اقرأ الفقرة وترجمتها',text:'بيظهر لك النص الأصلي وترجمته العربية للمقطع الحالي. من «طريقة عرض النص» اختر «مزدوج» أو «English» أو «العربية» حسب احتياجك.'},
  {id:'explanation',title:'راجع الشرح المبسّط',text:'انزل إلى «الشرح المبسّط» لتشوف تفسير الفقرة المتوفر بالعربية أو الإنجليزية أو باللغتين، وراجع المعنى قبل الانتقال.'},
  {id:'audio',title:'شغّل الصوت بالطريقة اللي تبيها',text:'من «استمع وافهم» اختر «القراءة» أو «الشرح»، وبعدها «لغة القراءة». لو اخترت «إنجليزي ثم عربي» بيقرأ المقطع بالإنجليزي وبعده ترجمته العربية مباشرة.'},
  {id:'adjust',title:'اضبط الصوت والسرعة',text:'من إعدادات المشغّل حدد الصوت الإنجليزي والعربي المتوفرين على جهازك، واضبط السرعة ومستوى الصوت. فعّل الانتقال التلقائي عشان يكمل الدرس مقطعًا بعد مقطع.'},
  {id:'continue',title:'تنقّل وارجع لاحقًا',text:'استخدم «السابقة» و«التالية» أو قائمة «مقاطع الدرس» للتنقل. عند العودة لحسابك افتح الدرس وكمّل من الموضع المحفوظ.'},
 ],
 sampleTitle:'مثال على القراءة المدمجة',
 sampleSubtitle:'كل مقطع بالإنجليزية ثم ترجمته العربية',
 sampleEnglishLabel:'1 · ENGLISH',
 sampleArabicLabel:'2 · العربية',
 sampleEnglish:'In 1941, a team of scientists known as the "Blackett Circus," named after their leader,',
 sampleArabic:'في عام 1941، أجرى فريق من العلماء عُرف باسم «سيرك بلاكيت»، تيمّنًا بقائدهم بلاكيت،',
 sampleFoot:'بعد اكتمال اللغتين ينتقل للمقطع التالي تلقائيًا إذا فعّلت المتابعة.',
 notesKicker:'قبل ما تبدأ',
 notesTitle:'ملاحظات تساعدك أثناء الدراسة',
 notes:[
  {id:'translation',text:'إذا ما ظهرت ترجمة أو شرح لبعض المقاطع، فهذا يعني أن المحتوى لم يجهز لها بعد. تقدر تتابع قراءة النص المتوفر.'},
  {id:'voices',text:'الأصوات تختلف حسب المتصفح والجهاز. إذا ما ظهر صوت مناسب، جرّب متصفحًا أو جهازًا آخر.'},
  {id:'content',text:'راجع النصوص العلمية والأرقام والمصطلحات المهمة مع المنهج الأصلي، خصوصًا عند استخدام الترجمة الآلية.'},
 ],
 teamKicker:'خلف المشروع',
 teamTitle:'فريق العمل',
 teamIntro:'الأشخاص المشاركون في إنشاء وتطوير المنصة. اضغط على أيقونة الحساب تحت اسم الشخص لزيارة صفحته.',
 teamEmpty:'لا توجد أسماء مضافة إلى فريق العمل حاليًا.',
 team:[
  {id:'project-owner',name:'هزاع الهزاع',role:'صاحب فكرة المشروع',bio:'الإشراف على فكرة المنصة وتطوير تجربتها التعليمية.',avatarPath:'',avatarWidth:68,avatarHeight:68,avatarZoom:1,avatarX:50,avatarY:50,socials:[{id:'github',platform:'github',url:'https://github.com/ha-z8'}]},
 ],
 sectionOrder:['mission','features','steps','sample','notes','team'],
 hiddenSections:[],
 sidebarMenu:DEFAULT_SIDEBAR_MENU,
});
const MAX_STRING={siteName:80,shortName:30,tagline:160,heroLead:80,heroAccent:80,footerText:200,footerNote:200,
 aboutEyebrow:100,aboutTitle:160,aboutIntro:2000,heroVisualLabel:100,heroVisualLanguages:50,
 missionKicker:100,missionTitle:160,mission:2000,
 featuresKicker:100,featuresTitle:160,featuresIntro:600,
 stepsKicker:100,stepsTitle:160,stepsIntro:600,
 sampleTitle:160,sampleSubtitle:600,sampleEnglishLabel:100,sampleArabicLabel:100,
 sampleEnglish:1000,sampleArabic:1000,sampleFoot:600,
 notesKicker:100,notesTitle:160,
 teamKicker:100,teamTitle:160,teamIntro:600,teamEmpty:300};
const trim=(value,max)=>String(value??'').trim().slice(0,max);
const safeId=(id,fallback)=>/^[a-zA-Z0-9_-]{1,80}$/.test(String(id||''))?String(id):fallback;
// Only locally uploaded WebP thumbnails in the dedicated public team bucket are accepted.
export const validTeamAvatarPath=path=>typeof path==='string'&&/^team\/[a-f0-9-]{36}[.]webp$/i.test(path);

function normalizeItems(input,fallback,maximum,map){
 return (Array.isArray(input)?input:fallback).slice(0,maximum).map(map);
}
export function socialHref(platform,value){
 const raw=trim(value,500);
 if(!raw)return '';
 if(platform==='email'){
  const mail=raw.toLowerCase().startsWith('mailto:')?raw.slice(7):raw;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)?'mailto:'+mail:'';
 }
 try{const url=new URL(raw);return url.protocol==='https:'&&url.hostname&&!url.username&&!url.password?url.href:''}
 catch{return ''}
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
 const output={...DEFAULT_SITE_SETTINGS};
 for(const [key,length] of Object.entries(MAX_STRING))output[key]=trim(input[key]??output[key],length);
 output.highlights=normalizeItems(input.highlights,DEFAULT_SITE_SETTINGS.highlights,12,(a,i)=>({
  id:safeId(a?.id,'highlight-'+i),text:trim(a?.text,180),
 })).filter(x=>x.text);
 output.features=normalizeItems(input.features,DEFAULT_SITE_SETTINGS.features,20,(a,i)=>({
  id:safeId(a?.id,'feature-'+i),icon:FEATURE_IDS.has(a?.icon)?a.icon:'book',
  title:trim(a?.title,130),text:trim(a?.text,700),
 })).filter(x=>x.title);
 output.steps=normalizeItems(input.steps,DEFAULT_SITE_SETTINGS.steps,24,(a,i)=>({
  id:safeId(a?.id,'step-'+i),title:trim(a?.title,140),text:trim(a?.text,900),
 })).filter(x=>x.title);
 output.notes=normalizeItems(input.notes,DEFAULT_SITE_SETTINGS.notes,20,(a,i)=>({
  id:safeId(a?.id,'note-'+i),text:trim(a?.text,700),
 })).filter(x=>x.text);
 output.team=normalizeItems(input.team,DEFAULT_SITE_SETTINGS.team,25,(p,i)=>({
  id:safeId(p?.id,'member-'+i),name:trim(p?.name,100),role:trim(p?.role,120),
  bio:trim(p?.bio,500),avatarPath:validTeamAvatarPath(p?.avatarPath)?p.avatarPath:'',
  ...avatarFrameProperties(getAvatarFrame(p)),socials:normalizeSocials(p?.socials),
 })).filter(p=>p.name);
 output.sidebarMenu=normalizeSidebarMenu(input.sidebarMenu);
 const order=Array.isArray(input.sectionOrder)?input.sectionOrder:[];
 output.sectionOrder=[...new Set([...order,...ABOUT_SECTION_IDS])].filter(id=>ABOUT_SECTION_IDS.includes(id));
 output.hiddenSections=[...new Set(Array.isArray(input.hiddenSections)?input.hiddenSections:[])].filter(id=>ABOUT_SECTION_IDS.includes(id));
 // Deliberately never expose or persist a platform-wide social account collection.
 // Contacts belong only to members of the credited team.
 return output;
}
export async function loadSiteSettings(){
 const {supabase}=await import('./supabase.js');
 if(!supabase)return normalizeSiteSettings();
 const {data,error}=await supabase.from('site_settings').select('content').eq('id',1).maybeSingle();
 if(error)throw error;
 return normalizeSiteSettings(data?.content);
}
export async function isCurrentSiteOwner(){
 const {supabase}=await import('./supabase.js');
 if(!supabase)return false;
 const {data,error}=await supabase.rpc('is_site_owner');
 if(error)throw error;
 return data===true;
}
export async function saveSiteSettings(raw){
 const {supabase}=await import('./supabase.js');
 if(!supabase)throw Error('الحفظ متاح بعد الاتصال بقاعدة البيانات.');
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw Error('يجب تسجيل الدخول أولًا.');
 const desired=normalizeSiteSettings(raw);
 if(!desired.siteName||!desired.aboutTitle)throw Error('اسم المنصة وعنوان التعريف مطلوبان.');
 const owner=await isCurrentSiteOwner();
 let content=desired;
 if(!owner){
  // Read protected values from the database, not from the browser's draft.
  // Preserve their raw JSON representation to avoid changing legacy member
  // fields during normalization. Database trigger is the final authority.
  const {data:row,error:readError}=await supabase.from('site_settings')
    .select('content').eq('id',1).single();
  if(readError||!row)throw Error('تعذر التحقق من إعدادات المالك؛ لم تحفظ التعديلات.');
  content={...row.content};
  for(const [key,value] of Object.entries(desired)){
   if(!OWNER_FIELDS.has(key))content[key]=value;
  }
 }
 const payload={content,updated_by:user.id,updated_at:new Date().toISOString()};
 const result=owner
  ? await supabase.from('site_settings').upsert({id:1,...payload},{onConflict:'id'}).select('content').single()
  : await supabase.from('site_settings').update(payload).eq('id',1).select('content').single();
 if(result.error)throw result.error;
 return normalizeSiteSettings(result.data?.content);
}
