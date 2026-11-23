import {normalizeStudyQuery} from './lessonSearch.js';
export const SETTINGS_GROUPS=Object.freeze([
 {id:'all',label:'كل الإعدادات'},
 {id:'access',label:'الدخول والصفحات'},
 {id:'content',label:'المحتوى والدليل'},
 {id:'owner',label:'الهوية وفريق العمل'}
]);
export const SETTINGS_PANELS=Object.freeze([
 {id:'identity',title:'الهوية العامة',group:'owner',keywords:'اسم المنصة الاسم المختصر عنوان الرئيسية الشعار النصي التذييل شعار الموقع',fields:['siteName','shortName','tagline','heroLead','heroAccent','footerText','footerNote']},
 {id:'intro',title:'مقدمة صفحة عن المنصة',group:'content',keywords:'الكلمة فوق العنوان عنوان الصفحة مقدمة الرسم التوضيحي اللغات',fields:['aboutEyebrow','aboutTitle','aboutIntro','heroVisualLabel','heroVisualLanguages']},
 {id:'public',title:'الدخول العام وصفحة البداية',group:'access',keywords:'الصفحة الرئيسية فتح الموقع الصفحة الأولى الزوار الصفحات المتاحة الظهور الوصول',fields:['homePage','publicPages']},
 {id:'sidebar',title:'تنظيم القائمة الجانبية',group:'access',keywords:'القائمة اليمنى صفحات قائمة جديدة ترتيب تغيير الاسم نقل الصفحات',fields:['sidebarMenu']},
 {id:'ordering',title:'ترتيب أقسام صفحة التعريف',group:'access',keywords:'إظهار إخفاء ترتيب أقسام الصفحة فريق العمل فوق تحت',fields:['sectionOrder','hiddenSections']},
 {id:'mission',title:'فكرة المنصة وفائدتها',group:'content',keywords:'نص الفائدة عبارات التميز عناوين المهمة',fields:['missionKicker','missionTitle','mission','highlights']},
 {id:'features',title:'خدمات المنصة للطالب',group:'content',keywords:'المميزات بطاقات الخدمات الأيقونات أوصاف البطاقات',fields:['featuresKicker','featuresTitle','featuresIntro','features']},
 {id:'steps',title:'دليل الطالب من البداية للنهاية',group:'content',keywords:'خطوات الاستخدام دليل المستخدم مراحل الطالب',fields:['stepsKicker','stepsTitle','stepsIntro','steps']},
 {id:'sample',title:'مثال القراءة الإنجليزية والعربية',group:'content',keywords:'الترجمة مثال القراءة المدمجة الإنجليزي العربي المثال',fields:['sampleTitle','sampleSubtitle','sampleEnglishLabel','sampleArabicLabel','sampleEnglish','sampleArabic','sampleFoot']},
 {id:'notes',title:'ملاحظات للطلاب',group:'content',keywords:'ملاحظات المستخدم عبارات الطلاب',fields:['notesKicker','notesTitle','notes']},
 {id:'team',title:'فريق العمل وحساباتهم الشخصية',group:'owner',keywords:'اسم عضو الفريق الصورة الشخصية ارتفاع الصورة حجم الصورة روابط التواصل الحسابات السيرة الدور النبذة',fields:['teamKicker','teamTitle','teamIntro','teamEmpty','team']}
]);
export function findSettingsPanels(draft,query='',group='all'){
 const words=normalizeStudyQuery(query).split(' ').filter(Boolean);
 return SETTINGS_PANELS.filter(panel=>{
  if(group!=='all'&&panel.group!==group)return false;
  const dynamic=panel.fields.map(key=>draft?.[key]);
  const searchable=normalizeStudyQuery([
   panel.title,panel.keywords,
   ...dynamic.map(value=>value&&typeof value==='object'?JSON.stringify(value):String(value??''))
  ].join(' '));
  return words.every(term=>searchable.includes(term));
 });
}
