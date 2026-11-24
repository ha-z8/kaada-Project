import {normalizeSiteSettings} from './siteSettings.js';
import {chunkText} from './speech.js';

const normalizeSpeech=value=>String(value||'').replace(/\bHSA\s*4\s*Study\b/gi,'إتش إس إيه فور ستدي')
 .replace(/\bENGLISH\b/gi,'اللغة الإنجليزية')
 .replace(/\bEN\s*→\s*AR\b/gi,'من الإنجليزية إلى العربية')
 .replace(/\s+/gu,' ').trim();
const join=(...entries)=>entries.filter(Boolean).map(normalizeSpeech).filter(Boolean).join(' ');

function numberedDetails(items,titlePrefix,explain){
 return items.map((item,index)=>join(
  titlePrefix+' '+(index+1)+':',
  item.title||item.text||'',
  item.title?item.text||'':'',
  explain||''
 ));
}

/** A spoken guided tour, built strictly from the visible About page and its live settings.
 *  Hidden sections are omitted, and the spoken order matches the reader's screen.
 *  English sample text is explained through the actual published Arabic translation.
 */
export function buildAboutNarration(settings){
 const s=normalizeSiteSettings(settings);
 const segments=[
  {id:'intro',title:'مقدمة عن المنصة',text:join(
    'أهلًا بك في',s.siteName+'.',
    'في هذا الشرح الصوتي سنمر معًا على جميع أقسام صفحة عن المنصة، ونوضح كيف تستفيد منها خطوة بخطوة.',
    s.aboutEyebrow+'.',s.aboutTitle+'.',s.aboutIntro,
    'يمكنك إيقاف الصوت مؤقتًا أو استئنافه أو كتمه من شريط التحكم أسفل الشاشة.'
  )}
 ];
 for(const id of s.sectionOrder){
  if(s.hiddenSections.includes(id))continue;
  switch(id){
   case 'team':{
    const people=s.team.map((member,index)=>join(
     'عضو الفريق رقم '+(index+1)+':',member.name+'.',member.role? 'المهمة: '+member.role+'.':'',
     member.bio? 'نبذة: '+member.bio+'.':'',
     member.socials?.length?'يمكنك فتح روابط التواصل الخاصة بهذا العضو من بطاقته على الصفحة.':''
    ));
    segments.push({id,title:s.teamTitle,text:join(
     'ننتقل الآن إلى قسم',s.teamTitle+'.',s.teamIntro,
     ...(people.length?people:[s.teamEmpty])
    )});
    break;
   }
   case 'mission':
    segments.push({id,title:s.missionTitle,text:join(
     'بعد ذلك نتعرف على فكرة المنصة.',s.missionKicker+'.',s.missionTitle+'.',s.mission,
     s.highlights.length?'وأبرز النقاط التي تركز عليها المنصة هي:':'',
     ...s.highlights.map((item,index)=>join('النقطة '+(index+1)+':',item.text+'.'))
    )});
    break;
   case 'features':
    segments.push({id,title:s.featuresTitle,text:join(
     'والآن مع الخدمات والأدوات التي تساعدك أثناء الدراسة.',
     s.featuresKicker+'.',s.featuresTitle+'.',s.featuresIntro,
     ...numberedDetails(s.features,'الخدمة رقم')
    )});
    break;
   case 'steps':
    segments.push({id,title:s.stepsTitle,text:join(
     'حتى تستخدم المنصة بسهولة، نراجع طريقة العمل من البداية للنهاية بالترتيب.',
     s.stepsKicker+'.',s.stepsTitle+'.',s.stepsIntro,
     ...numberedDetails(s.steps,'الخطوة رقم')
    )});
    break;
   case 'sample':
    segments.push({id,title:s.sampleTitle,text:join(
     'نصل إلى مثال عملي يوضح طريقة القراءة.',s.sampleTitle+'.',s.sampleSubtitle,
     'في المثال يظهر النص المحدد وترجمته العربية المقابلة، بينما يبقى تصميم المنهج الأصلي كما هو.',
     'والترجمة العربية في هذا المثال هي:',s.sampleArabic,
     s.sampleFoot
    )});
    break;
   case 'notes':
    segments.push({id,title:s.notesTitle,text:join(
     'وقبل أن تبدأ، هذه ملاحظات مهمة تساعدك على فهم المحتوى بطريقة أدق.',
     s.notesKicker+'.',s.notesTitle+'.',
     ...s.notes.map((note,index)=>join('الملاحظة رقم '+(index+1)+':',note.text))
    )});
    break;
   default:break;
  }
 }
 segments.push({id:'closing',title:'ختام الشرح',text:join(
  'وبكذا نكون شرحنا أقسام صفحة عن المنصة بالكامل.',
  'تقدر الآن ترجع إلى المكتبة، وتفتح أي مادة أو درس، وتستخدم المزايا التي تعرّفت عليها.',
  s.footerNote,
  'شكرًا لاستماعك، ونتمنى لك مذاكرة مفيدة.'
 )});
 return segments.filter(s=>s.text);
}
export function aboutNarrationChunks(settings){
 return buildAboutNarration(settings).flatMap(section=>
  chunkText(section.text,185).map(text=>({sectionId:section.id,title:section.title,text,lang:'ar-SA'}))
 );
}
