import { useState } from 'react';
import { Check,KeyRound,LoaderCircle,ShieldCheck,UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export default function MyAccountSettings({profile,role}){
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const submit=async e=>{
    e.preventDefault();setMessage('');
    if(password.length<8)return setMessage('كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.');
    if(password!==confirm)return setMessage('كلمتا المرور غير متطابقتين.');
    setBusy(true);
    try{
      const {error}=await supabase.auth.updateUser({password});
      if(error)throw error;
      setPassword('');setConfirm('');
      setMessage('تم تغيير كلمة المرور بنجاح.');
    }catch(e){setMessage(e?.message||'تعذّر تعديل كلمة المرور.')}
    finally{setBusy(false)}
  };
  return <div className="account-settings-page">
    <header className="accounts-head"><div><div className="eyebrow"><UserRound size={16}/> إعدادات الحساب</div><h1>حسابي</h1><p>بياناتك الأساسية وخيارات حماية حسابك.</p></div></header>
    <section className="accounts-panel my-account-card">
      <div className="account-identity-details"><span className="account-avatar"><UserRound size={24}/></span><div>
        <h2>{profile?.display_name||profile?.username||'مستخدم'}</h2>
        <p dir="ltr">@{profile?.username||'...'}</p>
        <span className={'role-pill '+(role==='admin'?'role-admin':'role-user')}><ShieldCheck size={14}/>{role==='admin'?'مشرف':'مستخدم'}</span>
      </div></div>
      <p className="subtle">تعديل اسم المستخدم أو الصلاحيات يتم من خلال المشرف في صفحة إدارة الحسابات.</p>
    </section>
    <section className="accounts-panel my-account-card">
      <h2><KeyRound size={19}/> تغيير كلمة المرور</h2>
      <form className="form-stack" onSubmit={submit}>
        <label>كلمة المرور الجديدة<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="8 أحرف على الأقل"/></label>
        <label>تأكيد كلمة المرور<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="أعد كتابة كلمة المرور"/></label>
        {message&&<p className="inline-alert" role="status">{message}</p>}
        <button className="primary-btn" disabled={busy}>{busy&&<LoaderCircle className="spin" size={16}/>}<Check size={16}/> حفظ كلمة المرور الجديدة</button>
      </form>
    </section>
  </div>;
}
