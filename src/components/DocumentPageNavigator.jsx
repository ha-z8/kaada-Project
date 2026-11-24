import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,CheckCircle2} from 'lucide-react';
function Thumbnail({pdf,page}){
 const ref=useRef(null);
 useEffect(()=>{let alive=true,task;const canvas=ref.current;if(!canvas)return;const render=async()=>{try{const p=await pdf.getPage(page);if(!alive)return;const base=p.getViewport({scale:1}),viewport=p.getViewport({scale:105/base.width});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);task=p.render({canvas,viewport});await task.promise;}catch{}};render();return()=>{alive=false;task?.cancel()}},[pdf,page]);
 return <canvas ref={ref} aria-hidden="true"/>;
}
const WINDOW=12;
export default function DocumentPageNavigator({pdf,pageNo,onPage,completed=[],marks=[]}){
 const [group,setGroup]=useState(Math.floor((pageNo-1)/WINDOW));
 useEffect(()=>setGroup(Math.floor((pageNo-1)/WINDOW)),[pageNo,pdf]);
 const max=Math.ceil(pdf.numPages/WINDOW)-1;
 return <div className="studio-pages"><div className="studio-pages-heading"><strong>صفحات المنهج</strong><small>{pdf.numPages} صفحة</small></div><div className="studio-page-group"><button className="icon-btn" disabled={group<=0} aria-label="الصفحات السابقة" onClick={()=>setGroup(g=>g-1)}><ChevronRight size={17}/></button><small>{group*WINDOW+1} – {Math.min(pdf.numPages,(group+1)*WINDOW)}</small><button className="icon-btn" disabled={group>=max} aria-label="الصفحات التالية" onClick={()=>setGroup(g=>g+1)}><ChevronLeft size={17}/></button></div><div className="studio-thumbnail-grid">{Array.from({length:Math.min(WINDOW,pdf.numPages-group*WINDOW)},(_,i)=>group*WINDOW+i+1).map(page=><button key={page} className={'studio-thumbnail'+(page===pageNo?' is-current':'')} aria-current={page===pageNo?'page':undefined} onClick={()=>onPage(page)}><Thumbnail pdf={pdf} page={page}/><span>{page}{completed.includes(page)&&<CheckCircle2 size={12}/>} {marks.some(m=>m.page===page)&&<i aria-label="تحديدات محفوظة"/>}</span></button>)}</div></div>;
}
