/** Offline account metadata never includes credentials, secrets or tokens. */
export function accountCacheKey(userId){
  if(!userId)throw Error('لا يوجد حساب مشرف صالح لعرض البيانات المحفوظة.');
  return 'accounts:admin:'+userId;
}
export function safeAccountSummaries(records){
  if(!Array.isArray(records))throw Error('استجابة الحسابات غير صالحة.');
  return records.filter(a=>a&&typeof a.user_id==='string').map(a=>({
    user_id:a.user_id,username:String(a.username||''),
    display_name:String(a.display_name||''),role:String(a.role||''),
    avatar_path:String(a.avatar_path||''),created_at:a.created_at||null,
    is_owner:a.is_owner===true
  }));
}
