import {UserRound} from 'lucide-react';
import {accountAvatarPublicUrl} from '../lib/teamAvatars.js';

export default function AccountAvatar({path,name='',size='medium',className=''}) {
 const image=accountAvatarPublicUrl(path);
 const initial=String(name||'حساب').trim().slice(0,1)||'م';
 return <span className={'staff-avatar staff-avatar-'+size+' '+className}
  aria-label={'الصورة الشخصية لـ '+(name||'الحساب')}>
  {image?<img key={image} src={image} alt="" loading="lazy" decoding="async"
    onError={e=>{e.currentTarget.style.display='none';e.currentTarget.nextElementSibling?.removeAttribute('hidden')}}/>
   :null}
  <span hidden={!!image} className="staff-avatar-fallback" aria-hidden="true">{initial||<UserRound size={21}/>}</span>
 </span>;
}
