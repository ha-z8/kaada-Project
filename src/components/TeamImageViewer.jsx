import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {teamAvatarPublicUrl} from '../lib/teamAvatars.js';

/** Enlarged, read-only view of a team member's complete uploaded photo. */
export default function TeamImageViewer({member,onClose}){
 const closeRef=useRef(null);
 const imageUrl=teamAvatarPublicUrl(member?.avatarPath);
 const name=String(member?.name||'عضو الفريق');
 useEffect(()=>{
  if(!imageUrl)return undefined;
  const previousFocus=document.activeElement;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  closeRef.current?.focus();
  const onKeyDown=e=>{
   if(e.key==='Escape'){e.preventDefault();onClose()}
   // The only focusable control in this dialog is Close.
   if(e.key==='Tab'){e.preventDefault();closeRef.current?.focus()}
  };
  document.addEventListener('keydown',onKeyDown);
  return ()=>{
   document.removeEventListener('keydown',onKeyDown);
   document.body.style.overflow=previousOverflow;
   if(previousFocus?.isConnected&&typeof previousFocus.focus==='function')previousFocus.focus();
  };
 },[imageUrl,onClose]);
 if(!imageUrl)return null;
 return createPortal(
  <div className="team-image-lightbox-backdrop" role="dialog" aria-modal="true"
   aria-label={'عرض صورة '+name}
   onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
   <button ref={closeRef} className="team-image-lightbox-close" type="button"
    onClick={onClose} aria-label="إغلاق عرض الصورة" title="إغلاق الصورة"><X size={22}/></button>
   <img className="team-image-lightbox-photo" src={imageUrl}
    alt={'الصورة الشخصية لـ '+name} draggable={false}/>
  </div>,
  document.body
 );
}
