import {supabase} from './supabase.js';
import {
 queueOfflineEdit,listOfflineEdits,removeOfflineEdit,updateOfflineEdit,overlayOfflineEdits
} from './offlineStore.js';

const syncing=new Set();
export const isOfflineNetworkError=error=>{
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return true;
 const status=error?.status;
 if(status===0||status===502||status===503||status===504)return true;
 return error instanceof TypeError||/failed to fetch|networkerror|network request failed|load failed|timeout|fetch failed|offline|connection refused/i
  .test(String(error?.message||''));
};

export async function saveOrQueueEdit({userId,entity,recordId,patch,base,send}){
 if(!userId)throw Error('يجب تسجيل الدخول بحساب موظف لحفظ التعديلات.');
 if(navigator.onLine!==false){
  try{await send();return {status:'applied'}}catch(error){
   if(!isOfflineNetworkError(error))throw error;
  }
 }
 const queued=await queueOfflineEdit({userId,entity,recordId,patch,base});
 return {status:'queued',queued};
}
export async function replayOfflineChanges(userId,{onProgress}={}){
 if(!supabase||!userId||navigator.onLine===false||syncing.has(userId))
  return {status:'skipped',pending:0};
 syncing.add(userId);
 let applied=0,conflicts=0,errors=0,connectionLost=false;
 try{
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||user?.id!==userId)return {status:'login-required',pending:(await listOfflineEdits(userId)).length};
  const rows=await listOfflineEdits(userId);
  for(const entry of rows){
   if(entry.status!=='pending')continue;
   const now=await listOfflineEdits(userId);
   if(!now.some(e=>e.operationId===entry.operationId))continue;
   try{
    const {data,error}=await supabase.rpc('apply_offline_edit',{
     p_operation_id:entry.operationId,p_entity:entry.entity,
     p_record_id:entry.recordId,p_patch:entry.patch,p_expected:entry.expected
    });
    if(error)throw error;
    if(data?.status==='applied'){
     await removeOfflineEdit(entry.operationId);
     applied+=1;
    }else if(data?.status==='conflict'||data?.status==='missing'){
     await updateOfflineEdit({...entry,status:'conflict',
      server:data.server||null,lastError:data.status==='missing'?
      'حُذف السجل من الخادم أثناء الانقطاع.':'تغيّر السجل على الخادم؛ راجع التعارض قبل اعتماد نسختك.'});
     conflicts+=1;
    }else{
     await updateOfflineEdit({...entry,status:'error',
      lastError:'رفض الخادم هذا التغيير. تحقّق من صلاحياتك والبيانات المحفوظة.'});
     errors+=1;
    }
   }catch(error){
    if(isOfflineNetworkError(error)){connectionLost=true;break}
    await updateOfflineEdit({...entry,status:'error',lastError:
      'لم تُعتمد المزامنة: '+String(error?.message||'تعذّر التحقق من العملية').slice(0,260)});
    errors+=1;
   }
   onProgress?.({applied,conflicts,errors});
  }
  return {status:connectionLost?'offline':'done',applied,conflicts,errors,
   pending:(await listOfflineEdits(userId)).length};
 }finally{syncing.delete(userId)}
}
export async function replayAndLoad(userId,refresh){
 const result=await replayOfflineChanges(userId);
 if(result.applied&&typeof refresh==='function')await refresh();
 return result;
}
export {overlayOfflineEdits};
