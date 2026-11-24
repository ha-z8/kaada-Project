import {useMemo,useState} from 'react';
import {Highlighter,Play,Trash2,MapPin,ListChecks,ChevronDown,ChevronUp} from 'lucide-react';
import {annotationId,orderedAnnotations,MARK_COLORS,MARK_TYPES} from '../lib/documentReader.js';
export default function DocumentAnnotationCenter({open,onToggle,tab,setTab,marks,queue,pageNo,track,playing,checked,onChecked,onPlay,onLocate,onRemove,onSaveQueue}){
 const [search,setSearch]=useState(''),[category,setCategory]=useState('all'),[pageFilter,setPageFilter]=useState('all');
 const items=tab==='saved'?marks:queue;
 const ordered=useMemo(()=>orderedAnnotations(items),[items]);
 const visible=ordered.filter(m=>(pageFilter==='all'||m.page===pageNo)&&(tab!=='saved'||category==='all'||m.type===category)&&(!search||[m.note,...m.spans.map(r=>r.text)].join(' ').toLowerCase().includes(search.toLowerCase())));
 const selected=ordered.filter(m=>checked.includes(annotationId(m)));
 const ids=visible.map(annotationId);
 const toggle=id=>onChecked(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const allVisible=ids.length>0&&ids.every(id=>checked.includes(id));
 return <section className="document-annotation-center" aria-label="مركز التحديدات">
 <div className="document-center-heading"><strong><Highlighter size={17}/> مركز التحديدات</strong><button className="outline-btn" aria-expanded={open} onClick={onToggle}>{marks.length} محفوظ · {queue.length} في القائمة {open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button></div>
 {open&&<>
 <div className="segmented" role="group" aria-label="عرض التحديدات"><button className={tab==='saved'?'is-active':''} aria-pressed={tab==='saved'} onClick={()=>setTab('saved')}>التحديدات المحفوظة ({marks.length})</button><button className={tab==='queue'?'is-active':''} aria-pressed={tab==='queue'} onClick={()=>setTab('queue')}>التحديد المتعدد ({queue.length})</button></div>
 <div className="document-center-filters"><input aria-label="بحث في التحديدات" value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث في النص أو الملاحظات"/><select aria-label="نطاق الصفحات" value={pageFilter} onChange={e=>setPageFilter(e.target.value)}><option value="all">جميع الصفحات</option><option value="current">الصفحة الحالية</option></select>{tab==='saved'&&<select aria-label="التصنيف" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">جميع التصنيفات</option>{Object.entries(MARK_TYPES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>}</div>
 <div className="document-center-actions">
 <button className="outline-btn" disabled={!ids.length||playing} onClick={()=>onChecked(old=>allVisible?old.filter(x=>!ids.includes(x)):[...new Set([...old,...ids])])}><ListChecks size={15}/> {allVisible?'إلغاء اختيار المعروض':'اختيار المعروض'}</button>
 <button className="primary-btn" disabled={!selected.length||playing} onClick={()=>onPlay('checked')}><Play size={15}/> قراءة المختار ({selected.length})</button>
 <button className="outline-btn" disabled={!ordered.length||playing} onClick={()=>onPlay('all')}><Play size={15}/> قراءة الكل</button>
 <button className="outline-btn" disabled={!selected.length||playing} onClick={()=>onChecked([])}>إلغاء الاختيارات</button>
 {tab==='queue'&&<button className="outline-btn" disabled={!queue.length||playing} onClick={onSaveQueue}>حفظ التحديدات</button>}
 </div>
 <small className="subtle">القراءة بترتيب الكتاب · {track==='mixed'?'إنجليزي ثم عربي':track==='ar'?'العربية':'الإنجليزية'} · الفلاتر لا تغيّر ترتيب القراءة من هنا للنهاية.</small>
 <div className="document-center-list">{visible.length===0&&<p className="subtle">لا توجد تحديدات مطابقة.</p>}{visible.map(m=>{const id=annotationId(m),i=ordered.findIndex(x=>annotationId(x)===id)+1;return <article key={id} className={'document-center-row'+(checked.includes(id)?' is-checked':'')}>
 <input type="checkbox" aria-label={'اختيار التحديد '+i} checked={checked.includes(id)} onChange={()=>toggle(id)} disabled={playing}/>
 <div><div className="document-center-row-title">{tab==='saved'&&<i className="document-mark-swatch" style={{background:MARK_COLORS[m.color]||MARK_COLORS.yellow,height:14}}/>}<strong>تحديد {i}</strong><small>صفحة {m.page}{tab==='saved'?' · '+(MARK_TYPES[m.type]||'عادي'):''}</small></div>
 <p dir="auto">{m.spans.map(r=>r.text).join(' ').slice(0,210)}</p>{m.note&&<p className="document-note-text" dir="auto">{m.note}</p>}
 <div className="document-center-row-actions"><button className="outline-btn" disabled={playing} onClick={()=>onLocate(m)}><MapPin size={14}/> الموقع{tab==='saved'?' والتعديل':''}</button><button className="outline-btn" disabled={playing} onClick={()=>onPlay('single',id)}><Play size={14}/> قراءة هذا فقط</button><button className="outline-btn" disabled={playing} onClick={()=>onPlay('from',id)}>من هنا للنهاية</button><button className="icon-btn" disabled={playing} aria-label={'حذف التحديد '+i} onClick={()=>{onChecked(old=>old.filter(x=>x!==id));onRemove(m)}}><Trash2 size={15}/></button></div></div>
 </article>})}</div>
 </>}
 </section>
}
