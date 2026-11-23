import {
 ArrowLeft,BookOpen,BookText,Headphones,Languages,FileText,ShieldCheck,
 Volume2,GraduationCap,Layers3,CheckCircle2,Sparkles,SunMoon,Users,
 UploadCloud,PlayCircle,Globe2,Github,Twitter,Instagram,Music2,Youtube,
 Linkedin,Camera,Gamepad2,Send,MessageCircle,Facebook,AtSign,Mail,
 Link2,Settings2,Info
} from 'lucide-react';
import {DEFAULT_SITE_SETTINGS,SOCIAL_PLATFORMS,normalizeSiteSettings,socialHref} from '../lib/siteSettings.js';

const SOCIAL_ICONS={
 website:Globe2,github:Github,x:Twitter,instagram:Instagram,tiktok:Music2,
 youtube:Youtube,linkedin:Linkedin,snapchat:Camera,discord:Gamepad2,
 telegram:Send,whatsapp:MessageCircle,facebook:Facebook,threads:AtSign,email:Mail,
};
const FEATURES=[
 {icon:Layers3,title:'مكتبة مواد ودروس',text:'تنظيم المواد والفصول والمقاطع داخل مكتبة مشتركة، مع اختيار الدرس والعودة إلى الموضع الذي وصلت إليه.'},
 {icon:FileText,title:'استيراد محتوى المنهج',text:'يدعم ملفات PDF وWord (DOCX) والملفات النصية وMarkdown. يمكن اكتشاف الفصول وتعديل النص المستخرج قبل نشره.'},
 {icon:Languages,title:'ترجمة مترابطة',text:'يُقسّم النص إلى مقاطع قصيرة، وتُترجم كل فقرة إنجليزية إلى العربية مع الحفاظ على المصدر وترتيب الأفكار والأرقام.'},
 {icon:BookText,title:'شرح عربي وإنجليزي',text:'إعداد شرح علمي مبسّط للفقرة باللغتين، مع إمكانية مراجعة المحتوى وتصحيح الترجمة والمصطلحات من المشرف.'},
 {icon:Headphones,title:'قراءة صوتية باللغتين',text:'الاستماع للإنجليزية أو العربية أو للوضع المدمج: المقطع الإنجليزي ثم ترجمته العربية، ثم المقطع التالي تلقائيًا.'},
 {icon:Volume2,title:'التحكم في الاستماع',text:'اختيار الأصوات المتوفرة على جهازك، وضبط السرعة ومستوى الصوت والتنقل بين المقاطع والتحكم بالتشغيل.'},
 {icon:ShieldCheck,title:'صلاحيات واضحة',text:'المشرف يضيف المواد ويعدّلها ويجهّز الشروح. المستخدم يقرأ ويستمع ويتابع تقدمه الشخصي دون تعديل المحتوى المشترك.'},
 {icon:SunMoon,title:'تجربة قابلة للتخصيص',text:'واجهة عربية متجاوبة، مظهر فاتح أو داكن، وعرض للنص بالإنجليزية أو العربية أو باللغتين معًا.'},
];
const STEPS=[
 {title:'اختيار المادة',text:'ابدأ من المكتبة، ثم افتح المادة والفصل أو الدرس الذي تريد مراجعته.'},
 {title:'مطالعة النص وترجمته',text:'اقرأ الأصل الإنجليزي والترجمة العربية للمقطع نفسه، أو اختر عرض لغة واحدة.'},
 {title:'استمع بالطريقة المناسبة',text:'من مشغّل الدرس اختر القراءة أو الشرح، وحدد لغة الاستماع والصوت والسرعة.'},
 {title:'تابع من حيث توقفت',text:'انتقل بين المقاطع؛ ويحفظ الحساب موضع المذاكرة وسرعة الاستماع.'},
];
export function SocialLinks({links=[],className='',compact=false}){
 const visible=links.filter(s=>socialHref(s.platform,s.url));
 if(!visible.length)return null;
 return <div className={'about-social-links '+className}>
  {visible.map((item,i)=>{
   const platform=SOCIAL_PLATFORMS.find(p=>p.id===item.platform);
   const Icon=SOCIAL_ICONS[item.platform]||Link2;
   const label=platform?.label||'رابط';
   return <a key={item.id||i} href={socialHref(item.platform,item.url)}
     target={item.platform==='email'?undefined:'_blank'}
     rel={item.platform==='email'?undefined:'noopener noreferrer'}
     title={label} aria-label={'زيارة حساب '+label}
     className={'about-social-link'+(compact?' is-compact':'')}>
     <Icon size={compact?18:20}/>{!compact&&<span>{label}</span>}
   </a>;
  })}
 </div>;
}
export default function AboutPage({settings=DEFAULT_SITE_SETTINGS,onSettings,onBack,preview=false,backLabel='العودة إلى المكتبة'}){
 const site=normalizeSiteSettings(settings);
 return <div className="about-page">
  <header className="about-page-hero">
   <div className="about-hero-content">
    <div className="eyebrow"><Sparkles size={16}/> تعرّف على المنصة</div>
    <div className="about-hero-logo"><img src="/hsa-logo.svg" alt={'شعار '+site.siteName}/></div>
    <h1>{site.aboutTitle}</h1>
    <p>{site.aboutIntro}</p>
    <div className="about-hero-actions">
     {onBack&&<button type="button" onClick={onBack} className="primary-btn"><BookOpen size={17}/> {preview?'العودة للإعدادات':backLabel} <ArrowLeft size={17}/></button>}
     {onSettings&&<button type="button" className="outline-btn" onClick={onSettings}><Settings2 size={17}/> تخصيص الصفحة</button>}
    </div>
   </div>
   <div className="about-hero-visual" aria-hidden="true">
    <div className="about-visual-language">EN <ArrowLeft size={17}/> AR</div>
    <div className="about-visual-paper">
      <span className="about-visual-label"><BookOpen size={16}/> دراسة مترابطة</span>
      <i/><i/><i className="short"/><div className="about-visual-divider"/><i/><i className="short"/>
    </div>
    <span className="about-visual-float"><Headphones size={27}/></span>
   </div>
  </header>

  <section className="about-section" aria-labelledby="about-mission">
   <div className="about-section-heading"><span className="about-kicker">رؤيتنا</span><h2 id="about-mission">لماذا أُنشئت {site.siteName}؟</h2></div>
   <p className="about-mission-copy">{site.mission}</p>
   <div className="about-mini-highlights">
    <span><CheckCircle2 size={17}/> النص الأصلي محفوظ</span>
    <span><CheckCircle2 size={17}/> ترجمة وشرح لكل مقطع</span>
    <span><CheckCircle2 size={17}/> دراسة مرنة بلغتين</span>
   </div>
  </section>

  <section className="about-section" aria-labelledby="about-features">
   <div className="about-section-heading"><span className="about-kicker">إمكانات المنصة</span><h2 id="about-features">كل ما تحتاجه في مكان واحد</h2><p>خدمات موجودة بالفعل داخل المنصة، لتنظيم الدروس وفهم النصوص ومراجعتها.</p></div>
   <div className="about-feature-grid">{FEATURES.map(({icon:Icon,title,text})=>
    <article key={title} className="about-feature-card"><span className="about-feature-icon"><Icon size={23}/></span><h3>{title}</h3><p>{text}</p></article>
   )}</div>
  </section>

  <section className="about-section about-process" aria-labelledby="about-steps">
   <div className="about-section-heading"><span className="about-kicker">كيفية الاستخدام</span><h2 id="about-steps">رحلتك من الملف إلى الفهم</h2><p>يمكنك الدراسة مباشرة من المحتوى الذي أضافه المشرف، دون إعداد معقّد.</p></div>
   <div className="about-steps-grid">{STEPS.map((s,i)=><div key={s.title} className="about-step">
    <span className="about-step-count">{String(i+1).padStart(2,'0')}</span><h3>{s.title}</h3><p>{s.text}</p>
   </div>)}</div>
   <div className="about-reading-sample">
    <div className="about-sample-heading"><span><Languages size={19}/> مثال القراءة المدمجة</span><small>الإنجليزية أولًا ثم العربية للمقطع نفسه</small></div>
    <div className="about-sample-grid">
     <div dir="ltr"><span>1 · ENGLISH</span><p>In 1941, a team of scientists known as the "Blackett Circus," named after their leader,</p></div>
     <div dir="rtl"><span>2 · العربية</span><p>في عام 1941، أجرى فريق من العلماء عُرف باسم «سيرك بلاكيت»، تيمّنًا بقائدهم بلاكيت،</p></div>
    </div>
    <p className="about-sample-foot"><PlayCircle size={16}/> بعد اكتمال قراءة اللغتين ينتقل المشغّل للمقطع التالي تلقائيًا عند تفعيل المتابعة.</p>
   </div>
  </section>

  <section className="about-section" aria-labelledby="about-notes">
   <div className="about-section-heading"><span className="about-kicker">معلومات تهمك</span><h2 id="about-notes">ماذا تعرف قبل البدء؟</h2></div>
   <div className="about-notes-grid">
    <p><Info size={19}/> الترجمة والشرح التلقائيان يتطلبان موافقة المشرف على معالجة النص خارجيًا وتوفر حصة خدمة الذكاء الاصطناعي، ومراجعتهما علميًا قبل الاعتماد.</p>
    <p><Info size={19}/> الأصوات المستخدمة للقراءة هي أصوات المتصفح أو الجهاز المتوفرة؛ جودتها وأسماؤها تختلف بين الأجهزة.</p>
    <p><Info size={19}/> الملفات المصوّرة أو الممسوحة ضوئيًا قد تحتاج لاستخراج النص بوسيلة OCR قبل الاستيراد.</p>
   </div>
  </section>

  <section className="about-section about-team-section" aria-labelledby="about-team">
   <div className="about-section-heading"><span className="about-kicker"><Users size={16}/> صنّاع المنصة</span><h2 id="about-team">الأشخاص الذين عملوا على المشروع</h2><p>فريق العمل وأصحاب الأدوار المعلنة في تطوير وإدارة المنصة. يستطيع المشرف إضافة بقية المشاركين وحساباتهم من الإعدادات.</p></div>
   {site.team.length?<div className="about-team-grid">{site.team.map(member=><article key={member.id} className="about-team-card">
    <span className="about-member-avatar"><Users size={26}/></span>
    <div className="about-member-text"><h3>{member.name}</h3><span>{member.role||'مشارك في المشروع'}</span>{member.bio&&<p>{member.bio}</p>}</div>
    <SocialLinks links={member.socials} compact/>
   </article>)}</div>:<div className="about-empty-team">لم يُضف المشرف أعضاء فريق العمل بعد.</div>}
  </section>

  <section className="about-section about-contact-section" aria-labelledby="about-contact">
    <div><span className="about-kicker">تابعنا</span><h2 id="about-contact">حسابات {site.siteName} الرسمية</h2><p>روابط التواصل التي يضيفها المشرف تُعرض هنا مباشرة. لا تُعرض حسابات غير موثّقة أو غير مضافة.</p></div>
    <SocialLinks links={site.socials}/>
    {!site.socials.length&&<span className="about-empty-social">لم تُضاف روابط التواصل الرسمية بعد.</span>}
  </section>
 </div>;
}
