import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,Download,Highlighter,Pause,Play,Square,Trash2,Upload} from 'lucide-react';
import HsaLoader from './HsaLoader.jsx';
import {documentAccess,loadStudyDocument,publishStudyDocument,isPdfPath,attachStudyPdf} from '../lib/studyDocuments.js';
import {buildDocumentUnits,documentUnitPlan,documentPartHighlight,pageSpanSelection,unitIntersects,sameDocumentRanges,mergeDocumentRanges,rangeForDocumentText,toggleParagraphSelection,documentUnitKey,recordDocumentProgress} from '../lib/documentReader.js';
import {readOfflineDocument,saveOfflineDocument} from '../lib/offlineStore.js';
import {speakParts,pauseSpeech,resumeSpeech} from '../lib/speech.js';
import 'pdfjs-dist/web/pdf_viewer.css';

const selectionKey=(scope,path)=>'hsa-document-marks:'+scope+':'+path;
function loadMarks(key){try{return JSON.parse(localStorage.getItem(key)||'[]').filter(x=>Number.isInteger(x.page)&&Array.isArray(x.spans));}catch{return []}}
export default function OriginalDocumentReader({lesson,sections=[],userId,isAdmin,speed,volume,voices,voiceGroups,onSpeedChange,onVoiceChange,onSections,onExplain,onTranslateMissing}){
 const [access,setAccess]=useState(null),[pdf,setPdf]=useState(null),[blob,setBlob]=useState(null),[saved,setSaved]=useState(false);
 const [pageNo,setPageNo]=useState(1),[zoom,setZoom]=useState(1),[loading,setLoading]=useState(true),[rendering,setRendering]=useState(false);
 const [error,setError]=useState(''),[marks,setMarks]=useState([]),[active,setActive]=useState(null),[playing,setPlaying]=useState(false),[paused,setPaused]=useState(false),[hasText,setHasText]=useState(false);
 const [attaching,setAttaching]=useState(false);
 const [track,setTrack]=useState(()=>{try{const v=localStorage.getItem('hsa-document-track');return ['mixed','en','ar'].includes(v)?v:'mixed'}catch{return 'mixed'}}),[paragraphSelect,setParagraphSelect]=useState(false),[pageSpans,setPageSpans]=useState([]),[chosen,setChosen]=useState([]),[spoken,setSpoken]=useState(null),[notice,setNotice]=useState('');
 const [queue,setQueue]=useState([]),[progress,setProgress]=useState({tracks:{}});
 const pageSections=useMemo(()=>sections.filter(s=>s.source_page==null||s.source_page===pageNo),[sections,pageNo]);
 const units=useMemo(()=>buildDocumentUnits(pageSpans,pageSections),[pageSpans,pageSections]);
 const chosenUnits=useMemo(()=>units.filter(u=>unitIntersects(u,chosen)),[units,chosen]);
 const exactChosen=useMemo(()=>mergeDocumentRanges(chosen,pageSpans),[chosen,pageSpans]);
 const [selection,setSelection]=useState(false),[width,setWidth]=useState(700),[reload,setReload]=useState(0),[local,setLocal]=useState(false);
 const canvas=useRef(null),layer=useRef(null),sheet=useRef(null),wrap=useRef(null),divs=useRef([]),cancelSpeech=useRef(null),run=useRef(0),job=useRef(null),pdfModule=useRef(null),readyPage=useRef(null),selectedRange=useRef([]);
 const markKey=selectionKey(local?(userId||'device'):(access?.scope||'public'),local?'local:'+lesson.id:(access?.path||lesson.id))+':'+(pdf?.fingerprints?.[0]||'unloaded');
 const progressKey=markKey.replace('hsa-document-marks:','hsa-document-progress:');
 const queueKey=markKey.replace('hsa-document-marks:','hsa-document-queue:');
 const progressRef=useRef({tracks:{}});
 const saveProgress=next=>{progressRef.current=next;setProgress(next);try{localStorage.setItem(progressKey,JSON.stringify(next))}catch{}};
 const saveQueue=next=>{setQueue(next);try{localStorage.setItem(queueKey,JSON.stringify(next))}catch{setError('تعذّر حفظ قائمة القراءة.')}};
 const stop=()=>{run.current++;job.current=null;cancelSpeech.current?.();cancelSpeech.current=null;setPlaying(false);setPaused(false);setActive(null);setSpoken(null)};
 useEffect(()=>()=>{run.current++;cancelSpeech.current?.()},[]);
 useEffect(()=>{setMarks(pdf?loadMarks(markKey):[]);if(!pdf)return;setQueue(loadMarks(queueKey));let p={tracks:{}};try{p=JSON.parse(localStorage.getItem(progressKey)||'{}')}catch{};progressRef.current=p;setProgress(p);if(p.page>=1&&p.page<=pdf.numPages)setPageNo(p.page);},[markKey,pdf]);
 useEffect(()=>{if(!pdf||readyPage.current!==pageNo)return;saveProgress({...progressRef.current,page:pageNo});},[pdf,pageNo,rendering]);
 useEffect(()=>{
  if(!wrap.current)return;const el=wrap.current;const resize=()=>setWidth(Math.max(180,el.clientWidth-24));resize();
  const ro=new ResizeObserver(resize);ro.observe(el);return()=>ro.disconnect();
 },[pdf]);
 useEffect(()=>{
  let live=true;setLoading(true);setError('');setBlob(null);setPdf(null);setLocal(false);
  (async()=>{try{
   const a=await documentAccess(lesson,userId);if(!live)return;setAccess(a);
   if(a.path){const loaded=await loadStudyDocument(a);if(live){setBlob(loaded.blob);setSaved(loaded.saved);}}
   else{const stored=await readOfflineDocument(userId||'device','local:'+lesson.id).catch(()=>null);if(live&&stored){setLocal(true);setBlob(stored);setSaved(true);}}
  }catch(e){if(live)setError(e?.message||'تعذّر تحميل المستند.')}
  finally{if(live)setLoading(false)}})();
  return()=>{live=false};
 },[lesson.id,userId,reload]);
 useEffect(()=>{
  if(!blob)return;let alive=true,task;setLoading(true);setPdf(null);setPageNo(1);setError('');
  (async()=>{try{
   const lib=await import('pdfjs-dist');pdfModule.current=lib;
   lib.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
   const data=new Uint8Array(await blob.arrayBuffer());if(!alive)return;
   task=lib.getDocument({data,cMapUrl:'/pdf-support/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf-support/standard_fonts/',wasmUrl:'/pdf-support/wasm/',isEvalSupported:false});
   const doc=await task.promise;if(alive)setPdf(doc);
  }catch(e){if(alive)setError('تعذّر فتح PDF. تأكد من سلامة الملف وأنه غير محمي بكلمة مرور.')}
  finally{if(alive)setLoading(false)}})();
  return()=>{alive=false;task?.destroy()};
 },[blob]);
 useEffect(()=>{
  if(!pdf||!canvas.current||!layer.current||!sheet.current)return;
  let alive=true,renderTask,textTask;readyPage.current=null;selectedRange.current=[];setChosen([]);setPageSpans([]);setRendering(true);setHasText(false);setSelection(false);divs.current=[];setActive(null);
  const cv=canvas.current,tl=layer.current,sh=sheet.current;tl.replaceChildren();
  (async()=>{try{
   const page=await pdf.getPage(pageNo);if(!alive)return;
   const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2.5,width/base.width)*zoom});
   const dpr=Math.min(2,window.devicePixelRatio||1);cv.width=Math.ceil(viewport.width*dpr);cv.height=Math.ceil(viewport.height*dpr);
   sh.style.width=viewport.width+'px';sh.style.height=viewport.height+'px';
   sh.style.setProperty('--scale-factor',String(viewport.scale));
   sh.style.setProperty('--total-scale-factor',String(viewport.scale*(page.userUnit||1)));
   sh.style.setProperty('--user-unit',String(page.userUnit||1));
   renderTask=page.render({canvas:cv,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null});await renderTask.promise;if(!alive)return;
   const content=await page.getTextContent();if(!alive)return;
   textTask=new pdfModule.current.TextLayer({textContentSource:content,container:tl,viewport});await textTask.render();
   if(!alive)return;
   divs.current=textTask.textDivs;setPageSpans(divs.current.map((d,index)=>{const rect=d.getBoundingClientRect();return {index,start:0,end:d.textContent.length,text:d.textContent,y:rect.top,height:rect.height}}));readyPage.current=pageNo;setHasText(divs.current.some(d=>d.textContent.trim()));
  }catch(e){if(alive)setError('تعذّر عرض الصفحة.')}
  finally{if(alive)setRendering(false)}})();
  return()=>{alive=false;readyPage.current=null;renderTask?.cancel();textTask?.cancel();};
 },[pdf,pageNo,width,zoom]);
 // Paint exact text ranges; the original PDF remains an untouched canvas.
 useEffect(()=>{
  if(rendering||readyPage.current!==pageNo||!sheet.current||!layer.current)return;
  const overlay=sheet.current.querySelector('.document-highlights');if(!overlay)return;overlay.replaceChildren();
  const bounds=sheet.current.getBoundingClientRect();
  const paint=(span,kind)=>{
   const range=rangeForDocumentText(divs.current[span.index],span.start,span.end);if(!range)return;
   for(const rect of range.getClientRects()){
    if(!rect.width||!rect.height)continue;
    const el=document.createElement('i');el.className=kind;
    Object.assign(el.style,{left:(rect.left-bounds.left)+'px',top:(rect.top-bounds.top)+'px',width:rect.width+'px',height:rect.height+'px'});overlay.append(el);
   }
  };
  for(const item of queue.filter(m=>m.page===pageNo))for(const span of item.spans)paint(span,'document-queued-mark');
  for(const mark of marks.filter(m=>m.page===pageNo))for(const span of mark.spans)paint(span,'document-mark');
  for(const span of chosen)paint(span,'document-selected-mark');
  for(const span of active||[])paint(span,'document-reading-mark');
 },[marks,queue,active,chosen,rendering,pageNo,width,zoom]);
 useEffect(()=>{
  const handle=()=>{const sel=window.getSelection();if(layer.current&&sel?.anchorNode&&sel?.focusNode&&layer.current.contains(sel.anchorNode)&&layer.current.contains(sel.focusNode)&&!sel.isCollapsed){selectedRange.current=pageSpanSelection(divs.current,sel);setSelection(selectedRange.current.length>0);setChosen(selectedRange.current);}};
  document.addEventListener('selectionchange',handle);return()=>document.removeEventListener('selectionchange',handle);
 },[]);
 const saveMarks=next=>{setMarks(next);try{localStorage.setItem(markKey,JSON.stringify(next))}catch{setError('تعذّر حفظ التحديدات على الجهاز.')}};
 const selectedSpans=()=>selectedRange.current;
 const addMark=()=>{const spans=selectedSpans();if(!spans.length)return;saveMarks([...marks,{id:crypto.randomUUID(),page:pageNo,spans}]);window.getSelection()?.removeAllRanges();selectedRange.current=[];setChosen([]);setSelection(false);};
 const clearChoice=()=>{selectedRange.current=[];setChosen([]);setSelection(false);window.getSelection()?.removeAllRanges();};
 const chooseParagraph=e=>{if(!paragraphSelect||playing||rendering)return;const index=divs.current.findIndex(d=>d===e.target||d.contains(e.target));if(index<0)return;let offset=null;const point=document.caretPositionFromPoint?.(e.clientX,e.clientY);const legacy=!point?document.caretRangeFromPoint?.(e.clientX,e.clientY):null;const node=point?.offsetNode||legacy?.startContainer;if(node&&divs.current[index].contains(node)){const prefix=document.createRange();prefix.selectNodeContents(divs.current[index]);prefix.setEnd(node,point?.offset??legacy.startOffset);offset=prefix.toString().length;}const unit=units.find(u=>u.ranges.some(r=>r.index===index&&(offset===null||r.start<=offset&&offset<r.end)))||units.find(u=>u.ranges.some(r=>r.index===index));if(!unit)return;saveQueue(toggleParagraphSelection(queue,pageNo,unit));window.getSelection()?.removeAllRanges();};
 const addChoiceToQueue=()=>{const full=chosenUnits.length?chosenUnits:[];let next=[...queue];for(const u of full){const key=documentUnitKey(u);if(!next.some(x=>x.page===pageNo&&x.key===key))next.push({page:pageNo,key,spans:u.ranges});}saveQueue(next);clearChoice();};
 const expandChoice=()=>{const ranges=mergeDocumentRanges(chosenUnits.flatMap(u=>u.ranges),pageSpans);selectedRange.current=ranges;setChosen(ranges);setSelection(!!ranges.length);window.getSelection()?.removeAllRanges();};
 const go=n=>{stop();setPageNo(Math.max(1,Math.min(pdf.numPages,n)));};
 const read=(mode,spans=null,single=null)=>{
  stop();setError('');setNotice('');
  if(navigator.onLine===false){setError('القراءة الصوتية تتطلب الإنترنت.');return;}
  const id=++run.current;
  const selected=mode==='queue'?(single?[single]:[...queue]):[...marks];const point=progressRef.current.tracks?.[track];
  job.current={id,mode,spans,track,skipped:0,marks:selected,resume:mode==='resume'?point:null,page:mode==='all'?1:mode==='resume'?point?.lastPage||pageNo:['marks','queue'].includes(mode)?selected.map(m=>m.page).sort((a,b)=>a-b)[0]:pageNo};
  setPlaying(true);setPaused(false);setPageNo(job.current.page);
 };
 useEffect(()=>{
  const j=job.current;if(!j||!playing||paused||rendering||!pdf||j.page!==pageNo||readyPage.current!==pageNo||j.started===pageNo)return;
  j.started=pageNo;
  const picked=j.mode==='selection'?j.spans:['marks','queue'].includes(j.mode)?mergeDocumentRanges(j.marks.filter(m=>m.page===pageNo).flatMap(m=>m.spans),pageSpans):null;
  const pageUnits=buildDocumentUnits(pageSpans,pageSections);
  let target=pageUnits;
  if(picked){
   const matching=pageUnits.filter(u=>unitIntersects(u,picked));
   if(j.mode==='queue'){target=matching;}else if(j.track==='en'||j.track==='ar'&&matching.every(u=>u.native==='ar')){
    // Read exactly the selected range, without adding neighboring words.
    target=buildDocumentUnits(picked,[]);
   }else{
    const full=mergeDocumentRanges(matching.flatMap(u=>u.ranges),pageSpans);
    if(!sameDocumentRanges(full,picked)){stop();setError('اختر فقرة كاملة مترجمة، أو وسّع التحديد قبل القراءة.');return;}
    target=matching;
   }
  }
  if(j.mode==='resume'&&j.resume?.lastPage===pageNo&&j.resume.lastUnit){const index=target.findIndex(u=>documentUnitKey(u)===j.resume.lastUnit);if(index>=0){const done=j.resume.units?.[pageNo]?.includes(j.resume.lastUnit);target=target.slice(index+(done?1:0));}}
  const advance=()=>{
   if(run.current!==j.id)return;
   const next=['all','resume'].includes(j.mode)&&pageNo<pdf.numPages?pageNo+1:['marks','queue'].includes(j.mode)?j.marks.map(m=>m.page).filter(n=>n>pageNo).sort((a,b)=>a-b)[0]:null;
   setActive(null);setSpoken(null);
   if(next){j.page=next;j.started=null;setPageNo(next);}else{stop();setNotice(j.skipped?'اكتملت قراءة النص المتاح. تعذّرت قراءة '+j.skipped+' صفحة بلا نص قابل للتحديد.':'اكتملت القراءة.');}
  };
  if(!target.length){if(j.mode==='resume'&&pageUnits.length&&j.resume?.lastPage===pageNo){saveProgress(recordDocumentProgress(progressRef.current,j.track,pageNo,null,true));advance();return;}if(['all','resume','marks','queue'].includes(j.mode)){j.skipped++;advance();}else{stop();setError('لا يوجد نص قابل للقراءة في هذا التحديد.');}return;}
  const readUnit=at=>{
   if(run.current!==j.id)return;
   if(at>=target.length){const completed=progressRef.current.tracks?.[j.track]?.units?.[pageNo]||[];if(['all','resume','page','queue'].includes(j.mode)&&pageUnits.length&&pageUnits.every(u=>completed.includes(documentUnitKey(u))))saveProgress(recordDocumentProgress(progressRef.current,j.track,pageNo,null,true));advance();return;}
   const unit=target[at],plan=documentUnitPlan(unit,j.track),unitKey=documentUnitKey(unit);
   if(['all','resume','page','queue'].includes(j.mode))saveProgress(recordDocumentProgress(progressRef.current,j.track,pageNo,unitKey));
   if(plan.missing){stop();setActive(unit.ranges);selectedRange.current=unit.ranges;setChosen(unit.ranges);setSelection(true);setError('توقفت القراءة: لا تتوفر ترجمة مطابقة لهذا الجزء. اختر لغة النص الأصلي أو اطلب إكمال الترجمة.');return;}
   if(!plan.parts.length){readUnit(at+1);return;}
   const parts=plan.parts;
   cancelSpeech.current=speakParts(parts,speed,()=>{},()=>{if(run.current!==j.id)return;if(['all','resume','page','queue'].includes(j.mode))saveProgress(recordDocumentProgress(progressRef.current,j.track,pageNo,unitKey,true));readUnit(at+1)},msg=>{if(run.current===j.id){stop();setError(msg)}},voices,
    ({index,lang})=>{if(run.current===j.id){const part=parts[index];setActive(documentPartHighlight(part));setSpoken({lang,translated:part?.translated,translation:unit.translation,sectionId:unit.sectionId,reviewed:unit.reviewed});}},volume,
    ({index,charIndex,charLength,name})=>{if(run.current===j.id&&(name==='word'||!name))setActive(documentPartHighlight(parts[index],charIndex,charLength));});
  };
  readUnit(0);
 },[playing,paused,rendering,pageNo,pdf,pageSpans,pageSections]);
 const chooseLocal=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;stop();
  if(file.size>30*1024*1024||!(await file.slice(0,1024).text()).includes('%PDF-')){setError('اختر ملف PDF صالحًا لا يتجاوز 30 ميجابايت.');return;}
  setLocal(true);setBlob(file);setSaved(await saveOfflineDocument(userId||'device','local:'+lesson.id,file).then(()=>true,()=>false));
 };
 const publish=async()=>{const next=!access?.published;stop();if(next&&!window.confirm('سيصبح الملف الأصلي كاملًا متاحًا للزوار، بما في ذلك جميع صفحاته. هل تريد نشره؟'))return;
  try{await publishStudyDocument(lesson,next,access.path);setReload(v=>v+1);}catch(e){setError('تعذّر تحديث إتاحة المستند.');}};
 const attach=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;stop();setAttaching(true);setError('');try{await attachStudyPdf(lesson,userId,file);setReload(v=>v+1);}catch(e){setError(e?.message||'تعذّر إرفاق المستند.')}finally{setAttaching(false)}};
 const download=()=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=local?'منهج.pdf':lesson.source_filename||'منهج.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
 return <section className="document-reader">
  <header className="document-reader-head"><div><h2><BookOpen size={20}/> المنهج الأصلي</h2><small>{saved?'محفوظ للعرض دون إنترنت':'عرض الصفحات كما وردت في الملف'}</small></div>
   <div className="document-reader-actions">
    {isAdmin&&access?.path&&<button className="outline-btn" onClick={publish} disabled={navigator.onLine===false||loading}>{access.published?'إلغاء إتاحة الملف':'إتاحة الملف للزوار'}</button>}
    {isAdmin&&access&&!access.path&&<label className="outline-btn">{attaching?<HsaLoader size={18}/>:<Upload size={16}/>} إرفاق PDF للدرس<input hidden disabled={attaching||navigator.onLine===false} type="file" accept="application/pdf,.pdf" onChange={attach}/></label>}
    <label className="outline-btn"><Upload size={16}/> PDF من جهازي<input hidden type="file" accept="application/pdf,.pdf" onChange={chooseLocal}/></label>
    {blob&&<button className="outline-btn" onClick={download}><Download size={16}/> تنزيل PDF</button>}
    <button className="outline-btn" onClick={onSections}>الشرح</button>
   </div>
  </header>
  {error&&<p className="inline-alert" role="alert">{error} <button className="outline-btn" onClick={()=>{stop();setReload(v=>v+1)}}>إعادة المحاولة</button></p>}
  {loading&&<div className="accounts-empty hsa-loading-stack" role="status"><HsaLoader size={64}/> جارٍ فتح المستند…</div>}
  {!loading&&!pdf&&!error&&<div className="accounts-empty hsa-loading-stack"><BookOpen size={30}/><p>لا توجد نسخة PDF متاحة لهذا الدرس. يمكنك اختيارها من جهازك أو فتح الشرح.</p></div>}
  {notice&&<p className="subtle" role="status">{notice}</p>}
  {pdf&&<>
   <div className="document-language-bar"><strong>لغة القراءة</strong><div className="segmented" role="group" aria-label="لغة قراءة المنهج">{[['mixed','إنجليزي ثم عربي'],['en','الإنجليزية فقط'],['ar','العربية فقط']].map(([id,label])=><button key={id} className={track===id?'is-active':''} aria-pressed={track===id} onClick={()=>{stop();setTrack(id);setError('');try{localStorage.setItem('hsa-document-track',id)}catch{}}}>{label}</button>)}</div></div>
   <div className="document-toolbar">
    <button className="outline-btn" onClick={()=>go(pageNo-1)} disabled={pageNo<=1}><ChevronRight size={16}/> السابقة</button>
    <label>صفحة <input key={pageNo} type="number" min="1" max={pdf.numPages} defaultValue={pageNo} onBlur={e=>{const n=Number(e.target.value);if(n&&n!==pageNo)go(n)}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/> من {pdf.numPages}</label>
    <button className="outline-btn" onClick={()=>go(pageNo+1)} disabled={pageNo>=pdf.numPages}>التالية <ChevronLeft size={16}/></button>
    <button className="outline-btn" onClick={()=>{stop();setZoom(z=>Math.max(.7,z-.2))}}>−</button><span>{Math.round(zoom*100)}%</span><button className="outline-btn" onClick={()=>{stop();setZoom(z=>Math.min(2,z+.2))}}>+</button>
   </div>
   <div className="document-toolbar">
    <button className="primary-btn" disabled={rendering||playing} onClick={()=>read('all')}><Play size={16}/> قراءة المنهج كاملًا</button>
    <button className="outline-btn" disabled={rendering||!hasText||playing} onClick={()=>read('page')}><Play size={15}/> قراءة الصفحة</button>
    <button className={'outline-btn '+(paragraphSelect?'document-select-active':'')} aria-pressed={paragraphSelect} disabled={playing||rendering} onClick={()=>{setParagraphSelect(v=>!v);clearChoice()}}><Highlighter size={15}/> {paragraphSelect?'إنهاء التحديد':'تحديد متعدد'}</button>
    <button className="outline-btn" disabled={!queue.length||playing||rendering} onClick={()=>read('queue')}><Play size={15}/> قراءة القائمة ({queue.length})</button>
    <button className="outline-btn" disabled={!selection||playing} onMouseDown={e=>e.preventDefault()} onClick={()=>{const spans=selectedSpans();if(spans.length)read('selection',spans)}}><Play size={15}/> قراءة المحدد</button>
    <button className="outline-btn" disabled={!selection} onMouseDown={e=>e.preventDefault()} onClick={addMark}><Highlighter size={16}/> حفظ التحديد</button>
    <button className="outline-btn" disabled={!marks.length||playing} onClick={()=>read('marks')}><Play size={15}/> قراءة التحديدات ({marks.length})</button>
    {playing&&<><button className="outline-btn" onClick={()=>{if(paused){resumeSpeech();setPaused(false)}else{pauseSpeech();setPaused(true)}}}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'استئناف':'إيقاف مؤقت'}</button><button className="outline-btn" onClick={stop}><Square size={15}/> إيقاف</button></>}
   </div>
   <div className="document-progress-card">
    <div><strong>تقدّم الاستماع</strong><span>{(progress.tracks?.[track]?.pages||[]).length} / {pdf.numPages} صفحة مكتملة</span></div>
    <progress max={pdf.numPages} value={(progress.tracks?.[track]?.pages||[]).length}/>
    <div><small>آخر موضع: صفحة {progress.tracks?.[track]?.lastPage||pageNo}</small><button className="outline-btn" disabled={playing||rendering||!progress.tracks?.[track]?.lastPage} onClick={()=>read('resume')}>متابعة القراءة</button></div>
    <small>{sections.length?sections.filter(s=>s.content_ar?.trim()).length+' / '+sections.length+' فقرة جاهزة بالعربية':'لا توجد ترجمة محفوظة'}</small>
    {sections.length>0&&<progress aria-label="اكتمال الترجمة" max={sections.length} value={sections.filter(s=>s.content_ar?.trim()).length}/>}
    {onTranslateMissing&&sections.some(s=>!s.content_ar?.trim())&&<button className="outline-btn" onClick={()=>{stop();onTranslateMissing()}}>إكمال الترجمة</button>}
   </div>
   {paragraphSelect&&<p className="subtle">اضغط على أي فقرة لإضافتها أو إزالتها من قائمة القراءة، ويمكنك الانتقال بين الصفحات.</p>}
   {queue.length>0&&<details className="document-mark-list" open><summary>قائمة القراءة ({queue.length})</summary>{[...queue].sort((a,b)=>a.page-b.page||a.spans[0].index-b.spans[0].index||a.spans[0].start-b.spans[0].start).map(item=><div key={item.page+':'+item.key}><button className="outline-btn" onClick={()=>go(item.page)}>صفحة {item.page}</button><span dir="auto">{item.spans.map(s=>s.text).join(' ').slice(0,110)}</span><button className="outline-btn" disabled={playing||rendering} onClick={()=>read('queue',null,item)}><Play size={14}/> قراءة</button><button className="icon-btn" disabled={playing} aria-label="إزالة الفقرة من القائمة" onClick={()=>saveQueue(queue.filter(x=>x!==item))}><Trash2 size={16}/></button></div>)}<button className="outline-btn" disabled={playing} onClick={()=>saveQueue([])}>مسح القائمة</button></details>}
   <div className="document-toolbar document-voice-settings">
    <label>سرعة القراءة <select disabled={playing} value={speed} onChange={e=>onSpeedChange?.(Number(e.target.value))}>{[.85,1,1.15,1.3,1.5].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
    {['ar','en'].map(lang=><label key={lang}>{lang==='ar'?'الصوت العربي':'الصوت الإنجليزي'} <select disabled={playing} value={voices?.[lang]||''} onChange={e=>onVoiceChange?.(lang,e.target.value)}><option value="">الصوت المتاح</option>{['female','male'].flatMap(gender=>(voiceGroups?.[lang]?.[gender]||[]).filter(v=>v?.id&&v.localService===false).map(v=><option key={v.id} value={v.id}>{v.label||v.id}</option>))}</select></label>)}
   </div>
   {!!chosen.length&&<div className="document-selection-panel"><div><strong>النص المحدد</strong><button className="icon-btn" onClick={clearChoice} aria-label="إلغاء التحديد">×</button></div><p dir="auto">{exactChosen.map(r=>r.text).join(' ')}</p>{chosenUnits.length>0&&<div className="document-selection-actions">
    <button className="outline-btn" disabled={playing} onClick={addChoiceToQueue}>إضافة الفقرات للقائمة</button>
    <button className="outline-btn" onClick={expandChoice} disabled={playing||sameDocumentRanges(mergeDocumentRanges(chosenUnits.flatMap(u=>u.ranges),pageSpans),exactChosen)}>توسيع إلى الفقرة كاملة</button>
    {chosenUnits.length===1&&chosenUnits[0].sectionId&&<button className="outline-btn" onClick={()=>{stop();onExplain?.(chosenUnits[0].sectionId)}}>شرح الفقرة</button>}
   </div>}{track!=='en'&&chosenUnits.some(u=>u.translation)&&<details><summary>ترجمة الفقرات المحددة</summary>{chosenUnits.filter(u=>u.translation).map((u,i)=><p key={i} dir="rtl">{u.translation}{!u.reviewed&&<small> — ترجمة أولية</small>}</p>)}</details>}</div>}
   {spoken&&<div className="document-speaking-strip" role="status"><strong>{spoken.lang==='ar-SA'?'العربية':'الإنجليزية'}</strong><span>{spoken.translated?'ترجمة الفقرة المحددة':'قراءة النص الأصلي'}</span></div>}
   {spoken?.translated&&<div className="document-translation-caption" dir="rtl"><small>الترجمة العربية{spoken.reviewed?'':' · ترجمة أولية'}</small><p>{spoken.translation}</p></div>}
   {!rendering&&!hasText&&<p className="subtle">هذه الصفحة لا تحتوي نصًا قابلًا للتحديد. يمكن عرضها، لكن قراءتها تحتاج استخراجًا نصيًا.</p>}
   <div className="document-sheet-wrap" ref={wrap}>
    {rendering&&<div className="document-page-loading"><HsaLoader size={48}/></div>}
    <div className="document-sheet" ref={sheet}><canvas ref={canvas}/><div className="document-highlights" aria-hidden="true"/><div className={'textLayer'+(paragraphSelect?' document-paragraph-mode':'')} ref={layer} onClick={chooseParagraph}/></div>
   </div>
   {!!marks.length&&<details className="document-mark-list"><summary>التحديدات المحفوظة ({marks.length})</summary>{marks.map(m=><div key={m.id}><button className="outline-btn" onClick={()=>go(m.page)}>صفحة {m.page}</button><span dir="auto">{m.spans.map(s=>s.text).join(' ').slice(0,140)}</span><button className="icon-btn" aria-label="حذف التحديد" onClick={()=>{stop();saveMarks(marks.filter(x=>x.id!==m.id))}}><Trash2 size={16}/></button></div>)}</details>}
  </>}
 </section>
}
