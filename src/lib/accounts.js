import { supabase } from './supabase.js';

export { normalizeUsername, validUsername, usernameLoginEmail } from './username.js';
export async function accountRequest(action,fields={}){
  if(!supabase)throw Error('تعذر الاتصال بقاعدة بيانات المنصة.');
  const {data,error}=await supabase.functions.invoke('account-control',{body:{action,...fields}});
  if(error){
    let message=error?.message||'تعذر الاتصال بإدارة الحسابات.';
    try{
      if(error.context && typeof error.context.json==='function'){
        const details=await error.context.json();
        if(details?.message)message=details.message;
      }
    }catch{}
    throw Error(message);
  }
  if(data?.message && !data.ok && !data.accounts)throw Error(data.message);
  return data;
}
export async function getMyProfile(userId){
  if(!userId)return null;
  const {data,error}=await supabase.from('user_profiles')
    .select('user_id,username,display_name,avatar_path,created_at').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return data;
}
