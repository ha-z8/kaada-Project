import {useState} from 'react';
import {CheckCircle2,ImagePlus,LoaderCircle,UserRound,X} from 'lucide-react';
import AccountAvatar from './AccountAvatar.jsx';
import {uploadAccountAvatar,teamAvatarPublicUrl,validAccountAvatarPath} from '../lib/teamAvatars.js';

export default function AvatarPicker({value='',onChange,team=[],name='',allowUpload=true,targetUserId,
 disabled=false}){
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const photos=[...new Map((Array.isArray(team)?team:[]).filter(p=>teamAvatarPublicUrl(p.avatarPath))
  .map(p=>[p.avatarPath,p])).values()];
 const select=async path=>{
  if(disabled||busy)return;
  setNotice('');
  try{await onChange(path)}catch(e){setNotice(e?.message||'تعذّر حفظ الصورة.')}
 };
 const upload=async file=>{
  if(!file||disabled||busy)return;
  setNotice('');setBusy(true);
  try{
   const path=await uploadAccountAvatar(file,targetUserId);
   await onChange(path);
   setNotice('تم رفع الصورة وحفظ اختيارها بنجاح.');
  }catch(e){setNotice(e?.message||'تعذّر رفع الصورة؛ راجع الحجم أو الصيغة أو صلاحيات الحساب.')}
  finally{setBusy(false)}
 };
 return <div className="account-avatar-picker">
  <div className="account-avatar-picker-current">
   <AccountAvatar path={validAccountAvatarPath(value)?value:''} name={name} size="large"/>
   <div><strong>الصورة الشخصية</strong><p>ارفع صورة أو اختر واحدة من صور فريق العمل الموجودة.</p></div>
  </div>
  <div className="account-avatar-picker-actions">
   {allowUpload&&<label className={'outline-btn account-avatar-upload'+(busy||disabled?' is-disabled':'')}>
    {busy?<LoaderCircle size={16} className="spin"/>:<ImagePlus size={16}/>}
    {busy?'جارٍ تجهيز الصورة ورفعها...':'رفع صورة من الجهاز'}
    <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="رفع صورة شخصية"
     disabled={disabled||busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(file)}}/>
   </label>}
   {value&&<button type="button" className="outline-btn" disabled={disabled||busy} onClick={()=>void select('')}>
    <X size={16}/> إزالة الأفتار
   </button>}
  </div>
  {!!photos.length&&<div className="account-avatar-gallery">
   <strong>اختيار صورة من فريق العمل</strong>
   <div className="account-avatar-gallery-grid" role="group" aria-label="اختيار أفتار من صور فريق العمل">
    {photos.map(person=><button type="button" key={person.avatarPath}
     className={'account-avatar-photo-option'+(value===person.avatarPath?' selected':'')}
     title={'استخدام صورة '+person.name}
     aria-label={'اختيار صورة '+person.name} aria-pressed={value===person.avatarPath}
     disabled={disabled||busy} onClick={()=>void select(person.avatarPath)}>
     <img src={teamAvatarPublicUrl(person.avatarPath)} alt="" loading="lazy"/>
     <span>{person.name}</span>
     {value===person.avatarPath&&<CheckCircle2 size={17}/>}
    </button>)}
   </div>
  </div>}
  {!allowUpload&&<small className="account-avatar-picker-note">يمكن رفع صورة جديدة بعد إنشاء الحساب، من تعديل الحساب أو من صفحة «حسابي».</small>}
  {notice&&<p className="account-avatar-picker-note" role="status">{notice}</p>}
 </div>;
}
