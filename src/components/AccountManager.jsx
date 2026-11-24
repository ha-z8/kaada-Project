import {useNotice} from '../lib/notifications.js';
import { useCallback,useEffect,useMemo,useState } from 'react';
import { Check,KeyRound,LoaderCircle,Pencil,Plus,Search,ShieldCheck,Trash2,UserRound,Users, X } from 'lucide-react';
import { accountRequest,listAccountsWithCache,accountCacheKey,safeAccountSummaries } from '../lib/accounts.js';
import {saveOfflineSnapshot} from '../lib/offlineStore.js';
import AccountAvatar from './AccountAvatar.jsx';
import AvatarPicker from './AvatarPicker.jsx';
import { validUsername,normalizeUsername } from '../lib/username.js';

const fresh=()=>({username:'',display_name:'',role:'teacher',password:'',avatar_path:''});

export default function AccountManager({currentUserId,onNotify,isSiteOwner=false,teamPhotos=[],onOwnAccountUpdated}){
  const [accounts,setAccounts]=useState([]);
  const [loadedUserId,setLoadedUserId]=useState(null);
  const loaded=Boolean(currentUserId)&&loadedUserId===currentUserId;
  const [offlineCopy,setOfflineCopy]=useState(false);
  const [cacheSaved,setCacheSaved]=useState(true);
  const [networkOffline,setNetworkOffline]=useState(()=>typeof navigator!=='undefined'&&navigator.onLine===false);
  const [loading,setLoading]=useState(true);
  const [loadFailed,setLoadFailed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useNotice(error,'error');
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(fresh);
  const canManageAccount=a=>isSiteOwner||!a.is_owner;
  // Passwords, role changes and deletions require confirmation by the live server.
  const readOnly=offlineCopy||networkOffline||!loaded||loading||loadFailed;
  const offlineMessage='إدارة الحسابات في وضع القراءة فقط دون اتصال. التعديلات وإنشاء الحسابات وحذفها تتطلب الإنترنت.';
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {
      const result=await listAccountsWithCache(currentUserId);
      setAccounts(result.accounts);
      setLoadedUserId(currentUserId);
      setOfflineCopy(result.fromCache);
      setCacheSaved(result.cacheSaved);
      setLoadFailed(false);
      if(result.liveError)setError(result.liveError);
    }catch(e){
      setLoadFailed(true);
      // A transient fetch failure must never turn a previously visible list into [].
      if([401,403].includes(e?.status)){setAccounts([]);setLoadedUserId(null);setOfflineCopy(false);}
      setError(e?.message||'تعذر تحميل الحسابات.');
    }finally{setLoading(false)}
  },[currentUserId]);
  useEffect(()=>{
    void load();
    const offline=()=>{setNetworkOffline(true);setOfflineCopy(true)};
    const online=()=>{setNetworkOffline(false);void load()};
    window.addEventListener('offline',offline);
    window.addEventListener('online',online);
    return()=>{
      window.removeEventListener('offline',offline);
      window.removeEventListener('online',online);
    };
  },[load]);
  const visible=useMemo(()=>accounts.filter(a=>(a.username+' '+a.display_name).toLowerCase().includes(search.toLowerCase())),[accounts,search]);
  const openAdd=()=>{if(readOnly)return setError(offlineMessage);setForm(fresh());setEditing({mode:'create'});setError('')};
  const openEdit=a=>{if(!canManageAccount(a))return setError('هذا حساب مطور المنصة، ولا يمكن تعديله من حساب مشرف آخر.');setForm({username:a.username,display_name:a.display_name||'',role:a.role==='admin'?'admin':'teacher',password:'',avatar_path:a.avatar_path||''});setEditing({mode:'edit',user_id:a.user_id});setError('')};
  const submit=async e=>{
    e.preventDefault();if(busy)return;
    if(readOnly)return setError(offlineMessage);
    if(!validUsername(form.username))return setError('اسم المستخدم يجب أن يتكون من 3 إلى 24 حرفًا إنجليزيًا أو رقمًا.');
    if(editing.mode==='create' && form.password.length<8)return setError('كلمة المرور لا تقل عن 8 أحرف.');
    if(editing.mode==='edit' && form.password && form.password.length<8)return setError('كلمة المرور الجديدة لا تقل عن 8 أحرف.');
    setBusy(true);setError('');
    try {
      const values={username:normalizeUsername(form.username),display_name:form.display_name.trim(),role:form.role,avatar_path:form.avatar_path||''};
      if(form.password)values.password=form.password;
      if(editing.mode==='create')await accountRequest('create',values);
      else {
        await accountRequest('update',{user_id:editing.user_id,...values});
        const next=safeAccountSummaries(accounts.map(a=>a.user_id===editing.user_id?{...a,username:values.username,display_name:values.display_name,role:values.role,avatar_path:values.avatar_path}:a));
        setAccounts(next);
        await saveOfflineSnapshot(accountCacheKey(currentUserId),next).catch(()=>{});
      }
      setEditing(null);setForm(fresh());
      onNotify?.(editing.mode==='create'?'تم إنشاء الحساب ويمكنه الدخول باسم المستخدم وكلمة المرور.':'تم تعديل بيانات الحساب.');
      await load();
      if(editing.user_id===currentUserId)await onOwnAccountUpdated?.();
    }catch(err){setError(err?.message||'تعذّر حفظ الحساب.')}
    finally{setBusy(false)}
  };
  const remove=async a=>{
    if(readOnly)return setError(offlineMessage);
    if(a.user_id===currentUserId)return setError('لا يمكن حذف حساب المشرف الحالي.');
    if(!canManageAccount(a))return setError('لا يمكن حذف حساب مطور المنصة.');
    if(!window.confirm('هل تريد حذف حساب '+a.username+' نهائيًا؟ سيُحذف حساب الدخول وتقدمه الشخصي، وتُنقل ملكية المواد المشتركة إلى مشرف آخر.'))return;
    setBusy(true);setError('');
    try{
      await accountRequest('delete',{user_id:a.user_id});
      const next=accounts.filter(item=>item.user_id!==a.user_id);
      setAccounts(next);
      await saveOfflineSnapshot(accountCacheKey(currentUserId),next).catch(()=>{});
      onNotify?.('تم حذف الحساب.');
      await load();
    }catch(e){setError(e?.message||'تعذر حذف الحساب.')}
    finally{setBusy(false)}
  };
  return <div className="accounts-page">
    <header className="accounts-head">
      <div><div className="eyebrow"><ShieldCheck size={16}/> صلاحيات المشرف</div><h1>إدارة الحسابات</h1><p>أنشئ حسابات أعضاء هيئة التدريس أو المشرفين فقط. الزوار يذاكرون دون حساب، وحساب مطور المنصة محمي.</p></div>
      <button className="primary-btn" onClick={openAdd} disabled={readOnly} title={offlineCopy||networkOffline?offlineMessage:!loaded?'حمّل القائمة أولًا':undefined}><Plus size={18}/> حساب جديد</button>
    </header>
    {(offlineCopy||networkOffline)&&<div className="inline-alert" role="status">
      {loaded?'تُعرض آخر قائمة محفوظة. التعديلات غير متاحة حاليًا.':'الحسابات غير متاحة دون اتصال.'}
    </div>}
    {!cacheSaved&&!readOnly&&<div className="inline-alert" role="status">
      القائمة محدثة الآن، لكن المتصفح تعذر عليه تخزينها للعمل دون اتصال. تحقّق من مساحة التخزين وإعدادات الخصوصية.
    </div>}
    <div className="accounts-summary">
      <div><Users size={21}/><span>إجمالي الحسابات</span><strong>{loaded?accounts.length:'—'}</strong></div>
      <div><ShieldCheck size={21}/><span>المشرفون</span><strong>{loaded?accounts.filter(a=>a.role==='admin').length:'—'}</strong></div>
      <div><UserRound size={21}/><span>أعضاء هيئة التدريس</span><strong>{loaded?accounts.filter(a=>a.role==='teacher').length:'—'}</strong></div>
    </div>
    <section className="accounts-panel">
      <div className="section-bar compact">
        <div><h2>الحسابات المسجّلة</h2><p className="subtle">لا تُعرض كلمات المرور الحالية لأحد، بما في ذلك المشرف.</p></div>
        <button type="button" className="outline-btn" disabled={loading||busy} onClick={()=>void load()}>{loading?'جارٍ التحديث…':'تحديث الحسابات'}</button>
        <div className="search-wrap"><Search size={16}/><input placeholder="ابحث باسم المستخدم أو الاسم..." value={search} onChange={e=>setSearch(e.target.value)} aria-label="البحث عن حساب"/></div>
      </div>
      {error&&<div className="inline-alert accounts-error" role="alert">{error}</div>}
      {loading&&!loaded?<div className="accounts-empty"><LoaderCircle size={24} className="spin"/> جارٍ تحميل الحسابات...</div>
        :!loaded?<div className="accounts-empty">{networkOffline?'لا توجد قائمة محفوظة لعرضها. اتصل بالإنترنت لتحميل الحسابات.':'تعذّر تحميل الحسابات. حاول مجددًا.'}</div>
        :visible.length?<div className="account-list">
          {visible.map(a=><div className="account-list-item" key={a.user_id}>
            <AccountAvatar path={a.avatar_path} name={a.display_name||a.username} size="small"/>
            <div className="account-identity">
              <strong>{a.display_name||a.username} {a.user_id===currentUserId&&<small>(حسابك)</small>} {a.is_owner&&<small>(مطور المنصة)</small>}</strong>
              <span dir="ltr">@{a.username}</span>
              <small>تاريخ الإنشاء: {new Date(a.created_at).toLocaleDateString('ar-SA')}</small>
            </div>
            <span className={'role-pill '+(a.role==='admin'?'role-admin':a.role==='teacher'?'role-teacher':'role-user')}>{a.role==='admin'?'مشرف':a.role==='teacher'?'عضو هيئة التدريس':'حساب قديم'}</span>
            <div className="account-row-actions">
              <button className="outline-btn" onClick={()=>openEdit(a)} disabled={busy||readOnly||!canManageAccount(a)} title={!canManageAccount(a)?'صلاحية مطور المنصة فقط':''}><Pencil size={15}/> تعديل</button>
              <button className="outline-btn danger-btn" disabled={busy||readOnly||a.user_id===currentUserId||!canManageAccount(a)} onClick={()=>remove(a)}><Trash2 size={15}/> حذف</button>
            </div>
          </div>)}
        </div>:<div className="accounts-empty">لا توجد حسابات تطابق البحث.</div>}
    </section>
    <p className="helper-text accounts-footnote">تسجيل الدخول للموظفين فقط. الزوار لا يحتاجون إلى حساب؛ وتبقى صلاحيات المطور محمية.</p>

    {editing&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEditing(null)}}>
      <div className="modal account-modal" role="dialog" aria-modal="true" aria-label={editing.mode==='create'?'إنشاء حساب':'تعديل الحساب'}>
        <header className="modal-header"><div><h2>{editing.mode==='create'?'إنشاء حساب جديد':'تعديل الحساب'}</h2><p className="subtle">الحساب مخصّص للمشرفين وأعضاء هيئة التدريس فقط، دون تسجيل عام.</p></div><button className="icon-btn" onClick={()=>setEditing(null)} disabled={busy}><X size={19}/></button></header>
        <form className="modal-body form-stack" onSubmit={submit}>
          <label>اسم المستخدم<input required value={form.username} minLength={3} maxLength={24} autoComplete="off" dir="ltr" placeholder="teacher_001" onChange={e=>setForm(f=>({...f,username:e.target.value}))}/></label>
          <label>الاسم الظاهر<input maxLength={100} value={form.display_name} placeholder="الاسم الكامل (اختياري)" onChange={e=>setForm(f=>({...f,display_name:e.target.value}))}/></label>
          <AvatarPicker value={form.avatar_path} name={form.display_name||form.username}
           team={teamPhotos} allowUpload={editing.mode==='edit'} targetUserId={editing.user_id} requiresSave
           disabled={busy} onChange={path=>setForm(prev=>({...prev,avatar_path:path}))}/>
          <label>الصلاحية<select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
            <option value="teacher">عضو هيئة التدريس — تدقيق النصوص والترجمة والشروح فقط</option><option value="admin">مشرف — إدارة المواد والإعدادات والحسابات</option>
          </select></label>
          <label><span className="password-caption"><KeyRound size={14}/>{editing.mode==='create'?'كلمة المرور':'كلمة مرور جديدة (اختياري)'}</span>
            <input type="password" minLength={8} maxLength={128} required={editing.mode==='create'} autoComplete="new-password" value={form.password} placeholder={editing.mode==='create'?'8 أحرف على الأقل':'اتركها فارغة للإبقاء على الحالية'} onChange={e=>setForm(f=>({...f,password:e.target.value}))}/>
          </label>
          <p className="helper-text">إذا غيّرت اسم المستخدم، يجب استخدام الاسم الجديد عند الدخول القادم. لا يمكن استرجاع كلمة مرور الحساب القديمة.</p>
          {error&&<div className="inline-alert" role="alert">{error}</div>}
          <div className="modal-actions"><button className="outline-btn" type="button" onClick={()=>setEditing(null)} disabled={busy}>إلغاء</button>
            <button className="primary-btn" disabled={busy||readOnly}>{busy&&<LoaderCircle size={16} className="spin"/>}<Check size={16}/>{editing.mode==='create'?'إنشاء الحساب':'حفظ التعديلات'}</button>
          </div>
        </form>
      </div>
    </div>}
  </div>;
}
