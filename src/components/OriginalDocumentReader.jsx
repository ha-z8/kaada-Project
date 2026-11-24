import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,Download,Highlighter,Pause,Play,Square,Trash2,Upload,Languages,MessageSquare,Pencil,Undo2,Redo2,Search,PanelRight,Settings2,Maximize2,Minimize2,FileText,Headphones,CheckCircle2,RotateCcw} from 'lucide-react';
import HsaLoader from './HsaLoader.jsx';
import DocumentAnnotationCenter from './DocumentAnnotationCenter.jsx';
import DocumentPageNavigator from './DocumentPageNavigator.jsx';
import DocumentAdvancedSearch from './DocumentAdvancedSearch.jsx';
import {documentSearchRanges} from '../lib/documentSearch.js';
import {useNotice,notifyUser} from '../lib/notifications.js';
import {translateDocumentSelection} from '../lib/selectionTranslation.js';
import {documentAccess,loadStudyDocument,publishStudyDocument,isPdfPath,attachStudyPdf} from '../lib/studyDocuments.js';
import {buildDocumentUnits,documentUnitPlan,documentPartHighlight,pageSpanSelection,unitIntersects,sameDocumentRanges,mergeDocumentRanges,rangeForDocumentText,toggleParagraphSelection,documentUnitKey,recordDocumentProgress,snapWordRanges,changeMarkRanges,normalizedMark,MARK_COLORS,MARK_TYPES,selectionExplanationPlan,pagePlaybackPlan,playbackPage,selectedDocumentUnits,annotationPlayback,annotationId,resolveSelectionTranslations,selectionTranslationKey,documentWordAt,wordPlaybackPlan} from '../lib/documentReader.js';
import {readOfflineDocument,saveOfflineDocument} from '../lib/offlineStore.js';
import {speakParts,pauseSpeech,resumeSpeech} from '../lib/speech.js';
import 'pdfjs-dist/web/pdf_viewer.css';

const selectionKey=(scope,path)=>'hsa-document-marks:'+scope+':'+path;
function loadMarks(key){try{return JSON.parse(localStorage.getItem(key)||'[]').filter(x=>Number.isInteger(x.page)&&Array.isArray(x.spans));}catch{return []}}
export default function OriginalDocumentReader({lesson,sections=[],userId,isAdmin,speed,volume,voices,voiceGroups,onSpeedChange,onVoiceChange,onRefreshVoices,onVolumeChange,onSections,onExplain,onTranslateMissing}){
 const [access,setAccess]=useState(null),[pdf,setPdf]=useState(null),[blob,setBlob]=useState(null),[saved,setSaved]=useState(false);
 const [pageNo,setPageNo]=useState(1),[zoom,setZoom]=useState(1),[loading,setLoading]=useState(true),[rendering,setRendering]=useState(false);
 const [error,setError]=useState(''),[marks,setMarks]=useState([]),[active,setActive]=useState(null),[playing,setPlaying]=useState(false),[paused,setPaused]=useState(false),[hasText,setHasText]=useState(false);
 const [attaching,setAttaching]=useState(false),[word,setWord]=useState(null);
 const [panel,setPanel]=useState('pages'),[focusMode,setFocusMode]=useState(false),[focusPanel,setFocusPanel]=useState(false),[voiceChecks,setVoiceChecks]=useState({}),[previewVoiceId,setPreviewVoiceId]=useState('');
 const workspace=useRef(null),pendingSearch=useRef(null);
 const [searchRanges,setSearchRanges]=useState([]);
 const [pageInput,setPageInput]=useState('1'),[followAudio,setFollowAudio]=useState(true),[audioStarting,setAudioStarting]=useState(false),[readScope,setReadScope]=useState('page');
 const [markColor,setMarkColor]=useState('yellow'),[markType,setMarkType]=useState('normal'),[markNote,setMarkNote]=useState(''),[editingMark,setEditingMark]=useState(null),[editMode,setEditMode]=useState('replace'),[showTranslation,setShowTranslation]=useState(false),[showExplanation,setShowExplanation]=useState(false),[history,setHistory]=useState([]),[future,setFuture]=useState([]);
 const pageSpansRef=useRef([]),pendingMarkRef=useRef(null),selectionModeRef=useRef(false),centerRef=useRef(null);
 const [centerOpen,setCenterOpen]=useState(false),[centerTab,setCenterTab]=useState('saved'),[checkedMarks,setCheckedMarks]=useState([]),[checkedQueue,setCheckedQueue]=useState([]);
 const [track,setTrack]=useState(()=>{try{const v=localStorage.getItem('hsa-document-track');return ['mixed','en','ar'].includes(v)?v:'mixed'}catch{return 'mixed'}}),[paragraphSelect,setParagraphSelect]=useState(false),[pageSpans,setPageSpans]=useState([]),[chosen,setChosen]=useState([]),[spoken,setSpoken]=useState(null),[notice,setNotice]=useState('');
 const [queue,setQueue]=useState([]),[progress,setProgress]=useState({tracks:{}});
 useNotice(error,'error');useNotice(notice,/حُفظ|اكتملت/.test(notice)?'success':'info');
 const pageSections=useMemo(()=>sections.filter(s=>s.source_page==null||s.source_page===pageNo),[sections,pageNo]);
 const units=useMemo(()=>buildDocumentUnits(pageSpans,pageSections),[pageSpans,pageSections]);
 const chosenUnits=useMemo(()=>units.filter(u=>unitIntersects(u,chosen)),[units,chosen]);
 const exactUnits=useMemo(()=>selectedDocumentUnits(chosenUnits,chosen,pageSpans),[chosenUnits,chosen,pageSpans]);
 const selectionSignature=JSON.stringify(exactUnits.map(selectionTranslationKey));
 const translationCache=useRef(new Map()),translationRequest=useRef(0);
 const [selectionResult,setSelectionResult]=useState({key:'',status:'idle',units:[],error:''});
 const translateExact=unit=>translateDocumentSelection(unit,{isAdmin,sections});
 const requestSelectionTranslation=async()=>{setPanel('selection');setFocusPanel(true);
  const id=++translationRequest.current,key=selectionSignature;setShowTranslation(true);setSelectionResult({key,status:'loading',units:[],error:''});
  try{const translated=await resolveSelectionTranslations(exactUnits,translateExact,translationCache.current);if(translationRequest.current===id)setSelectionResult({key,status:'ready',units:translated,error:''});}
  catch(e){if(translationRequest.current===id){setSelectionResult({key,status:'error',units:[],error:''});notifyUser(e?.message||'تعذّر ترجمة المحدد.','error');}}
 };
 useEffect(()=>{translationRequest.current++;setSelectionResult({key:'',status:'idle',units:[],error:''});setShowTranslation(false);},[selectionSignature]);
 const exactChosen=useMemo(()=>mergeDocumentRanges(chosen,pageSpans),[chosen,pageSpans]);
 const [selection,setSelection]=useState(false),[width,setWidth]=useState(700),[reload,setReload]=useState(0),[local,setLocal]=useState(false);
 const canvas=useRef(null),layer=useRef(null),sheet=useRef(null),wrap=useRef(null),divs=useRef([]),cancelSpeech=useRef(null),run=useRef(0),job=useRef(null),pdfModule=useRef(null),readyPage=useRef(null),selectedRange=useRef([]);
 useNotice(!rendering&&pdf&&!hasText&&readyPage.current===pageNo?'هذه الصفحة لا تحتوي نصًا قابلًا للقراءة.':'','warning');
 const markKey=selectionKey(local?(userId||'device'):(access?.scope||'public'),local?'local:'+lesson.id:(access?.path||lesson.id))+':'+(pdf?.fingerprints?.[0]||'unloaded');
 const progressKey=markKey.replace('hsa-document-marks:','hsa-document-progress:');
 const queueKey=markKey.replace('hsa-document-marks:','hsa-document-queue:');
 const progressRef=useRef({tracks:{}});
 const saveProgress=next=>{progressRef.current=next;setProgress(next);try{localStorage.setItem(progressKey,JSON.stringify(next))}catch{}};
 const saveQueue=next=>{setQueue(next);try{localStorage.setItem(queueKey,JSON.stringify(next))}catch{setError('تعذّر حفظ قائمة القراءة.')}};
 const stop=()=>{setPreviewVoiceId('');run.current++;job.current=null;cancelSpeech.current?.();cancelSpeech.current=null;setAudioStarting(false);setPlaying(false);setPaused(false);setActive(null);setSpoken(null)};
 useEffect(()=>()=>{run.current++;cancelSpeech.current?.()},[]);
 useEffect(()=>{setMarks(pdf?loadMarks(markKey).map(normalizedMark):[]);setHistory([]);setFuture([]);setEditingMark(null);if(!pdf)return;setQueue(loadMarks(queueKey));let p={tracks:{}};try{p=JSON.parse(localStorage.getItem(progressKey)||'{}')}catch{};progressRef.current=p;setProgress(p);if(p.page>=1&&p.page<=pdf.numPages)setPageNo(p.page);},[markKey,pdf]);
 useEffect(()=>{if(!pdf||readyPage.current!==pageNo)return;saveProgress({...progressRef.current,page:pageNo});},[pdf,pageNo,rendering]);
 useEffect(()=>{
  if(!wrap.current)return;const el=wrap.current;const resize=()=>setWidth(Math.max(180,el.clientWidth-24));resize();
  const ro=new ResizeObserver(resize);ro.observe(el);return()=>ro.disconnect();
 },[pdf]);
 useEffect(()=>{
  let live=true;setLoading(true);setError('');setBlob(null);setPdf(null);setLocal(false);setWord(null);
  (async()=>{try{
   const a=await documentAccess(lesson,userId);if(!live)return;setAccess(a);
   if(a.path){const loaded=await loadStudyDocument(a);if(live){setBlob(loaded.blob);setSaved(loaded.saved);}}
   else if(isAdmin){const stored=await readOfflineDocument(userId,'local:'+lesson.id).catch(()=>null);if(live&&stored){setLocal(true);setBlob(stored);setSaved(true);}}
  }catch(e){if(live)setError(e?.message||'تعذّر تحميل المستند.')}
  finally{if(live)setLoading(false)}})();
  return()=>{live=false};
 },[lesson.id,userId,isAdmin,reload]);
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
  let alive=true,renderTask,textTask;readyPage.current=null;setWord(null);setSearchRanges([]);selectedRange.current=[];setChosen([]);setPageSpans([]);pageSpansRef.current=[];setEditingMark(null);setShowTranslation(false);setShowExplanation(false);setRendering(true);setHasText(false);setSelection(false);divs.current=[];setActive(null);
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
   divs.current=textTask.textDivs;const spans=divs.current.map((d,index)=>{const rect=d.getBoundingClientRect();return {index,start:0,end:d.textContent.length,text:d.textContent,y:rect.top,height:rect.height}});pageSpansRef.current=spans;setPageSpans(spans);readyPage.current=pageNo;setHasText(divs.current.some(d=>d.textContent.trim()));
  }catch(e){if(alive)setError('تعذّر عرض الصفحة.')}
  finally{if(alive)setRendering(false)}})();
  return()=>{alive=false;readyPage.current=null;renderTask?.cancel();textTask?.cancel();};
 },[pdf,pageNo,width,zoom]);
 // Paint exact text ranges; the original PDF remains an untouched canvas.
 useEffect(()=>{
  if(rendering||readyPage.current!==pageNo||!sheet.current||!layer.current)return;
  const overlay=sheet.current.querySelector('.document-highlights');if(!overlay)return;overlay.replaceChildren();
  const bounds=sheet.current.getBoundingClientRect();
  const paint=(span,kind,color)=>{
   const range=rangeForDocumentText(divs.current[span.index],span.start,span.end);if(!range)return;
   for(const rect of range.getClientRects()){
    if(!rect.width||!rect.height)continue;
    const el=document.createElement('i');el.className=kind;if(color)el.style.backgroundColor=color+'80';
    Object.assign(el.style,{left:(rect.left-bounds.left)+'px',top:(rect.top-bounds.top)+'px',width:rect.width+'px',height:rect.height+'px'});overlay.append(el);
   }
  };
  for(const item of queue.filter(m=>m.page===pageNo))for(const span of item.spans)paint(span,'document-queued-mark');
  for(const mark of marks.filter(m=>m.page===pageNo))for(const span of mark.spans)paint(span,'document-mark',MARK_COLORS[mark.color]||MARK_COLORS.yellow);
  for(const span of searchRanges)paint(span,'document-search-mark');
  for(const span of chosen)paint(span,'document-selected-mark');
  for(const span of active||[])paint(span,'document-reading-mark');
 },[marks,queue,active,chosen,searchRanges,rendering,pageNo,width,zoom]);
 useEffect(()=>{
  const handle=()=>{if(selectionModeRef.current||readyPage.current==null)return;const sel=window.getSelection();if(layer.current&&sel?.anchorNode&&sel?.focusNode&&layer.current.contains(sel.anchorNode)&&layer.current.contains(sel.focusNode)&&!sel.isCollapsed){setWord(null);selectedRange.current=snapWordRanges(pageSpanSelection(divs.current,sel),pageSpansRef.current);setSelection(selectedRange.current.length>0);setChosen(selectedRange.current);setShowTranslation(false);setShowExplanation(false);}};
  document.addEventListener('selectionchange',handle);return()=>document.removeEventListener('selectionchange',handle);
 },[]);
 const persistMarks=next=>{setMarks(next);try{localStorage.setItem(markKey,JSON.stringify(next))}catch{setError('تعذّر حفظ التحديدات على الجهاز.')}};
 const saveMarks=next=>{setHistory(h=>[...h.slice(-29),marks]);setFuture([]);persistMarks(next)};
 const undoMark=()=>{if(!history.length)return;setFuture(f=>[marks,...f]);persistMarks(history.at(-1));setHistory(h=>h.slice(0,-1));clearChoice()};
 const redoMark=()=>{if(!future.length)return;setHistory(h=>[...h,marks]);persistMarks(future[0]);setFuture(f=>f.slice(1));clearChoice()};
 const selectedSpans=()=>selectedRange.current.length?selectedRange.current:chosen;
 const openCenter=(tab='saved')=>{setCenterTab(tab);setCenterOpen(true);setPanel('marks');setFocusPanel(true);};
 useEffect(()=>{if(chosen.length){setPanel('selection');setFocusPanel(true);}},[chosen.length>0]);
 const showPanel=next=>{setPanel(next);setFocusPanel(true);if(next==='marks')setCenterOpen(true);if(window.innerWidth<=720)requestAnimationFrame(()=>workspace.current?.querySelector('.studio-panel')?.scrollIntoView({block:'nearest',behavior:'smooth'}))};
 const previewSpeaker=(lang,id)=>{stop();setError('');if(!id)return;const token=++run.current,key=lang+':'+id;setPreviewVoiceId(key);setVoiceChecks(v=>({...v,[key]:'testing'}));cancelSpeech.current=speakParts([{lang:lang==='ar'?'ar-SA':'en-US',text:lang==='ar'?'مرحبًا بك في منصة إتش إس إيه فور ستدي.':'Welcome to HSA 4 Study. Learn at your own pace.'}],speed,()=>{},()=>{if(run.current===token){setVoiceChecks(v=>({...v,[key]:'passed'}));setPreviewVoiceId('');notifyUser('اكتملت تجربة الصوت.','success');}},msg=>{if(run.current===token){setVoiceChecks(v=>({...v,[key]:'failed'}));setPreviewVoiceId('');setError(msg)}},{[lang]:id},undefined,volume);};
 const changeSelectionMode=mode=>{clearChoice();selectionModeRef.current=mode==='multi';setParagraphSelect(mode==='multi');if(mode==='multi')setCenterTab('queue');};
 const addMark=()=>{const spans=selectedSpans();if(!spans.length)return;saveMarks([...marks,normalizedMark({id:crypto.randomUUID(),page:pageNo,spans,color:markColor,type:markType,note:markNote,createdAt:Date.now()})]);clearChoice();setNotice('حُفظ التحديد.');};
 const clearChoice=()=>{setWord(null);selectedRange.current=[];setChosen([]);setSelection(false);setEditingMark(null);setMarkNote('');setShowTranslation(false);setShowExplanation(false);window.getSelection()?.removeAllRanges();};
 const editMark=m=>{setWord(null);stop();selectionModeRef.current=false;setParagraphSelect(false);setEditingMark(m.id);setMarkColor(m.color);setMarkType(m.type);setMarkNote(m.note);setEditMode('replace');selectedRange.current=m.spans;setChosen(m.spans);setSelection(true);setShowTranslation(false);setShowExplanation(false);};
 const focusAnnotation=m=>{setPanel('selection');const first=m.spans[0];requestAnimationFrame(()=>{const el=divs.current[first?.index];(el||wrap.current)?.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'})});};
 const locateAnnotation=(m,tab='saved')=>{
  if(m.page!==pageNo||rendering||readyPage.current!==pageNo){pendingMarkRef.current={id:annotationId(m),tab,page:m.page};go(m.page);return;}
  if(tab==='saved')editMark(m);
  else{stop();selectionModeRef.current=false;setParagraphSelect(false);setEditingMark(null);setMarkNote('');setShowTranslation(false);setShowExplanation(false);selectedRange.current=m.spans;setChosen(m.spans);setSelection(true);}
  focusAnnotation(m);
 };
 useEffect(()=>{const pending=pendingMarkRef.current;if(!pending||rendering||readyPage.current!==pageNo||pending.page!==pageNo)return;const m=(pending.tab==='saved'?marks:queue).find(x=>annotationId(x)===pending.id);pendingMarkRef.current=null;if(m)locateAnnotation(m,pending.tab);},[pageNo,rendering,marks,queue]);
 const updateMark=()=>{const old=marks.find(m=>m.id===editingMark&&m.page===pageNo);if(!old)return;const spans=changeMarkRanges(old.spans,selectedRange.current,pageSpans,editMode);if(!spans.length){saveMarks(marks.filter(m=>m.id!==old.id));}else saveMarks(marks.map(m=>m.id===old.id?normalizedMark({...m,spans,color:markColor,type:markType,note:markNote,updatedAt:Date.now()}):m));clearChoice();setNotice('حُفظ التعديل.');};
 const chooseParagraph=e=>{if(playing||rendering)return;if(!paragraphSelect){const sel=window.getSelection();if(sel&&!sel.isCollapsed)return;const point=document.caretPositionFromPoint?.(e.clientX,e.clientY);const legacy=!point?document.caretRangeFromPoint?.(e.clientX,e.clientY):null;const node=point?.offsetNode||legacy?.startContainer;const index=divs.current.findIndex(d=>node&&d.contains(node));if(index>=0){const prefix=document.createRange();prefix.selectNodeContents(divs.current[index]);prefix.setEnd(node,point?.offset??legacy.startOffset);const offset=prefix.toString().length;const mark=marks.find(m=>m.page===pageNo&&m.spans.some(r=>r.index===index&&r.start<=offset&&offset<r.end));if(mark){editMark(mark);return;}const ranges=documentWordAt(pageSpansRef.current,index,offset);if(ranges.length){clearChoice();selectedRange.current=ranges;setChosen(ranges);setSelection(true);setWord({text:ranges[0].text,ranges});}}return;}const index=divs.current.findIndex(d=>d===e.target||d.contains(e.target));if(index<0)return;let offset=null;const point=document.caretPositionFromPoint?.(e.clientX,e.clientY);const legacy=!point?document.caretRangeFromPoint?.(e.clientX,e.clientY):null;const node=point?.offsetNode||legacy?.startContainer;if(node&&divs.current[index].contains(node)){const prefix=document.createRange();prefix.selectNodeContents(divs.current[index]);prefix.setEnd(node,point?.offset??legacy.startOffset);offset=prefix.toString().length;}const unit=units.find(u=>u.ranges.some(r=>r.index===index&&(offset===null||r.start<=offset&&offset<r.end)))||units.find(u=>u.ranges.some(r=>r.index===index));if(!unit)return;saveQueue(toggleParagraphSelection(queue,pageNo,unit));window.getSelection()?.removeAllRanges();};
 const addChoiceToQueue=()=>{const full=exactUnits;let next=[...queue];for(const u of full){const key=u.partial?u.ranges.map(r=>r.index+':'+r.start+':'+r.end).join('|'):documentUnitKey(u);if(!next.some(x=>x.page===pageNo&&x.key===key))next.push({page:pageNo,key,spans:u.ranges});}saveQueue(next);clearChoice();};
 const expandChoice=()=>{const ranges=mergeDocumentRanges(chosenUnits.flatMap(u=>u.ranges),pageSpans);selectedRange.current=ranges;setChosen(ranges);setSelection(!!ranges.length);window.getSelection()?.removeAllRanges();};
 const speakExplanation=()=>{stop();setReadScope('explain');setError('');if(navigator.onLine===false){setError('الشرح الصوتي يتطلب الإنترنت.');return;}const plan=selectionExplanationPlan(chosenUnits,sections,track);if(plan.missing){setShowExplanation(true);setError('الشرح بهذه اللغة غير متاح لبعض الفقرات المحددة.');return;}const id=++run.current;setPlaying(true);setAudioStarting(true);setShowExplanation(true);cancelSpeech.current=speakParts(plan.parts,speed,()=>setAudioStarting(false),()=>{if(run.current===id)stop()},msg=>{if(run.current===id){stop();setError(msg)}},voices,({index,lang})=>{if(run.current===id){setActive(plan.parts[index]?.ranges||[]);setSpoken({lang,explanation:true});}},volume);};
 const go=n=>{if(!pdf)return;stop();const target=Math.max(1,Math.min(pdf.numPages,Math.trunc(Number(n)||pageNo)));setPageNo(target);setPageInput(String(target));requestAnimationFrame(()=>{if(wrap.current){wrap.current.scrollTop=0;wrap.current.scrollLeft=0;}});};
 useEffect(()=>{setPageInput(String(pageNo));},[pageNo]);
 const locateSearch=hit=>{if(hit.kind==='mark'){locateAnnotation(hit.mark,hit.mark.id?'saved':'queue');return;}stop();setPanel('search');setFocusPanel(true);if(hit.page!==pageNo||readyPage.current!==pageNo){pendingSearch.current=hit;go(hit.page);return;}applySearch(hit);};
 const applySearch=hit=>{const spans=pageSpansRef.current;const ranges=hit.kind==='original'?documentSearchRanges(spans,hit.query,hit.mode).flat():buildDocumentUnits(spans,pageSections).filter(u=>u.sectionId===hit.sectionId).flatMap(u=>u.ranges);setSearchRanges(ranges);if(ranges.length)requestAnimationFrame(()=>{const el=divs.current[ranges[0].index],viewport=wrap.current;if(el&&viewport)viewport.scrollBy({top:el.getBoundingClientRect().top-viewport.getBoundingClientRect().top-viewport.clientHeight*.25,behavior:'smooth'})});else notifyUser('تم فتح الصفحة، ولم يمكن تحديد موضع النص بدقة.','info');};
 useEffect(()=>{const hit=pendingSearch.current;if(hit&&hit.page===pageNo&&!rendering&&readyPage.current===pageNo){pendingSearch.current=null;applySearch(hit)}},[pageNo,rendering,pageSpans]);
 const jumpPage=()=>{const n=playbackPage(pageInput,pdf.numPages,pageNo);setPageInput(String(n));if(n!==pageNo)go(n)};
 const read=(mode,spans=null,single=null,language=track)=>{
  if(!pdf)return;
  stop();setError('');setNotice('');
  if(navigator.onLine===false){setError('القراءة الصوتية تتطلب الإنترنت.');return;}
  const selected=Array.isArray(single)?single:mode==='queue'?(single?[single]:[...queue]):single?[single]:[...marks];
  if((mode==='selection'&&!spans?.length)||(['marks','queue'].includes(mode)&&!selected.length)){setError('حدد النص المراد قراءته أولًا.');return;}
  const id=++run.current,point=progressRef.current.tracks?.[language];
  const first=mode==='all'?1:mode==='resume'?point?.lastPage||pageNo:['marks','queue'].includes(mode)?Math.min(...selected.map(m=>m.page)):pageNo;
  const j={id,mode,spans,track:language,skipped:0,incomplete:0,marks:selected,resume:mode==='resume'?point:null,page:playbackPage(first,pdf.numPages,pageNo),started:null};
  job.current=j;setReadScope(mode);setPlaying(true);setPaused(false);setAudioStarting(true);
  // Start immediately in the user gesture whenever this page is already rendered.
  if(j.page===pageNo&&readyPage.current===pageNo&&!rendering)startPage(j);
  else{setPageNo(j.page);requestAnimationFrame(()=>{if(wrap.current)wrap.current.scrollTop=0;});}
 };
 const startPage=async j=>{
  if(run.current!==j.id||j.started===pageNo||readyPage.current!==pageNo)return;
  j.started=pageNo;
  const pageUnits=buildDocumentUnits(pageSpansRef.current,pageSections);
  const picked=j.mode==='selection'?j.spans:['marks','queue'].includes(j.mode)?mergeDocumentRanges(j.marks.filter(m=>m.page===pageNo).flatMap(m=>m.spans),pageSpansRef.current):null;
  let target=pageUnits;
  if(picked){
   const matching=pageUnits.filter(u=>unitIntersects(u,picked));
   target=selectedDocumentUnits(matching,picked,pageSpansRef.current);
   if(j.track!=='en'&&target.some(u=>u.native!=='ar'&&!u.translation)){
    setNotice('جارٍ تجهيز ترجمة النص المحدد…');
    try{target=await resolveSelectionTranslations(target,translateExact,translationCache.current);if(run.current!==j.id)return;setNotice('');}
    catch(e){if(run.current===j.id){stop();setError(e?.message||'تعذّرت ترجمة النص المحدد.');}return;}
   }
  }
  if(j.mode==='resume'&&j.resume?.lastPage===pageNo&&j.resume.lastUnit){
   const index=target.findIndex(u=>documentUnitKey(u)===j.resume.lastUnit);
   if(index>=0)target=target.slice(index+(j.resume.units?.[pageNo]?.includes(j.resume.lastUnit)?1:0));
  }
  const trackProgress=['all','resume','page','queue'].includes(j.mode);
  const advance=()=>{
   if(run.current!==j.id)return;
   const completed=progressRef.current.tracks?.[j.track]?.units?.[pageNo]||[];
   if(trackProgress&&pageUnits.length&&pageUnits.every(u=>completed.includes(documentUnitKey(u))))saveProgress(recordDocumentProgress(progressRef.current,j.track,pageNo,null,true));
   const next=['all','resume'].includes(j.mode)&&pageNo<pdf.numPages?pageNo+1:['marks','queue'].includes(j.mode)?j.marks.map(m=>m.page).filter(n=>n>pageNo).sort((a,b)=>a-b)[0]:null;
   setActive(null);setSpoken(null);
   if(next){j.page=next;j.started=null;setAudioStarting(true);setPageNo(next);requestAnimationFrame(()=>{if(wrap.current)wrap.current.scrollTop=0;});}
   else{stop();setNotice(j.incomplete||j.skipped?'انتهت قراءة النص المتاح. '+(j.incomplete?'فقرات غير مكتملة لهذا المسار: '+j.incomplete+'. ':'')+(j.skipped?'صفحات بلا نص: '+j.skipped+'.':''):'اكتملت القراءة.');}
  };
  if(!target.length){
   if(!pageUnits.length)j.skipped++;
   if(['all','resume','marks','queue'].includes(j.mode)){advance();return;}
   stop();setError('لا يوجد نص قابل للقراءة في هذا التحديد أو الصفحة.');return;
  }
  const plan=wordPlaybackPlan(target,j.track);
  j.incomplete+=plan.incomplete.length;
  if(plan.incomplete.length)setNotice(j.track==='mixed'?'تُقرأ الإنجليزية عند غياب الترجمة العربية، ويستمر الاستماع.':'تُتجاوز الفقرات غير المتاحة باللغة المختارة.');
  if(!plan.parts.length){
   if(['all','resume','marks','queue'].includes(j.mode)){advance();return;}
   stop();setError('لا يوجد نص جاهز بهذه اللغة في الجزء المختار. اختر الإنجليزية أو أكمل الترجمة.');return;
  }
  let previous=-1;
  const completePrevious=()=>{
   const last=plan.parts[previous];
   if(trackProgress&&last?.completesUnit&&!last.unit.partial)saveProgress(recordDocumentProgress(progressRef.current,j.track,pageNo,last.unitKey,true));
  };
  // A single speech queue for the page avoids repeated synth.cancel() between paragraphs.
  cancelSpeech.current=speakParts(plan.parts,speed,()=>setAudioStarting(false),()=>{
   if(run.current!==j.id)return;completePrevious();advance();
  },msg=>{if(run.current===j.id){stop();setError(msg)}},voices,
   ({index,lang})=>{
    if(run.current!==j.id)return;
    completePrevious();previous=index;const part=plan.parts[index];if(!part)return;
    if(trackProgress&&!part.unit.partial)saveProgress(recordDocumentProgress(progressRef.current,j.track,pageNo,part.unitKey));
    setAudioStarting(false);setActive(documentPartHighlight(part));setSpoken({lang,translated:part.translated,translation:part.unit.translation,sectionId:part.unit.sectionId,reviewed:part.unit.reviewed});
   },volume,({index,charIndex,charLength,name})=>{
    if(run.current===j.id&&(name==='word'||!name))setActive(documentPartHighlight(plan.parts[index],charIndex,charLength));
   });
 };
 useEffect(()=>{
  const j=job.current;
  if(!j||!playing||paused||rendering||!pdf||j.page!==pageNo||readyPage.current!==pageNo||j.started===pageNo)return;
  startPage(j);
 },[playing,paused,rendering,pageNo,pdf,pageSpans,pageSections]);
 useEffect(()=>{
  if(!playing||!followAudio||!active?.length)return;
  const el=sheet.current?.querySelector('.document-reading-mark');
  if(!el)return;const rect=el.getBoundingClientRect();
  const viewport=wrap.current?.getBoundingClientRect();if(viewport&&(rect.top<viewport.top+24||rect.bottom>viewport.bottom-24)){wrap.current.scrollBy({top:rect.top-viewport.top-viewport.height*.38,behavior:'smooth'});}
 },[active,playing,followAudio]);
 const playAnnotations=(tab,mode,id=null)=>{const items=tab==='queue'?queue:marks;const selected=annotationPlayback(items,mode,tab==='queue'?checkedQueue:checkedMarks,id);if(!selected.length){setError('اختر تحديدًا واحدًا على الأقل.');return;}read(tab==='queue'?'queue':'marks',null,selected);};
 const saveQueueAsMarks=()=>{const existing=new Set(marks.map(m=>m.page+':'+m.spans.map(r=>r.index+':'+r.start+':'+r.end).join('|')));const additions=queue.filter(m=>!existing.has(m.page+':'+m.spans.map(r=>r.index+':'+r.start+':'+r.end).join('|'))).map(m=>normalizedMark({id:crypto.randomUUID(),page:m.page,spans:m.spans,color:markColor,type:markType,note:'',createdAt:Date.now()}));if(additions.length)saveMarks([...marks,...additions]);setNotice(additions.length?'حُفظت '+additions.length+' تحديدات.':'التحديدات محفوظة مسبقًا.');setCenterTab('saved');};
 const chooseLocal=async e=>{if(!isAdmin)return;const file=e.target.files?.[0];e.target.value='';if(!file)return;stop();
  if(file.size>30*1024*1024||!(await file.slice(0,1024).text()).includes('%PDF-')){setError('اختر ملف PDF صالحًا لا يتجاوز 30 ميجابايت.');return;}
  setLocal(true);setBlob(file);setSaved(await saveOfflineDocument(userId||'device','local:'+lesson.id,file).then(()=>true,()=>false));
 };
 const publish=async()=>{const next=!access?.published;stop();if(next&&!window.confirm('ستتاح نسخة PDF عند نشر المنهج. هل تريد المتابعة؟'))return;
  try{await publishStudyDocument(lesson,next,access.path);setReload(v=>v+1);}catch(e){setError('تعذّر تحديث إتاحة المستند.');}};
 const attach=async e=>{if(!isAdmin)return;const file=e.target.files?.[0];e.target.value='';if(!file)return;stop();setAttaching(true);setError('');try{await attachStudyPdf(lesson,userId,file);setReload(v=>v+1);}catch(e){setError(e?.message||'تعذّر إرفاق المستند.')}finally{setAttaching(false)}};
 const download=()=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=local?'منهج.pdf':lesson.source_filename||'منهج.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
 return <section className="document-reader document-studio" ref={workspace}>
  <header className="document-reader-head"><div><h2><BookOpen size={20}/> المنهج الأصلي</h2><small>{saved?'محفوظ للعرض دون إنترنت':'عرض الصفحات كما وردت في الملف'}</small></div>
   <div className="document-reader-actions">
    {isAdmin&&access?.path&&<button className="outline-btn" onClick={publish} disabled={navigator.onLine===false||loading}>{access.published?'إخفاء نسخة PDF':'إتاحة نسخة PDF للزوار'}</button>}
    {isAdmin&&access&&!access.path&&<label className="outline-btn">{attaching?<HsaLoader size={18}/>:<Upload size={16}/>} إرفاق PDF للدرس<input hidden disabled={attaching||navigator.onLine===false} type="file" accept="application/pdf,.pdf" onChange={attach}/></label>}
    {isAdmin&&<label className="outline-btn"><Upload size={16}/> معاينة PDF من جهازي<input hidden type="file" accept="application/pdf,.pdf" onChange={chooseLocal}/></label>}
    {isAdmin&&blob&&<button className="outline-btn" onClick={download}><Download size={16}/> تنزيل PDF</button>}

   </div>
  </header>
  {error&&!pdf&&!loading&&<button className="outline-btn" onClick={()=>{stop();setReload(v=>v+1)}}>إعادة فتح المستند</button>}
  {loading&&<div className="accounts-empty hsa-loading-stack" role="status"><HsaLoader size={64}/> جارٍ فتح المستند…</div>}
  {!loading&&!pdf&&!error&&<div className="accounts-empty hsa-loading-stack"><BookOpen size={30}/><p>لا توجد نسخة PDF متاحة لهذا الدرس. يمكنك فتح الشرح أو انتظار إتاحة الملف من المشرف.</p></div>}

  {pdf&&<>
   <div className="studio-toolbar">
    <div className="studio-toolgroup"><button className="studio-tool" aria-pressed={panel==='search'} onClick={()=>showPanel('search')}><Search size={17}/><span>بحث متقدم</span></button><button className="studio-tool" aria-pressed={panel==='pages'} onClick={()=>showPanel('pages')} title="الصفحات"><FileText size={17}/><span>الصفحات</span></button><button className="studio-tool" aria-pressed={!paragraphSelect} disabled={playing} onClick={()=>changeSelectionMode('normal')}><Pencil size={16}/><span>تحديد</span></button><button className="studio-tool" aria-pressed={paragraphSelect} disabled={playing} onClick={()=>{changeSelectionMode('multi');openCenter('queue')}}><Highlighter size={17}/><span>متعدد</span></button><button className="studio-tool" aria-pressed={panel==='marks'} onClick={()=>openCenter('saved')}><MessageSquare size={17}/><span>التحديدات ({marks.length+queue.length})</span></button></div>
    <div className="studio-toolgroup"><button className="studio-tool" disabled={playing} title="تصغير" aria-label="تصغير" onClick={()=>{stop();setZoom(z=>Math.max(.7,z-.15))}}>−</button><button className="studio-tool" disabled={playing} onClick={()=>{stop();setZoom(1)}} title="ملاءمة العرض">{Math.round(zoom*100)}%</button><button className="studio-tool" disabled={playing} title="تكبير" aria-label="تكبير" onClick={()=>{stop();setZoom(z=>Math.min(2.5,z+.15))}}>+</button><button className="studio-tool" aria-pressed={focusMode} onClick={()=>{stop();setFocusPanel(false);setFocusMode(v=>!v)}} title="وضع التركيز">{focusMode?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button><button className="studio-tool" aria-pressed={panel==='settings'} onClick={()=>showPanel('settings')} title="إعدادات الصوت"><Settings2 size={17}/></button></div>
   </div>
   

   <div className={'studio-workspace'+(focusMode?' studio-focus'+(focusPanel?' studio-focus-panel':''):'')}>
    <main className="studio-document-area">   <div className="document-sheet-wrap" ref={wrap} tabIndex={0} onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='ArrowLeft'||e.key==='PageDown'){e.preventDefault();go(pageNo+1)}if(e.key==='ArrowRight'||e.key==='PageUp'){e.preventDefault();go(pageNo-1)}}}>
    {rendering&&<div className="document-page-loading"><HsaLoader size={48}/></div>}
    <div className="document-sheet" ref={sheet}><canvas ref={canvas}/><div className="document-highlights" aria-hidden="true"/><div className={'textLayer'+(paragraphSelect?' document-paragraph-mode':'')} ref={layer} onClick={chooseParagraph}/></div>
   </div>
   <div className="document-reader-dock" aria-label="التنقل ومشغل المنهج">
    {chosen.length>0&&<div className="studio-selection-shortcut"><button className="outline-btn" onClick={()=>showPanel('selection')}><Languages size={15}/> أدوات المحدد</button><button className="outline-btn" disabled={playing||rendering} onMouseDown={e=>e.preventDefault()} onClick={()=>read('selection',selectedSpans())}><Play size={15}/> قراءة المحدد</button></div>}
    {paragraphSelect&&<div className="studio-selection-shortcut"><small>اضغط على الفقرات لاختيارها · {queue.length} محدد</small><button className="outline-btn" onClick={()=>openCenter('queue')}>القائمة</button></div>}
    <div className="document-dock-navigation">
     <button className="icon-btn" title="أول صفحة" aria-label="أول صفحة" disabled={pageNo<=1} onClick={()=>go(1)}>«</button>
     <button className="outline-btn" disabled={pageNo<=1} onClick={()=>go(pageNo-1)}><ChevronRight size={17}/> السابقة</button>
     <form onSubmit={e=>{e.preventDefault();jumpPage()}}><input aria-label="رقم الصفحة" type="number" min="1" max={pdf.numPages} value={pageInput} onChange={e=>setPageInput(e.target.value)}/><span>/ {pdf.numPages}</span><button className="outline-btn" type="submit">انتقال</button></form>
     <button className="outline-btn" disabled={pageNo>=pdf.numPages} onClick={()=>go(pageNo+1)}>التالية <ChevronLeft size={17}/></button>
     <button className="icon-btn" title="آخر صفحة" aria-label="آخر صفحة" disabled={pageNo>=pdf.numPages} onClick={()=>go(pdf.numPages)}>»</button>
    </div>
    <div className="document-dock-audio">
     <select aria-label="لغة الاستماع" value={track} onChange={e=>{stop();setTrack(e.target.value);setError('');try{localStorage.setItem('hsa-document-track',e.target.value)}catch{}}}><option value="mixed">إنجليزي ثم عربي</option><option value="en">الإنجليزية فقط</option><option value="ar">العربية فقط</option></select>
     <select aria-label="نطاق الاستماع" value={readScope==='explain'||readScope==='selection'&&!chosen.length?'page':readScope} disabled={playing} onChange={e=>setReadScope(e.target.value)}><option value="page">هذه الصفحة</option><option value="all">المنهج كاملًا</option><option value="selection" disabled={!chosen.length}>النص المحدد</option><option value="queue" disabled={!queue.length}>قائمة القراءة</option><option value="marks" disabled={!marks.length}>التحديدات</option><option value="resume" disabled={!progress.tracks?.[track]?.lastPage}>آخر موضع</option></select>
     {playing?<><button className="primary-btn" disabled={audioStarting} onClick={()=>{if(paused){resumeSpeech();setPaused(false)}else{pauseSpeech();setPaused(true)}}}>{audioStarting?<HsaLoader size={20}/>:paused?<Play size={18}/>:<Pause size={18}/>} {audioStarting?'جارٍ التجهيز':paused?'متابعة':'إيقاف مؤقت'}</button><button className="outline-btn" onClick={stop}><Square size={15}/> إيقاف</button></>:<button className="primary-btn" disabled={rendering} onClick={()=>{const mode=readScope==='explain'||readScope==='selection'&&!chosen.length?'page':readScope;read(mode,mode==='selection'?selectedSpans():null)}}><Play size={17}/> استماع</button>}
     <label className="document-follow-audio"><input type="checkbox" checked={followAudio} onChange={e=>setFollowAudio(e.target.checked)}/> متابعة النص</label>
    </div>
    {spoken&&<div className="document-dock-status">{spoken.lang==='ar-SA'?'العربية':'الإنجليزية'}</div>}
   </div>
</main>
    <aside className="studio-panel" aria-label="أدوات المذاكرة">
 {focusMode&&<button className="studio-close-panel outline-btn" onClick={()=>setFocusPanel(false)}>إغلاق اللوحة</button>}<div className="studio-panel-tabs" role="group" aria-label="لوحة الأدوات">{[['pages','الصفحات'],['selection','المحدد'],['marks','التحديدات'],['settings','الإعدادات']].map(([id,label])=><button key={id} className={panel===id?'is-active':''} aria-pressed={panel===id} onClick={()=>showPanel(id)}>{label}</button>)}</div>
 <div className="studio-panel-scroll">
  {panel==='search'&&<DocumentAdvancedSearch pdf={pdf} sections={sections} marks={[...marks,...queue]} pageNo={pageNo} onLocate={locateSearch} onClose={()=>{setSearchRanges([]);setPanel('pages')}}/>}
  {panel==='pages'&&<DocumentPageNavigator pdf={pdf} pageNo={pageNo} onPage={go} completed={progress.tracks?.[track]?.pages||[]} marks={[...marks,...queue]}/>}
  <div hidden={panel!=='selection'}>   {word&&<div className="document-word-menu" role="group" aria-label="استماع إلى الكلمة المحددة"><div><strong dir="auto">{word.text}</strong><button className="icon-btn" aria-label="إغلاق قائمة الكلمة" onClick={clearChoice}>×</button></div><div className="document-word-options">{[['ar-first','عربي ثم إنجليزي'],['mixed','إنجليزي ثم عربي'],['en','إنجليزي فقط'],['ar','عربي فقط']].map(([id,label])=><button key={id} className="outline-btn" disabled={playing||rendering} onMouseDown={e=>e.preventDefault()} onClick={()=>read('selection',word.ranges,null,id)}><Play size={14}/> {label}</button>)}<button className="outline-btn" onClick={requestSelectionTranslation}><Languages size={14}/> معنى الكلمة</button></div></div>}
   {!!chosen.length&&<div className="document-selection-panel" id="document-selection-details">
    <div><strong>{editingMark?'تعديل التحديد':'النص المحدد'}</strong><button className="icon-btn" onClick={clearChoice} aria-label="إلغاء التحديد">×</button></div>
    <p dir="auto">{exactChosen.map(r=>r.text).join(' ')}</p>
    <div className="document-selection-actions">
      <button className="outline-btn" disabled={playing} onClick={()=>showTranslation?setShowTranslation(false):requestSelectionTranslation()}><Languages size={16}/> {showTranslation?'إخفاء الترجمة':'إظهار الترجمة'}</button>
      <button className="outline-btn" disabled={playing} onClick={()=>read('selection',selectedSpans())}><Play size={15}/> قراءة المحدد</button>
      <button className="outline-btn" disabled={playing||!chosenUnits.length} onClick={speakExplanation}><Play size={15}/> الشرح الصوتي</button>
      <button className="outline-btn" onClick={()=>setShowExplanation(v=>!v)}><BookOpen size={15}/> {showExplanation?'إخفاء الشرح':'إظهار الشرح'}</button>
      <button className="outline-btn" disabled={playing||!chosenUnits.length} onClick={addChoiceToQueue}>إضافة لقائمة القراءة</button>
      <button className="outline-btn" onClick={expandChoice} disabled={playing||!chosenUnits.length||sameDocumentRanges(mergeDocumentRanges(chosenUnits.flatMap(u=>u.ranges),pageSpans),exactChosen)}>توسيع إلى الفقرات كاملة</button>
      {chosenUnits.length===1&&chosenUnits[0].sectionId&&<button className="outline-btn" onClick={()=>{stop();onExplain?.(chosenUnits[0].sectionId)}}>فتح صفحة الشرح</button>}
    </div>
    {showTranslation&&<div className="document-translation-caption" dir="rtl"><strong>ترجمة النص المحدد</strong>
     {selectionResult.key===selectionSignature&&selectionResult.status==='loading'&&<p role="status"><HsaLoader size={22}/> جارٍ ترجمة المحدد…</p>}
     {selectionResult.key===selectionSignature&&selectionResult.status==='ready'&&selectionResult.units.map((u,i)=><div key={i}><small dir="auto">{u.source}</small><p>{u.native==='ar'?u.source:u.translation}</p>{u.native!=='ar'&&!u.reviewed&&<small>{u.translationMethod==='glossary'?'معنى قاموسي؛ قد يختلف حسب السياق':u.translationMethod==='saved'?'ترجمة محفوظة':'ترجمة آلية أولية'}</small>}</div>)}
     {selectionResult.key===selectionSignature&&selectionResult.status==='error'&&<button className="outline-btn" onClick={requestSelectionTranslation}>إعادة الترجمة</button>}
    </div>}
    {showExplanation&&<div className="document-translation-caption"><strong>شرح الفقرات المحددة</strong>{chosenUnits.map((u,i)=>{const row=sections.find(x=>x.id===u.sectionId);return <div key={i}>{track!=='ar'&&<p dir="ltr">{row?.explanation_en||'English explanation is not available.'}</p>}{track!=='en'&&<p dir="rtl">{row?.explanation_ar||'الشرح العربي غير متاح بعد.'}</p>}</div>})}</div>}
    <div className="document-annotation-editor"><label><MessageSquare size={15}/> ملاحظة<textarea rows={2} maxLength={2500} value={markNote} onChange={e=>setMarkNote(e.target.value)} placeholder="اكتب ملاحظة لهذا التحديد (اختياري)"/></label>
     {editingMark&&<label>تعديل النطاق<select value={editMode} onChange={e=>setEditMode(e.target.value)}><option value="replace">استبدال النطاق</option><option value="add">إضافة الكلمات المحددة</option><option value="subtract">إزالة الكلمات المحددة</option></select></label>}
     {editingMark&&<small>حدد الكلمات الجديدة من الصفحة، ثم اختر الإضافة أو الإزالة أو الاستبدال واحفظ التعديل.</small>}
     <div className="document-selection-actions"><button className="primary-btn" disabled={playing} onClick={editingMark?updateMark:addMark}>{editingMark?'حفظ التعديل':'حفظ التحديد'}</button>
     {editingMark&&<button className="outline-btn danger-btn" disabled={playing} onClick={()=>{saveMarks(marks.filter(m=>m.id!==editingMark));clearChoice()}}><Trash2 size={15}/> حذف التحديد</button>}</div>
    </div>
   </div>}
<div className="document-annotation-tools"><strong>التظليل</strong><div className="document-color-palette" role="group" aria-label="لون التحديد">{Object.entries(MARK_COLORS).map(([id,color])=><button key={id} type="button" style={{background:color}} aria-label={'لون '+({yellow:'أصفر',green:'أخضر',blue:'أزرق',pink:'وردي',purple:'بنفسجي',orange:'برتقالي'}[id])} aria-pressed={markColor===id} className={markColor===id?'selected':''} onClick={()=>setMarkColor(id)}/>)}</div><label>التصنيف <select value={markType} onChange={e=>setMarkType(e.target.value)}>{Object.entries(MARK_TYPES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button className="icon-btn" aria-label="تراجع" title="تراجع" disabled={!history.length||playing} onClick={undoMark}><Undo2 size={18}/></button><button className="icon-btn" aria-label="إعادة" title="إعادة" disabled={!future.length||playing} onClick={redoMark}><Redo2 size={18}/></button></div>{!chosen.length&&<p className="studio-empty">اضغط على كلمة أو اسحب فوق النص لعرض أدوات القراءة والترجمة والتظليل.</p>}</div>
  <div hidden={panel!=='marks'}>   <div ref={centerRef} className="document-annotation-center-wrap">
    <DocumentAnnotationCenter open={centerOpen} onToggle={()=>setCenterOpen(v=>!v)} tab={centerTab} setTab={setCenterTab} marks={marks} queue={queue} pageNo={pageNo} track={track} playing={playing||rendering} checked={centerTab==='saved'?checkedMarks:checkedQueue} onChecked={centerTab==='saved'?setCheckedMarks:setCheckedQueue}
      onPlay={(mode,id)=>playAnnotations(centerTab,mode,id)} onLocate={item=>locateAnnotation(item,centerTab)}
      onRemove={item=>{if(centerTab==='saved'){saveMarks(marks.filter(x=>x.id!==item.id));if(editingMark===item.id)clearChoice();}else saveQueue(queue.filter(x=>annotationId(x)!==annotationId(item)))}} onSaveQueue={saveQueueAsMarks} />
   </div>
</div>
  <div hidden={panel!=='settings'}><div className="studio-voice-panel"><h3><Headphones size={17}/> إعدادات الاستماع</h3><p className="subtle">اختر صوتًا متاحًا وجرّبه قبل الدراسة.</p><label>سرعة القراءة <select disabled={playing} value={speed} onChange={e=>onSpeedChange?.(Number(e.target.value))}>{[.75,.85,1,1.15,1.3,1.5,2].map(v=><option key={v} value={v}>{v}×</option>)}</select></label><label>مستوى الصوت <input type="range" min=".2" max="1" step=".1" value={volume} onChange={e=>{stop();onVolumeChange?.(Number(e.target.value))}}/></label>{['ar','en'].map(lang=>{const choices=['female','male','other'].flatMap(g=>voiceGroups?.[lang]?.[g]||[]).filter(v=>v?.id&&v.localService===false);return <section key={lang}><strong>{lang==='ar'?'الأصوات العربية':'الأصوات الإنجليزية'}</strong>{!choices.length&&<button className="outline-btn" onClick={()=>notifyUser('لا يوجد صوت متاح لهذه اللغة على جهازك.','warning')}>التحقق من الأصوات</button>}{choices.map(v=>{const key=lang+':'+v.id;return <div className="studio-voice-row" key={key}><button className="studio-voice-name" aria-pressed={voices?.[lang]===v.id} disabled={playing} onClick={()=>{stop();onVoiceChange?.(lang,v.id)}}>{v.label||v.id}{voices?.[lang]===v.id&&<CheckCircle2 size={15}/>}</button><button className="icon-btn" disabled={playing} title="تجربة الصوت" aria-label={'تجربة '+(v.label||v.id)} onClick={()=>previewVoiceId===key?stop():previewSpeaker(lang,v.id)}>{previewVoiceId===key?<Square size={15}/>:<Play size={15}/>}</button></div>})}</section>})}<button className="outline-btn" disabled={playing} onClick={()=>{stop();setVoiceChecks({});onRefreshVoices?.()}}><RotateCcw size={15}/> تحديث الأصوات</button><small>الاستماع يحتاج إلى الإنترنت؛ توفر الأصوات يختلف بين الأجهزة.</small></div>   <div className="document-progress-card">
    <div><strong>تقدّم الاستماع</strong><span>{(progress.tracks?.[track]?.pages||[]).length} / {pdf.numPages} صفحة مكتملة</span></div>
    <progress max={pdf.numPages} value={(progress.tracks?.[track]?.pages||[]).length}/>
    <div><small>آخر موضع: صفحة {progress.tracks?.[track]?.lastPage||pageNo}</small><button className="outline-btn" disabled={playing||rendering||!progress.tracks?.[track]?.lastPage} onClick={()=>read('resume')}>متابعة القراءة</button></div>
    <small>{sections.length?sections.filter(s=>s.content_ar?.trim()).length+' / '+sections.length+' فقرة جاهزة بالعربية':'لا توجد ترجمة محفوظة'}</small>
    {sections.length>0&&<progress aria-label="اكتمال الترجمة" max={sections.length} value={sections.filter(s=>s.content_ar?.trim()).length}/>}
    {onTranslateMissing&&sections.some(s=>!s.content_ar?.trim())&&<button className="outline-btn" onClick={()=>{stop();onTranslateMissing()}}>إكمال الترجمة</button>}
   </div>
</div>
  {spoken&&<div className="studio-live-reading">{spoken&&<div className="document-speaking-strip" role="status"><strong>{spoken.lang==='ar-SA'?'العربية':'الإنجليزية'}</strong><span>{spoken.explanation?'شرح الفقرة':spoken.translated?'ترجمة الفقرة المحددة':'قراءة النص الأصلي'}</span></div>}
{spoken?.translated&&<div className="document-translation-caption" dir="rtl"><small>الترجمة العربية{spoken.reviewed?'':' · ترجمة أولية'}</small><p>{spoken.translation}</p></div>}
</div>}
 </div>
 </aside>
   </div>
   {focusMode&&<button className="studio-exit-focus outline-btn" onClick={()=>{stop();setFocusMode(false)}}>إنهاء التركيز</button>}
  </>}
 </section>
}
