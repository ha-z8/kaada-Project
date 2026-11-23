// Fast, local, bilingual search across the public study catalog. No external query transmission.
const ARABIC_DIGITS='٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS='۰۱۲۳۴۵۶۷۸۹';
export function normalizeStudyQuery(value){
 return String(value??'').normalize('NFKC').toLocaleLowerCase()
  .replace(/[٠-٩۰-۹]/g,char=>{
   const i=ARABIC_DIGITS.indexOf(char);
   return String(i>=0?i:PERSIAN_DIGITS.indexOf(char));
  })
  .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g,'')
  .replace(/[آأإٱ]/g,'ا').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
  .replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
const FIELD_LABELS={
 subject:'اسم المادة',description:'موضوع المادة',lesson:'عنوان الدرس',
 original:'النص الأصلي',translation:'الترجمة العربية',explanation:'شرح الدرس'
};
const WEIGHTS={lesson:110,subject:95,description:75,original:65,translation:60,explanation:50};
const tokens=value=>normalizeStudyQuery(value).split(' ').filter(Boolean).slice(0,18);
export const SEARCH_MODES=Object.freeze([
 {value:'all',label:'جميع الكلمات'},
 {value:'phrase',label:'العبارة نفسها'},
 {value:'word',label:'كلمات كاملة'},
 {value:'any',label:'أي كلمة'}
]);
export const SEARCH_FIELDS=Object.freeze([
 {value:'all',label:'كل المحتوى'},
 {value:'title',label:'المواد وعناوين الدروس'},
 {value:'original',label:'النص الأصلي'},
 {value:'translation',label:'الترجمة العربية'},
 {value:'explanation',label:'الشروح'}
]);
function fieldsForLesson(lesson,subject){
 return [
  ['lesson',lesson.title],['subject',subject?.title],['description',subject?.description]
 ].filter(([,value])=>String(value??'').trim()).map(([key,value])=>({key,text:String(value),normalized:normalizeStudyQuery(value)}));
}
function fieldsForSection(section){
 return [
  ['original',section.content_en],['translation',section.content_ar],
  ['explanation',section.explanation_ar],['explanation',section.explanation_en],
  ['explanation',section.explanation_mixed]
 ].filter(([,value])=>String(value??'').trim()).map(([key,value])=>({key,text:String(value),normalized:normalizeStudyQuery(value)}));
}
export function buildLessonSearchIndex(library){
 const subjects=(library?.subjects||[]).filter(s=>s?.id);
 const lessons=(library?.lessons||[]).filter(l=>l?.id&&l.subject_id);
 const sections=(library?.sections||[]).filter(s=>s?.id&&s.lesson_id);
 const bySubject=new Map(subjects.map(s=>[s.id,s]));
 const byLesson=new Map(lessons.map(l=>[l.id,l]));
 const entries=[];
 for(const lesson of lessons){
  const subject=bySubject.get(lesson.subject_id);
  if(!subject)continue;
  entries.push({
   type:'lesson',key:'lesson:'+lesson.id,subjectId:subject.id,lessonId:lesson.id,sectionId:null,
   subjectTitle:String(subject.title||''),lessonTitle:String(lesson.title||''),
   position:Number(lesson.position)||0,sectionPosition:-1,
   fields:fieldsForLesson(lesson,subject)
  });
 }
 for(const section of sections){
  const lesson=byLesson.get(section.lesson_id);
  const subject=lesson&&bySubject.get(lesson.subject_id);
  if(!subject)continue;
  entries.push({
   type:'paragraph',key:'paragraph:'+section.id,subjectId:subject.id,
   lessonId:lesson.id,sectionId:section.id,subjectTitle:String(subject.title||''),
   lessonTitle:String(lesson.title||''),position:Number(lesson.position)||0,
   sectionPosition:Number(section.position)||0,fields:fieldsForSection(section)
  });
 }
 return {entries,subjects,lessons};
}
const fieldAllowed=(selected,key)=>{
 if(selected==='title')return ['subject','description','lesson'].includes(key);
 return selected==='all'||key===selected;
};
function completeWord(hay,needle){
 return needle&&(' '+hay+' ').includes(' '+needle+' ');
}
function matchesText(text,terms,mode,phrase){
 if(mode==='phrase')return text.includes(phrase);
 if(mode==='word')return terms.every(t=>completeWord(text,t));
 if(mode==='any')return terms.some(t=>text.includes(t));
 return terms.every(t=>text.includes(t));
}
function fieldScore(field,terms,mode,phrase){
 if(!matchesText(field.normalized,terms,mode,phrase))return -1;
 let score=WEIGHTS[field.key]||0;
 if(field.normalized===phrase)score+=85;
 else if(field.normalized.startsWith(phrase))score+=38;
 else if(field.normalized.includes(phrase))score+=22;
 if(mode==='any')score+=terms.filter(t=>field.normalized.includes(t)).length*7;
 else score+=terms.length*4;
 return score;
}
function excerpt(text,phrase,terms){
 const clean=String(text??'').replace(/\s+/g,' ').trim();
 if(clean.length<=210)return clean;
 const lower=clean.toLocaleLowerCase();
 const hits=[phrase,...terms].filter(Boolean).map(t=>lower.indexOf(t)).filter(n=>n>=0);
 const at=hits.length?Math.min(...hits):0;
 const start=Math.max(0,at-58),end=Math.min(clean.length,start+210);
 return (start?'…':'')+clean.slice(start,end)+(end<clean.length?'…':'');
}
export function searchLessonIndex(index,options={}){
 const query=normalizeStudyQuery(options.query);
 if(!query)return [];
 const terms=tokens(options.query);
 const mode=['all','phrase','word','any'].includes(options.mode)?options.mode:'all';
 const field=SEARCH_FIELDS.some(f=>f.value===options.field)?options.field:'all';
 const type=['all','lesson','paragraph'].includes(options.type)?options.type:'all';
 const subjectId=options.subjectId||'all',lessonId=options.lessonId||'all';
 const hits=[];
 for(const entry of index?.entries||[]){
  if(subjectId!=='all'&&entry.subjectId!==subjectId)continue;
  if(lessonId!=='all'&&entry.lessonId!==lessonId)continue;
  if(type!=='all'&&entry.type!==type)continue;
  const available=entry.fields.filter(f=>fieldAllowed(field,f.key));
  if(entry.type==='paragraph'&&field==='title')continue;
  if(entry.type==='lesson'&&!['all','title'].includes(field))continue;
  let matches=available.map(f=>({field:f,score:fieldScore(f,terms,mode,query)})).filter(v=>v.score>=0);
  // An "all words" query can span the original, translation and explanation.
  if(!matches.length&&mode==='all'&&available.length>1){
   const combined=available.map(f=>f.normalized).join(' ');
   if(terms.every(t=>combined.includes(t))){
    const anchor=available.find(f=>terms.some(t=>f.normalized.includes(t)))||available[0];
    matches=[{field:anchor,score:(WEIGHTS[anchor.key]||30)+terms.length*3}];
   }
  }
  if(!matches.length)continue;
  matches.sort((a,b)=>b.score-a.score);
  const match=matches[0];
  hits.push({...entry,score:match.score,matchLabel:FIELD_LABELS[match.field.key],
   matchField:match.field.key,excerpt:excerpt(match.field.text,query,terms)});
 }
 hits.sort((a,b)=>b.score-a.score||a.subjectTitle.localeCompare(b.subjectTitle,'ar')||
   a.position-b.position||a.sectionPosition-b.sectionPosition||a.key.localeCompare(b.key));
 return hits;
}
export function highlightSearchParts(value,query){
 const text=String(value??'');
 const pieces=tokens(query);
 if(!pieces.length)return [{text,highlight:false}];
 // Build a safe regular expression: no HTML, no untrusted regexp execution.
 const special=/[-\/\\^$*+?.()|[\]{}]/g;
 const safe=pieces.map(x=>x.replace(special,'\\$&'));
 const regex=new RegExp('('+safe.join('|')+')','giu');
 const parts=[];
 let last=0,match;
 while((match=regex.exec(text))!==null){
  if(match.index>last)parts.push({text:text.slice(last,match.index),highlight:false});
  parts.push({text:match[0],highlight:true});
  last=regex.lastIndex;
  if(parts.length>=90)break;
 }
 if(last<text.length)parts.push({text:text.slice(last),highlight:false});
 return parts.length?parts:[{text,highlight:false}];
}
