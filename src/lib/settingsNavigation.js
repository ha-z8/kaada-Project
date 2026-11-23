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

// Human-readable field names and synonyms are indexed separately from their values.
// Results can jump directly to the corresponding editable field.
export const SETTINGS_FIELD_LABELS=Object.freeze({
 siteName:'اسم المنصة',shortName:'الاسم المختصر',tagline:'الشعار النصي',
 heroLead:'مقدمة عنوان الرئيسية',heroAccent:'الكلمة البارزة في الرئيسية',
 footerText:'التذييل الرئيسي',footerNote:'السطر الثاني بالتذييل',
 aboutEyebrow:'الكلمة فوق العنوان',aboutTitle:'العنوان الكبير',
 aboutIntro:'مقدمة الصفحة',heroVisualLabel:'عبارة الرسم التوضيحي',
 heroVisualLanguages:'رمز اللغتين في الرسم',homePage:'الصفحة الرئيسية عند فتح الموقع',
 publicPages:'الصفحات المتاحة للزوار',sidebarMenu:'القائمة الجانبية اليمنى',
 sectionOrder:'ترتيب الأقسام',hiddenSections:'إظهار وإخفاء الأقسام',
 missionKicker:'عنوان فرعي',missionTitle:'عنوان القسم',mission:'نص الفائدة',
 highlights:'عبارات التميز',featuresKicker:'عنوان فرعي',
 featuresTitle:'عنوان القسم',featuresIntro:'وصف القسم',features:'بطاقات الخدمات',
 stepsKicker:'عنوان فرعي',stepsTitle:'عنوان القسم',stepsIntro:'وصف القسم',
 steps:'خطوات المستخدم',sampleTitle:'عنوان المثال',sampleSubtitle:'الوصف الصغير',
 sampleEnglishLabel:'عنوان اللغة الإنجليزية',sampleArabicLabel:'عنوان اللغة العربية',
 sampleEnglish:'المقطع الإنجليزي',sampleArabic:'الترجمة العربية المقابلة',
 sampleFoot:'نص أسفل المثال',notesKicker:'عنوان فرعي',notesTitle:'عنوان القسم',
 notes:'ملاحظات المستخدم',teamKicker:'عنوان فرعي',teamTitle:'عنوان قسم الفريق',
 teamIntro:'وصف الفريق',teamEmpty:'العبارة عند عدم وجود أعضاء',
 team:'أعضاء فريق العمل والصور والحسابات'
});
const SEARCH_ALIASES=Object.freeze({
 homePage:'البداية الصفحة الأولى الافتراضية الرئيسية',
 publicPages:'صلاحيات الزوار الصفحات المسموحة',
 sidebarMenu:'القائمة اليمنى ترتيب الصفحات تقسيم القوائم',
 team:'صورة الصور رفع صورة عرض الصور حجم الصورة الأعضاء',
 teamTitle:'عنوان فريق العمل',heroLead:'المقدمة',footerText:'الحقوق',
 features:'بطاقات المميزات',steps:'دليل الاستخدام في عن المنصة',
 sampleArabic:'ترجمة مثال القراءة',sectionOrder:'تقديم فريق العمل فوق'
});
export function findSettingsTargets(draft,query='',group='all'){
 const terms=normalizeStudyQuery(query).split(' ').filter(Boolean);
 if(!terms.length)return [];
 const results=[];
 for(const panel of SETTINGS_PANELS){
  if(group!=='all'&&panel.group!==group)continue;
  const header=normalizeStudyQuery(panel.title+' '+panel.keywords);
  let panelMatched=false;
  for(const key of panel.fields){
   const label=SETTINGS_FIELD_LABELS[key]||key;
   const value=draft?.[key];
   const labelText=normalizeStudyQuery(label);
   const aliases=normalizeStudyQuery(SEARCH_ALIASES[key]||'');
   const savedValue=normalizeStudyQuery(typeof value==='object'?JSON.stringify(value):String(value??''));
   const searchable=[labelText,aliases,savedValue].join(' ');
   if(!terms.every(term=>searchable.includes(term)))continue;
   const score=terms.every(term=>labelText.includes(term))?100:
    terms.every(term=>(labelText+' '+aliases).includes(term))?75:25;
   results.push({panelId:panel.id,panelTitle:panel.title,key,label,locked:panel.group==='owner',score});
   panelMatched=true;
   if(results.length>=200)break;
  }
  if(!panelMatched&&terms.every(term=>header.includes(term))){
   results.push({panelId:panel.id,panelTitle:panel.title,key:null,label:panel.title,locked:panel.group==='owner',score:12});
  }
 }
 return results.sort((a,b)=>b.score-a.score).slice(0,16);
}

export function findSettingsPanels(draft,query='',group='all'){
 const words=normalizeStudyQuery(query).split(' ').filter(Boolean);
 return SETTINGS_PANELS.filter(panel=>{
  if(group!=='all'&&panel.group!==group)return false;
  const dynamic=panel.fields.map(key=>draft?.[key]);
  const searchable=normalizeStudyQuery([
   panel.title,panel.keywords,
   ...panel.fields.map(key=>(SETTINGS_FIELD_LABELS[key]||'')+' '+(SEARCH_ALIASES[key]||'')),
   ...dynamic.map(value=>value&&typeof value==='object'?JSON.stringify(value):String(value??''))
  ].join(' '));
  return words.every(term=>searchable.includes(term));
 });
}
