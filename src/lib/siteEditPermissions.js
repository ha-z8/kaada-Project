export const DEFAULT_SITE_EDIT_PERMISSIONS=Object.freeze({
 allow_admin_identity:false,
 allow_admin_team:false
});
export function normalizeSiteEditPermissions(input){
 return {
  allow_admin_identity:input?.allow_admin_identity===true,
  allow_admin_team:input?.allow_admin_team===true
 };
}
export async function loadSiteEditPermissions(){
 const {readOfflineSnapshot,saveOfflineSnapshot}=await import('./offlineStore.js');
 const {supabase}=await import('./supabase.js');
 if(!supabase)throw Error('الاتصال بصلاحيات الموقع غير متاح.');
 const {data:{session}}=await supabase.auth.getSession();
 const uid=session?.user?.id;
 const key='site-edit-permissions:'+uid;
 const cached=async()=>{
  if(!uid)throw Error('لا توجد صلاحيات محفوظة لهذا الحساب.');
  const previous=await readOfflineSnapshot(key);
  if(!previous)throw Error('الصلاحيات غير محفوظة؛ يجب فتح الإعدادات مرة مع الاتصال.');
  return normalizeSiteEditPermissions(previous);
 };
 if(navigator.onLine===false)return cached();
 try{
  const {data,error}=await supabase.from('site_edit_permissions')
   .select('allow_admin_identity,allow_admin_team').eq('id',1).single();
  if(error)throw error;
  const value=normalizeSiteEditPermissions(data);
  if(uid)await saveOfflineSnapshot(key,value).catch(()=>{});
  return value;
 }catch(error){
  if(error instanceof TypeError||/failed to fetch|networkerror|timeout|fetch failed/i.test(String(error?.message||'')))return cached();
  throw Error('تعذّر قراءة صلاحيات التعديل: '+error.message);
 }
}
export async function saveSiteEditPermissions(input){
 if(navigator.onLine===false)throw Error('تغيير صلاحيات المشرفين يحتاج اتصالًا بالإنترنت للتحقق منها فورًا.');
 const {supabase}=await import('./supabase.js');
 if(!supabase)throw Error('الاتصال بصلاحيات الموقع غير متاح.');
 const requested=normalizeSiteEditPermissions(input);
 const {data,error}=await supabase.from('site_edit_permissions')
  .update(requested).eq('id',1)
  .select('allow_admin_identity,allow_admin_team').single();
 if(error)throw Error('تعذّر تحديث الصلاحيات. لا يستطيع تعديلها إلا مطور المنصة: '+error.message);
 return normalizeSiteEditPermissions(data);
}
