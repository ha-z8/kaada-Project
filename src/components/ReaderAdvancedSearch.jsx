import {useEffect,useMemo,useState} from 'react';
import {BookOpen,Check,ChevronDown,ChevronLeft,Filter,Search,SlidersHorizontal,X} from 'lucide-react';
import {
 buildLessonSearchIndex,searchLessonIndex,highlightSearchParts,
 SEARCH_FIELDS,SEARCH_MODES
} from '../lib/lessonSearch.js';

const PAGE_SIZE=15;
function Highlight({text,query}){
 return <>{highlightSearchParts(text,query).map((part,index)=>
  part.highlight?<mark key={index}>{part.text}</mark>:<span key={index}>{part.text}</span>
 )}</>;
}
export default function ReaderAdvancedSearch({library,activeLessonId,onOpenResult}){
 const [query,setQuery]=useState('');
 const [showFilters,setShowFilters]=useState(false);
 const [scope,setScope]=useState('all');
 const [subjectId,setSubjectId]=useState('all');
 const [lessonId,setLessonId]=useState('all');
 const [field,setField]=useState('all');
 const [mode,setMode]=useState('all');
 const [type,setType]=useState('all');
 const [visible,setVisible]=useState(PAGE_SIZE);
 const index=useMemo(()=>buildLessonSearchIndex(library),[library.subjects,library.lessons,library.sections]);
 const scopedLessons=useMemo(
  ()=>index.lessons.filter(l=>subjectId==='all'||l.subject_id===subjectId),
  [index.lessons,subjectId]
 );
 const hits=useMemo(()=>searchLessonIndex(index,{
  query,mode,field,type,subjectId:scope==='current'?'all':subjectId,
  lessonId:scope==='current'?activeLessonId:lessonId
 }),[index,query,mode,field,type,subjectId,lessonId,scope,activeLessonId]);
 useEffect(()=>setVisible(PAGE_SIZE),[query,mode,field,type,subjectId,lessonId,scope]);
 const resetFilters=()=>{
  setScope('all');setSubjectId('all');setLessonId('all');
  setField('all');setMode('all');setType('all');setVisible(PAGE_SIZE);
 };
 const applied=scope==='current'||subjectId!=='all'||lessonId!=='all'||field!=='all'||mode!=='all'||type!=='all';
 const open=result=>onOpenResult(result.lessonId,result.sectionId);
 return <section className="reader-advanced-search" aria-label="البحث المتقدم في المواد والدروس">
  <div className="reader-search-heading">
   <div className="reader-search-heading-title"><span className="reader-search-heading-icon"><Search size={20}/></span>
    <div><h2>البحث المتقدم في الدروس</h2>
     <p>ابحث في موضوع أو عنوان درس، أو في أي فقرة وترجمتها وشرحها، ثم انتقل للموضع مباشرة.</p>
    </div>
   </div>
   <button type="button" className={'reader-search-filter-trigger'+(showFilters?' selected':'')}
    onClick={()=>setShowFilters(v=>!v)} aria-expanded={showFilters} aria-controls="reader-search-options">
    <SlidersHorizontal size={16}/> تصفية متقدمة {applied&&<span className="reader-search-filter-dot" aria-label="توجد تصفيات نشطة"/>}
    <ChevronDown size={15}/>
   </button>
  </div>
  <div className="reader-search-input-wrap">
   <Search size={20} aria-hidden="true"/>
   <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
    placeholder="ابحث عن كلمة، مصطلح، موضوع، شرح، أو فقرة..."
    aria-label="ابحث في محتوى الدروس" autoComplete="off"
    onKeyDown={event=>{
     if(event.key==='Escape')setQuery('');
     if(event.key==='Enter'&&hits.length){event.preventDefault();open(hits[0])}
    }}/>
   {!!query&&<button type="button" onClick={()=>setQuery('')}
    aria-label="مسح البحث" title="مسح البحث"><X size={17}/></button>}
  </div>
  <div className="reader-search-quick-scopes" role="group" aria-label="نطاق البحث">
   <button type="button" className={scope==='all'?'active':''} aria-pressed={scope==='all'}
    onClick={()=>setScope('all')}>جميع المواد والدروس</button>
   <button type="button" className={scope==='current'?'active':''} aria-pressed={scope==='current'}
    disabled={!activeLessonId} onClick={()=>setScope('current')}>الدرس المفتوح</button>
   {applied&&<button type="button" className="reader-search-clear-filters" onClick={resetFilters}>مسح التصفيات</button>}
  </div>
  {showFilters&&<div id="reader-search-options" className="reader-search-advanced-filters">
   <label>المادة
    <select value={subjectId} disabled={scope==='current'} onChange={e=>{setSubjectId(e.target.value);setLessonId('all')}}>
     <option value="all">جميع المواد</option>
     {index.subjects.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
    </select>
   </label>
   <label>الدرس
    <select value={lessonId} disabled={scope==='current'} onChange={e=>setLessonId(e.target.value)}>
     <option value="all">جميع الدروس</option>
     {scopedLessons.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}
    </select>
   </label>
   <label>البحث داخل
    <select value={field} onChange={e=>setField(e.target.value)}>
     {SEARCH_FIELDS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
    </select>
   </label>
   <label>نوع النتيجة
    <select value={type} onChange={e=>setType(e.target.value)}>
     <option value="all">عناوين وفقرات</option>
     <option value="lesson">الدروس والموضوعات</option>
     <option value="paragraph">الفقرات فقط</option>
    </select>
   </label>
   <label>مطابقة البحث
    <select value={mode} onChange={e=>setMode(e.target.value)}>
     {SEARCH_MODES.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
    </select>
   </label>
   <p><Filter size={14}/> «العبارة نفسها» للبحث بجملة متتابعة، و«كلمات كاملة» لتجنب مطابقة أجزاء الكلمات. يدعم البحث العربي دون اعتبار للتشكيل واختلافات الهمزة.</p>
  </div>}
  {query.trim()?<div className="reader-search-results" aria-live="polite">
   <div className="reader-search-results-heading"><strong>{hits.length?hits.length+' نتيجة مطابقة':'لا توجد نتائج مطابقة'}</strong>
    <span>{scope==='current'?'في الدرس المفتوح':'في المكتبة التعليمية'}</span>
   </div>
   {hits.length?<div className="reader-search-results-list">
    {hits.slice(0,visible).map(hit=><button type="button" key={hit.key}
     className="reader-search-result" onClick={()=>open(hit)}
     aria-label={'فتح '+hit.lessonTitle+(hit.sectionId?'، المقطع '+(hit.sectionPosition+1):'')}>
     <span className="reader-search-result-icon"><BookOpen size={18}/></span>
     <span className="reader-search-result-details">
      <span className="reader-search-result-breadcrumb">{hit.subjectTitle} <ChevronLeft size={12}/> {hit.lessonTitle}</span>
      <strong>{hit.type==='lesson'?<Highlight text={hit.lessonTitle} query={query}/>:('المقطع '+(hit.sectionPosition+1))}</strong>
      <span className="reader-search-result-excerpt" dir="auto"><Highlight text={hit.excerpt} query={query}/></span>
      <small><span>{hit.matchLabel}</span><span>{hit.type==='lesson'?'موضوع أو عنوان':'فقرة دراسية'}</span></small>
     </span>
     <span className="reader-search-result-open"><ChevronLeft size={19}/></span>
    </button>)}
   </div>:<div className="reader-search-no-results">
    <Search size={25}/>
    <p>جرّب كلمة أخرى، أو ابحث في «كل المحتوى» أو اختر «أي كلمة» من المطابقة المتقدمة.</p>
   </div>}
   {visible<hits.length&&<button type="button" className="reader-search-show-more"
    onClick={()=>setVisible(v=>v+PAGE_SIZE)}>عرض المزيد ({hits.length-visible} متبقية) <ChevronDown size={17}/></button>}
  </div>:<div className="reader-search-help">
   <Check size={14}/> البحث يشمل جميع الفصول والمقاطع باللغة العربية والإنجليزية؛ لا يحتاج تسجيل دخول.
  </div>}
 </section>;
}
