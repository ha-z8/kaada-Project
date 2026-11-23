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
 const {supabase}=await import('./supabase.js');
 if(!supabase)throw Error('الاتصال بصلاحيات الموقع غير متاح.');
 const {data,error}=await supabase.from('site_edit_permissions')
  .select('allow_admin_identity,allow_admin_team').eq('id',1).single();
 if(error)throw Error('تعذّر قراءة صلاحيات التعديل: '+error.message);
 return normalizeSiteEditPermissions(data);
}
export async function saveSiteEditPermissions(input){
 const {supabase}=await import('./supabase.js');
 if(!supabase)throw Error('الاتصال بصلاحيات الموقع غير متاح.');
 const requested=normalizeSiteEditPermissions(input);
 const {data,error}=await supabase.from('site_edit_permissions')
  .update(requested).eq('id',1)
  .select('allow_admin_identity,allow_admin_team').single();
 if(error)throw Error('تعذّر تحديث الصلاحيات. لا يستطيع تعديلها إلا مطور المنصة: '+error.message);
 return normalizeSiteEditPermissions(data);
}
