import {supabase} from './supabase.js';
import {readOfflineDocument,saveOfflineDocument,readOfflineSnapshot,saveOfflineSnapshot} from './offlineStore.js';
export const isPdfPath=path=>typeof path==='string'&&/\/source\.pdf$/i.test(path);
export async function documentAccess(lesson,userId){
 const key='document-access:'+lesson.id;
 const staffPath=userId&&isPdfPath(lesson.source_path)?lesson.source_path:null;
 if(navigator.onLine===false){
  const published=await readOfflineSnapshot(key).catch(()=>null);
  return {path:staffPath||published?.source_path||null,scope:staffPath?userId:'public',published:published||null};
 }
 if(!supabase)return {path:staffPath,scope:userId||'public',published:null};
 const {data,error}=await supabase.from('study_document_publications').select('source_path').eq('lesson_id',lesson.id).maybeSingle();
 if(error)throw error;
 await saveOfflineSnapshot(key,data||{}).catch(()=>{});
 return {path:staffPath||data?.source_path||null,scope:staffPath?userId:'public',published:data||null};
}
export async function loadStudyDocument(access){
 const {scope,path}=access;
 if(!path)throw Error('لا يتوفر مستند PDF لهذا الدرس.');
 if(navigator.onLine===false){
  const cached=await readOfflineDocument(scope,path);
  if(!cached)throw Error('احفظ المستند أولًا للعمل دون إنترنت.');
  return {blob:cached,saved:true};
 }
 const {data,error}=await supabase.storage.from('study-source').download(path);
 if(error)throw error;
 if(!(data instanceof Blob)||!data.size||data.size>30*1024*1024)throw Error('تعذّر فتح المستند.');
 if(!(await data.slice(0,1024).text()).includes('%PDF-'))throw Error('الملف ليس PDF صالحًا.');
 const saved=await saveOfflineDocument(scope,path,data).then(()=>true,()=>false);
 return {blob:data,saved};
}
export async function publishStudyDocument(lesson,publish){
 const request=publish?supabase.from('study_document_publications').insert({lesson_id:lesson.id,source_path:lesson.source_path}):supabase.from('study_document_publications').delete().eq('lesson_id',lesson.id);
 const {error}=await request;if(error)throw error;
}
