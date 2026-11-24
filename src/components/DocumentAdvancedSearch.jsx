import {useEffect,useRef,useState} from 'react';
import {Search,X,SlidersHorizontal} from 'lucide-react';
import {documentSearchRanges,searchSavedDocumentItems} from '../lib/documentSearch.js';
import {notifyUser} from '../lib/notifications.js';
import HsaLoader from './HsaLoader.jsx';
export default function DocumentAdvancedSearch({pdf,sections,marks,pageNo,onLocate,onClose}){
 const [query,setQuery]=useState(''),[field,setField]=useState('all'),[mode,setMode]=useState('phrase'),[scope,setScope]=useState('all'),[hits,setHits]=useState([]),[busy,setBusy]=useState(false),[more,setMore]=useState(30),[searched,setSearched]=useState(false);
 const generation=useRef(0),cache=useRef(new Map());
 useEffect(()=>()=>{generation.current++},[]);
 useEffect(()=>{generation.current++;cache.current.clear();setHits([]);setSearched(false);setBusy(false)},[pdf]);
 const search=async e=>{
  e?.preventDefault();if(!query.trim())return;const token=++generation.current;setBusy(true);setHits([]);setSearched(false);setMore(30);
  const page=scope==='current'?String(pageNo):'all';let failed=0;
  const result=searchSavedDocumentItems(marks,sections,query,mode,field,page);
  try{
   if(field==='all'||field==='original'){
    const first=scope==='current'?pageNo:1,last=scope==='current'?pageNo:pdf.numPages;
    for(let n=first;n<=last;n++){
     if(token!==generation.current)return;
     let spans=cache.current.get(n);
     if(!spans){try{const p=await pdf.getPage(n),data=await p.getTextContent();spans=data.items.filter(x=>typeof x.str==='string'&&x.str.trim()).map((x,index)=>({index,start:0,text:x.str}));cache.current.set(n,spans);}catch{failed++;continue;}}
     const ranges=documentSearchRanges(spans,query,mode);
     if(ranges.length){const firstRange=ranges[0][0],excerpt=spans.slice(Math.max(0,firstRange.index-1),firstRange.index+4).map(x=>x.text).join(' ');result.push({kind:'original',id:'pdf:'+n,page:n,text:excerpt,query,mode,count:ranges.length});}
    }
   }
   if(token!==generation.current)return;setHits(result.sort((a,b)=>a.page-b.page));setSearched(true);if(failed)notifyUser('تعذّر البحث في '+failed+' صفحة.','warning');if(!result.length)notifyUser('لا توجد نتائج مطابقة.','info');
  }catch(e){if(token===generation.current)notifyUser('تعذّر إكمال البحث.','error')}finally{if(token===generation.current)setBusy(false)}
 };
 const reset=()=>{generation.current++;setHits([]);setSearched(false);setBusy(false);};
 const labels={original:'الكتاب الأصلي',paragraph:'فقرة',translation:'الترجمة',explanation:'الشرح',mark:'تحديد محفوظ'};
 return <section className="studio-search-panel"><header><strong><Search size={17}/> بحث متقدم</strong><button className="icon-btn" aria-label="إغلاق البحث" onClick={onClose}><X size={16}/></button></header>
 <form onSubmit={search}><input type="search" autoFocus value={query} onChange={e=>{reset();setQuery(e.target.value)}} placeholder="كلمة، عبارة، تحديد أو ملاحظة" aria-label="بحث داخل المنهج"/>
 <details><summary><SlidersHorizontal size={14}/> خيارات البحث</summary><label>البحث في<select value={field} onChange={e=>{reset();setField(e.target.value)}}>{[['all','كل المحتوى'],['original','الكتاب الأصلي'],['paragraph','الفقرات'],['translation','الترجمة'],['explanation','الشرح'],['marks','التحديدات والملاحظات']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>المطابقة<select value={mode} onChange={e=>{reset();setMode(e.target.value)}}>{[['phrase','العبارة نفسها'],['word','كلمات كاملة'],['all','جميع الكلمات'],['any','أي كلمة']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>النطاق<select value={scope} onChange={e=>{reset();setScope(e.target.value)}}><option value="all">جميع الصفحات</option><option value="current">الصفحة الحالية</option></select></label></details>
 <button className="primary-btn" disabled={!query.trim()||busy} type="submit">{busy?<HsaLoader size={18}/>:<Search size={15}/>} بحث</button></form>
 {searched&&<small>{hits.length} نتيجة</small>}{hits.slice(0,more).map(hit=><button key={hit.id} className="studio-search-result" onClick={()=>onLocate(hit)}><small>صفحة {hit.page} · {labels[hit.kind]}{hit.count?' · '+hit.count+' تطابق':''}</small><span dir="auto">{hit.text.slice(0,220)}</span></button>)}{hits.length>more&&<button className="outline-btn" onClick={()=>setMore(v=>v+30)}>عرض المزيد</button>}
 </section>
}
