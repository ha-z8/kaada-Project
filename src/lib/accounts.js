import { supabase } from './supabase.js';
import {readOfflineSnapshot,saveOfflineSnapshot} from './offlineStore.js';
import {isOfflineNetworkError} from './offlineSync.js';
import {accountCacheKey,safeAccountSummaries} from './accountCache.js';
export {accountCacheKey,safeAccountSummaries} from './accountCache.js';

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

/** Last verified online admin list, scoped to this signed-in user's local session. */
export async function listAccountsWithCache(userId){
  const key=accountCacheKey(userId);
  const cached=async()=>{
    const rows=await readOfflineSnapshot(key);
    if(!Array.isArray(rows))throw Error(
      'لا توجد نسخة محفوظة من إدارة الحسابات على هذا الجهاز. افتح الصفحة مرة واحدة مع الإنترنت لتحميلها.'
    );
    return {accounts:safeAccountSummaries(rows),fromCache:true,cacheSaved:true};
  };
  if(typeof navigator!=='undefined'&&navigator.onLine===false)return cached();
  try{
    const response=await accountRequest('list');
    const accounts=safeAccountSummaries(response?.accounts);
    // Keep an existing good snapshot if a failed IndexedDB write occurs.
    const cacheSaved=await saveOfflineSnapshot(key,accounts).then(()=>true,()=>false);
    return {accounts,fromCache:false,cacheSaved};
  }catch(error){
    if(isOfflineNetworkError(error)||error?.name==='FunctionsFetchError'
      ||/failed to send a request/i.test(String(error?.message||'')))return cached();
    throw error; // No offline fallback for denied/invalid authorization.
  }
}
