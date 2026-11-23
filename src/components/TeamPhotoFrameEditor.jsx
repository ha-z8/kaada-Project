import {useEffect,useRef,useState} from 'react';
import {ImageIcon,Maximize2,Minus,Plus,RotateCcw,Move} from 'lucide-react';
import {TeamAvatar} from './AboutPage.jsx';
import {AVATAR_FRAME_LIMITS,getAvatarFrame,avatarFrameProperties,panAvatarFrame,resizeAvatarFrame} from '../lib/avatarFrame.js';

const PREVIEW_SCALE=2.2;
function clamp(n,min,max){return Math.min(max,Math.max(min,n))}
export default function TeamPhotoFrameEditor({member,onUpdate,disabled=false}){
 const frame=getAvatarFrame(member);
 const [natural,setNatural]=useState(null);
 const pan=useRef(null);
 const resize=useRef(null);
 useEffect(()=>{setNatural(null);pan.current=null;resize.current=null},[member.avatarPath]);
 const change=(key,value)=>onUpdate(current=>({...current,[key]:value}));
 const zoomBy=delta=>onUpdate(current=>{
  const f=getAvatarFrame(current);
  return avatarFrameProperties({...f,zoom:clamp(f.zoom+delta,AVATAR_FRAME_LIMITS.zoom.min,AVATAR_FRAME_LIMITS.zoom.max)});
 });
 const beginPan=e=>{
  if(disabled||!natural||!member.avatarPath||e.button!==0)return;
  pan.current={id:e.pointerId,x:e.clientX,y:e.clientY};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const movePan=e=>{
  if(!pan.current||pan.current.id!==e.pointerId||!natural)return;
  const dx=e.clientX-pan.current.x,dy=e.clientY-pan.current.y;
  pan.current={...pan.current,x:e.clientX,y:e.clientY};
  if(dx||dy){
   e.preventDefault();
   onUpdate(current=>panAvatarFrame(current,dx,dy,natural.width,natural.height,PREVIEW_SCALE));
  }
 };
 const finishPan=e=>{
  if(pan.current?.id!==e.pointerId)return;
  pan.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const beginResize=e=>{
  if(disabled||e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  resize.current={id:e.pointerId,x:e.clientX,y:e.clientY};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const moveResize=e=>{
  if(!resize.current||resize.current.id!==e.pointerId)return;
  const dx=e.clientX-resize.current.x,dy=e.clientY-resize.current.y;
  resize.current={...resize.current,x:e.clientX,y:e.clientY};
  if(dx||dy){
   e.preventDefault();
   onUpdate(current=>resizeAvatarFrame(current,dx,dy,PREVIEW_SCALE));
  }
 };
 const finishResize=e=>{
  if(resize.current?.id!==e.pointerId)return;
  resize.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const onKeyMove=e=>{
  if(disabled||!natural||!member.avatarPath)return;
  const moves={ArrowRight:[8,0],ArrowLeft:[-8,0],ArrowDown:[0,8],ArrowUp:[0,-8]};
  if(moves[e.key]){
   e.preventDefault();
   const [dx,dy]=moves[e.key];
   onUpdate(current=>panAvatarFrame(current,dx,dy,natural.width,natural.height,PREVIEW_SCALE));
  }
  if(e.key==='+'||e.key==='='){e.preventDefault();zoomBy(.1)}
  if(e.key==='-'){e.preventDefault();zoomBy(-.1)}
 };
 const reset=()=>onUpdate(()=>avatarFrameProperties({width:68,height:68,zoom:1,x:50,y:50}));
 return <div className="photo-frame-editor" aria-label={'ضبط صورة '+(member.name||'عضو الفريق')}>
  <div className="photo-frame-stage">
   <div className={'photo-frame-drag'+(member.avatarPath&&!disabled?' can-drag':'')}
     style={{width:frame.width*PREVIEW_SCALE,height:frame.height*PREVIEW_SCALE}}
     onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={finishPan}
     onPointerCancel={finishPan} onLostPointerCapture={()=>{pan.current=null}}
     onKeyDown={onKeyMove} role="button" tabIndex={member.avatarPath&&!disabled?0:-1}
     aria-label="اسحب الصورة لتعديل موضعها داخل الإطار، أو استخدم أسهم لوحة المفاتيح">
    <TeamAvatar member={member} scale={PREVIEW_SCALE} onImageSize={setNatural}/>
    {member.avatarPath&&<div className="photo-frame-overlay-controls" onPointerDown={e=>e.stopPropagation()}>
     <button type="button" aria-label="تصغير الصورة" title="تصغير الصورة" disabled={disabled||frame.zoom<=1}
      onClick={()=>zoomBy(-.1)}><Minus size={15}/></button>
     <button type="button" aria-label="تكبير الصورة" title="تكبير الصورة" disabled={disabled||frame.zoom>=3}
      onClick={()=>zoomBy(.1)}><Plus size={15}/></button>
    </div>}
    <button type="button" className="photo-frame-resize-handle" title="اسحب لتغيير عرض وارتفاع إطار الصورة"
      aria-label="تعديل مقاس إطار الصورة بالسحب" disabled={disabled}
      onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={finishResize}
      onPointerCancel={finishResize} onLostPointerCapture={()=>{resize.current=null}}
      onKeyDown={e=>{
       if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
       e.stopPropagation();e.preventDefault();
       const dx=e.key==='ArrowLeft'?-6:e.key==='ArrowRight'?6:0;
       const dy=e.key==='ArrowDown'?6:e.key==='ArrowUp'?-6:0;
       onUpdate(current=>resizeAvatarFrame(current,dx,dy,PREVIEW_SCALE));
      }}>
      <Maximize2 size={15}/>
    </button>
   </div>
   <div className="photo-frame-hint"><Move size={15}/>
    {member.avatarPath?'اسحب الصورة لتغيير موضعها، واسحب الزاوية لضبط مقاس الإطار.':'ارفع صورة أولًا لتعديل موضعها داخل الإطار.'}
   </div>
  </div>
  <div className="photo-frame-settings">
   <div className="photo-frame-controls-title"><ImageIcon size={17}/><strong>تعديل الصورة داخل الإطار</strong></div>
   <label className="photo-frame-range">
    <span>تكبير الصورة <output>{Math.round(frame.zoom*100)}%</output></span>
    <input type="range" min="1" max="3" step=".05" value={frame.zoom} disabled={disabled||!member.avatarPath}
     onChange={e=>change('avatarZoom',Number(e.target.value))}/>
   </label>
   <label className="photo-frame-range">
    <span>عرض الإطار <output>{frame.width} بكسل</output></span>
    <input type="range" min={AVATAR_FRAME_LIMITS.width.min} max={AVATAR_FRAME_LIMITS.width.max}
     value={frame.width} disabled={disabled} onChange={e=>change('avatarWidth',Number(e.target.value))}/>
   </label>
   <label className="photo-frame-range">
    <span>ارتفاع الإطار <output>{frame.height} بكسل</output></span>
    <input type="range" min={AVATAR_FRAME_LIMITS.height.min} max={AVATAR_FRAME_LIMITS.height.max}
     value={frame.height} disabled={disabled} onChange={e=>change('avatarHeight',Number(e.target.value))}/>
   </label>
   <div className="photo-frame-meta">
    <span>الإطار الفعلي في البطاقة: {frame.width} × {frame.height} بكسل</span>
    <button className="outline-btn settings-tiny-btn" type="button" onClick={reset} disabled={disabled}>
     <RotateCcw size={14}/> إعادة الضبط
    </button>
   </div>
   <p className="photo-frame-help">المعاينة أكبر للتعديل بسهولة؛ في صفحة «عن المنصة» ستظهر الصورة بحجم الإطار المحدد هنا. اضغط «حفظ ونشر التعديلات» بعد الانتهاء.</p>
  </div>
 </div>;
}
