import {safeSourcePath} from './storagePaths.js';
import {supabase} from './supabase.js';
import {readOfflineDocument,saveOfflineDocument,readOfflineSnapshot,saveOfflineSnapshot} from './offlineStore.js';
export const isPdfPath=path=>typeof path==='string'&&/\/source\.pdf$/i.test(path);
export async function documentAccess(lesson,userId){
 const key='document-access:'+lesson.id;
 const staffPath=userId&&isPdfPath(lesson.source_path)?lesson.source_path:null;
 const attachmentKey='document-attachment:'+userId+':'+lesson.id;
 let attachment=null,published=null;
 const readCached=async()=>{
  published=await readOfflineSnapshot(key).catch(()=>null);
  if(userId)attachment=await readOfflineSnapshot(attachmentKey).catch(()=>null);
 };
 if(navigator.onLine===false){await readCached();}else if(supabase){
  try{
  const result=await supabase.from('study_document_publications').select('source_path').eq('lesson_id',lesson.id).maybeSingle();
  if(result.error)throw result.error;published=result.data;
  await saveOfflineSnapshot(key,published||{}).catch(()=>{});
  if(userId){
   const result=await supabase.from('study_document_attachments').select('source_path').eq('lesson_id',lesson.id).maybeSingle();
   if(result.error)throw result.error;attachment=result.data;
   await saveOfflineSnapshot(attachmentKey,attachment||{}).catch(()=>{});
  }
  }catch(error){if(navigator.onLine===false||error instanceof TypeError||/failed to fetch|networkerror|network request|timeout|fetch failed/i.test(String(error?.message||'')))await readCached();else throw error;}
 }
 const privatePath=staffPath||attachment?.source_path||null;
 return {path:privatePath||published?.source_path||null,scope:privatePath?userId:'public',published:published?.source_path?published:null,attachment:attachment?.source_path?attachment:null};
}
export async function attachStudyPdf(lesson,userId,file){
 if(!userId||!file||file.size>30*1024*1024||!(await file.slice(0,1024).text()).includes('%PDF-'))throw Error('اختر ملف PDF صالحًا لا يتجاوز 30 ميجابايت.');
 const path=safeSourcePath(userId,crypto.randomUUID(),{name:'source.pdf',type:'application/pdf'});
 const {error}=await supabase.storage.from('study-source').upload(path,file,{upsert:false,contentType:'application/pdf'});
 if(error)throw error;
 const result=await supabase.from('study_document_attachments').insert({lesson_id:lesson.id,source_path:path});
 if(result.error){await supabase.storage.from('study-source').remove([path]);throw result.error;}
 await saveOfflineDocument(userId,path,file).catch(()=>{});
}
export async function loadStudyDocument(access,{preferCached=false}={}){
 const {scope,path}=access;
 if(!path)throw Error('لا يتوفر مستند PDF لهذا الدرس.');
 if(preferCached){const cached=await readOfflineDocument(scope,path).catch(()=>null);if(cached)return {blob:cached,saved:true};}
 if(navigator.onLine===false){
  const cached=await readOfflineDocument(scope,path);
  if(!cached)throw Error('احفظ المستند أولًا للعمل دون إنترنت.');
  return {blob:cached,saved:true};
 }
 const {data,error}=await supabase.storage.from('study-source').download(path);
 if(error){if(navigator.onLine===false||/failed to fetch|networkerror|network request|timeout|fetch failed/i.test(String(error.message||''))){const cached=await readOfflineDocument(scope,path).catch(()=>null);if(cached)return {blob:cached,saved:true};}throw error;}
 if(!(data instanceof Blob)||!data.size||data.size>30*1024*1024)throw Error('تعذّر فتح المستند.');
 if(!(await data.slice(0,1024).text()).includes('%PDF-'))throw Error('الملف ليس PDF صالحًا.');
 const saved=await saveOfflineDocument(scope,path,data).then(()=>true,()=>false);
 return {blob:data,saved};
}
export async function publishStudyDocument(lesson,publish,path=lesson.source_path){
 const request=publish?supabase.from('study_document_publications').insert({lesson_id:lesson.id,source_path:path}):supabase.from('study_document_publications').delete().eq('lesson_id',lesson.id);
 const {error}=await request;if(error)throw error;
}

export async function prepareOfflineDocuments(lessons,userId,onProgress=()=>{},shouldCancel=()=>false){
 const result={total:lessons.length,saved:0,noPdf:0,failed:0,done:0,cancelled:false};
 for(const lesson of lessons){
  if(shouldCancel()){result.cancelled=true;break;}
  if(navigator.onLine===false){result.cancelled=true;break;}
  try{const access=await documentAccess(lesson,userId);if(!access.path)result.noPdf++;else{const {saved}=await loadStudyDocument(access,{preferCached:true});if(saved)result.saved++;else result.failed++;}}
  catch{result.failed++;}
  result.done++;onProgress({...result});
 }
 return result;
}
