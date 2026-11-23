import {useState} from 'react';
import {CalendarDays,Check,CheckCircle2,Eye,EyeOff,KeyRound,LoaderCircle,LockKeyhole,ShieldCheck,UserRound} from 'lucide-react';
import {supabase} from '../lib/supabase.js';

export default function MyAccountSettings({profile,role}){
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [success,setSuccess]=useState(false);
 const isAdmin=role==='admin';
 const label=isAdmin?'مشرف المنصة':'عضو تدريس';
 const display=profile?.display_name||profile?.username||label;
 const initial=display.trim().slice(0,1)||'م';
 const match=password.length>=8&&password===confirm;
 const submit=async e=>{
  e.preventDefault();setMessage('');setSuccess(false);
  if(password.length<8)return setMessage('يجب ألا تقل كلمة المرور عن 8 أحرف.');
  if(password!==confirm)return setMessage('كلمتا المرور غير متطابقتين.');
  setBusy(true);
  try{
   const {error}=await supabase.auth.updateUser({password});
   if(error)throw error;
   setPassword('');setConfirm('');setSuccess(true);
   setMessage('تم تحديث كلمة المرور بنجاح.');
  }catch(e){setMessage(e?.message||'تعذّر تعديل كلمة المرور.')}
  finally{setBusy(false)}
 };
 return <div className="staff-account-page">
  <header className="accounts-head">
   <div><div className="eyebrow"><UserRound size={16}/> المساحة الشخصية</div>
    <h1>حسابي</h1><p>بيانات حسابك الإداري وأمان تسجيل الدخول، في مكان واحد.</p>
   </div>
  </header>
  <div className="staff-account-layout">
   <section className="staff-profile-panel">
    <div className="staff-profile-banner" aria-hidden="true"><ShieldCheck size={55}/></div>
    <div className="staff-profile-avatar">{initial}</div>
    <div className="staff-profile-info">
     <span className="staff-profile-kicker">الملف الشخصي</span>
     <h2>{display}</h2>
     <p dir="ltr">@{profile?.username||'...'}</p>
     <span className={'role-pill '+(isAdmin?'role-admin':'role-teacher')}><ShieldCheck size={14}/>{label}</span>
    </div>
    <div className="staff-profile-facts">
     <div><UserRound size={17}/><span>اسم المستخدم</span><strong dir="ltr">{profile?.username||'—'}</strong></div>
     <div><ShieldCheck size={17}/><span>نوع الصلاحية</span><strong>{label}</strong></div>
     <div><CalendarDays size={17}/><span>تاريخ إنشاء الحساب</span><strong>{profile?.created_at?new Date(profile.created_at).toLocaleDateString('ar-SA'):'—'}</strong></div>
    </div>
    <div className="staff-profile-hint"><LockKeyhole size={16}/> تغيير الاسم أو الصلاحيات يتم من إدارة الحسابات لدى المشرف.</div>
   </section>
   <section className="staff-security-panel">
    <div className="staff-security-head"><span><KeyRound size={22}/></span><div>
     <h2>أمان الحساب</h2><p>حدّث كلمة مرورك للحفاظ على أمان الدخول.</p>
    </div></div>
    <form className="form-stack" onSubmit={submit}>
     <label>كلمة المرور الجديدة
      <div className="staff-password-input">
       <input required type={showPassword?'text':'password'} minLength={8} maxLength={128} autoComplete="new-password"
        value={password} onChange={e=>{setPassword(e.target.value);setMessage('')}} placeholder="8 أحرف على الأقل"/>
       <button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور'}>
        {showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>
      </div>
     </label>
     <label>تأكيد كلمة المرور
      <div className="staff-password-input">
       <input required type={showPassword?'text':'password'} minLength={8} maxLength={128} autoComplete="new-password"
        value={confirm} onChange={e=>{setConfirm(e.target.value);setMessage('')}} placeholder="أعد كتابة كلمة المرور"/>
      </div>
     </label>
     {password.length>0&&<div className={'staff-password-match '+(match?'valid':'')}>
      {match?<CheckCircle2 size={16}/>:<LockKeyhole size={16}/>}
      {match?'كلمتا المرور متطابقتان':'أدخل كلمة مرور من 8 أحرف مع تأكيد مطابق'}
     </div>}
     {message&&<div className={'inline-alert '+(success?'staff-password-success':'')} role="status">{message}</div>}
     <button className="primary-btn" disabled={busy||!match}>{busy?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>} حفظ كلمة المرور</button>
    </form>
   </section>
  </div>
 </div>;
}
