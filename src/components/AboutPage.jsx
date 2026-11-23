import {
 ArrowLeft,BookOpen,BookText,Headphones,Languages,FileText,ShieldCheck,
 Volume2,Layers3,CheckCircle2,Sparkles,SunMoon,Users,PlayCircle,Globe2,
 Mail,Link2,Settings2,Info,Heart,Search,UserRound,Library
} from 'lucide-react';
import {DEFAULT_SITE_SETTINGS,SOCIAL_PLATFORMS,normalizeSiteSettings,socialHref} from '../lib/siteSettings.js';
import {SOCIAL_BRANDS} from '../lib/socialBrands.js';
import {teamAvatarPublicUrl} from '../lib/teamAvatars.js';

const FEATURE_ICONS={
 book:BookOpen,library:Library,file:FileText,language:Languages,headphones:Headphones,
 speaker:Volume2,heart:Heart,settings:Settings2,sun:SunMoon,check:CheckCircle2,
 sparkles:Sparkles,search:Search,user:UserRound,shield:ShieldCheck,
};
function BrandIcon({platform,size=21}){
 if(platform==='email')return <Mail size={size}/>;
 if(platform==='website')return <Globe2 size={size}/>;
 const logo=SOCIAL_BRANDS[platform];
 if(!logo)return <Link2 size={size}/>;
 return <svg aria-hidden="true" width={size} height={size}
   viewBox={logo.viewBox||'0 0 24 24'} focusable="false"
   fill="currentColor" role="img">
  {logo.paths.map((path,i)=><path key={i} d={path}/>)}
 </svg>;
}
export function SocialLinks({links=[],className='',compact=false}){
 const visible=links.filter(s=>socialHref(s.platform,s.url));
 if(!visible.length)return null;
 return <div className={'about-social-links '+className}>
  {visible.map((item,i)=>{
   const platform=SOCIAL_PLATFORMS.find(p=>p.id===item.platform);
   const label=platform?.label||'رابط';
   return <a key={item.id||i} href={socialHref(item.platform,item.url)}
     target={item.platform==='email'?undefined:'_blank'}
     rel={item.platform==='email'?undefined:'noopener noreferrer'}
     title={label} aria-label={'زيارة حساب '+label}
     data-platform={item.platform}
     className={'about-social-link'+(compact?' is-compact':'')}>
     <BrandIcon platform={item.platform} size={compact?20:22}/>
     {!compact&&<span>{label}</span>}
   </a>;
  })}
 </div>;
}
export function TeamAvatar({member}){
 const imageUrl=teamAvatarPublicUrl(member?.avatarPath);
 const initial=String(member?.name||'').trim().slice(0,1)||'؟';
 return <span className="about-member-avatar" aria-label={'صورة '+(member?.name||'عضو الفريق')}>
  <span className="about-avatar-initial" aria-hidden="true">{initial}</span>
  {imageUrl&&<img key={imageUrl} src={imageUrl} width="68" height="68" loading="lazy" decoding="async"
     alt={'الصورة الشخصية لـ '+member.name} onError={e=>{e.currentTarget.style.display='none'}}/>}
 </span>;
}
export default function AboutPage({settings=DEFAULT_SITE_SETTINGS,onSettings,onBack,preview=false,backLabel='العودة إلى المكتبة'}){
 const site=normalizeSiteSettings(settings);
 const renderSection=id=>{
  if(site.hiddenSections.includes(id))return null;
  switch(id){
   case 'mission':return <section className="about-section" key={id} aria-labelledby="about-mission">
    <div className="about-section-heading"><span className="about-kicker">{site.missionKicker}</span><h2 id="about-mission">{site.missionTitle}</h2></div>
    <p className="about-mission-copy">{site.mission}</p>
    {!!site.highlights.length&&<div className="about-mini-highlights">{site.highlights.map(item=><span key={item.id}><CheckCircle2 size={17}/>{item.text}</span>)}</div>}
   </section>;
   case 'features':return <section className="about-section" key={id} aria-labelledby="about-features">
    <div className="about-section-heading"><span className="about-kicker">{site.featuresKicker}</span><h2 id="about-features">{site.featuresTitle}</h2><p>{site.featuresIntro}</p></div>
    <div className="about-feature-grid">{site.features.map(({id,icon,title,text})=>{
     const Icon=FEATURE_ICONS[icon]||BookOpen;
     return <article key={id} className="about-feature-card"><span className="about-feature-icon"><Icon size={23}/></span><h3>{title}</h3><p>{text}</p></article>;
    })}</div>
   </section>;
   case 'steps':return <section className="about-section about-process" key={id} aria-labelledby="about-steps">
    <div className="about-section-heading"><span className="about-kicker">{site.stepsKicker}</span><h2 id="about-steps">{site.stepsTitle}</h2><p>{site.stepsIntro}</p></div>
    <div className="about-steps-grid">{site.steps.map((step,i)=><div key={step.id} className="about-step">
     <span className="about-step-count">{String(i+1).padStart(2,'0')}</span><h3>{step.title}</h3><p>{step.text}</p>
    </div>)}</div>
   </section>;
   case 'sample':return <section className="about-section about-process" key={id} aria-labelledby="about-sample">
    <div className="about-reading-sample">
     <div className="about-sample-heading"><span id="about-sample"><Languages size={19}/>{site.sampleTitle}</span><small>{site.sampleSubtitle}</small></div>
     <div className="about-sample-grid">
      <div dir="ltr"><span>{site.sampleEnglishLabel}</span><p>{site.sampleEnglish}</p></div>
      <div dir="rtl"><span>{site.sampleArabicLabel}</span><p>{site.sampleArabic}</p></div>
     </div>
     <p className="about-sample-foot"><PlayCircle size={16}/>{site.sampleFoot}</p>
    </div>
   </section>;
   case 'notes':return <section className="about-section" key={id} aria-labelledby="about-notes">
    <div className="about-section-heading"><span className="about-kicker">{site.notesKicker}</span><h2 id="about-notes">{site.notesTitle}</h2></div>
    <div className="about-notes-grid">{site.notes.map(note=><p key={note.id}><Info size={19}/>{note.text}</p>)}</div>
   </section>;
   case 'team':return <section className="about-section about-team-section" key={id} aria-labelledby="about-team">
    <div className="about-section-heading"><span className="about-kicker"><Users size={16}/>{site.teamKicker}</span><h2 id="about-team">{site.teamTitle}</h2><p>{site.teamIntro}</p></div>
    {site.team.length?<div className="about-team-grid">{site.team.map(member=><article key={member.id} className="about-team-card">
     <TeamAvatar member={member}/>
     <div className="about-member-text"><h3>{member.name}</h3><span>{member.role||''}</span>{member.bio&&<p>{member.bio}</p>}</div>
     <SocialLinks links={member.socials} compact/>
    </article>)}</div>:<div className="about-empty-team">{site.teamEmpty}</div>}
   </section>;
   default:return null;
  }
 };
 return <div className="about-page">
  <header className="about-page-hero">
   <div className="about-hero-content">
    <div className="eyebrow"><Sparkles size={16}/>{site.aboutEyebrow}</div>
    <div className="about-hero-logo"><img src="/hsa-logo.svg" alt={'شعار '+site.siteName}/></div>
    <h1>{site.aboutTitle}</h1>
    <p>{site.aboutIntro}</p>
    <div className="about-hero-actions">
     {onBack&&<button type="button" onClick={onBack} className="primary-btn"><BookOpen size={17}/> {preview?'العودة للإعدادات':backLabel} <ArrowLeft size={17}/></button>}
     {onSettings&&<button type="button" className="outline-btn" onClick={onSettings}><Settings2 size={17}/> تخصيص الصفحة</button>}
    </div>
   </div>
   <div className="about-hero-visual" aria-hidden="true">
    <div className="about-visual-language">{site.heroVisualLanguages}</div>
    <div className="about-visual-paper">
     <span className="about-visual-label"><BookOpen size={16}/>{site.heroVisualLabel}</span>
     <i/><i/><i className="short"/><div className="about-visual-divider"/><i/><i className="short"/>
    </div>
    <span className="about-visual-float"><Headphones size={27}/></span>
   </div>
  </header>
  {site.sectionOrder.map(renderSection)}
 </div>;
}
