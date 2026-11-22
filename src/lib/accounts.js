import { supabase } from './supabase.js';

const usernameRegex=/^[a-z0-9][a-z0-9._-]{2,23}$/;
export function normalizeUsername(value=''){return String(value).trim().toLowerCase();}
export function validUsername(value=''){return usernameRegex.test(normalizeUsername(value));}
export function usernameLoginEmail(value=''){
  const name=normalizeUsername(value);
  if(!validUsername(name))throw Error('اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا إنجليزيًا أو رقمًا.');
  return name+'@accounts.kaada.invalid';
}
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
    .select('user_id,username,display_name,created_at').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return data;
}
