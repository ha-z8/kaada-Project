import { supabase } from './supabase.js';
import { sourceLanguage } from './speech.js';
import { safeSourcePath, safeAudioPath } from './storagePaths.js';
import { managedAIStatus, requestManagedAI } from './managedAiClient.js';
import {libraryCacheKey,readOfflineSnapshot,saveOfflineSnapshot,listOfflineEdits,overlayOfflineEdits,
 readOfflineAudio,saveOfflineAudio} from './offlineStore.js';
export async function loadMyRole(userId) {
  if(!userId) return 'user';
  const cacheKey='hsa-offline-role:'+userId;
  if(typeof navigator!=='undefined'&&navigator.onLine===false){
   const cached=localStorage.getItem(cacheKey);
   return cached==='admin'||cached==='teacher'?cached:'user';
  }
  try{
   const {data,error}=await supabase.from('app_roles').select('role').eq('user_id',userId).maybeSingle();
   if(error)throw error;
   const next=data?.role==='admin'?'admin':data?.role==='teacher'?'teacher':'user';
   try{localStorage.setItem(cacheKey,next)}catch{}
   return next;
  }catch(error){
   if(typeof navigator!=='undefined'&&(navigator.onLine===false||
     error instanceof TypeError||/failed to fetch|networkerror|fetch failed|timeout/i.test(String(error?.message||'')))){
    const cached=localStorage.getItem(cacheKey);
    return cached==='admin'||cached==='teacher'?cached:'user';
   }
   throw error;
  }
}
export async function updateSubject(id,values) {
  const {error}=await supabase.from('subjects').update({
    title:String(values.title||'').trim(), description:String(values.description||'').trim()
  }).eq('id',id);
  if(error)throw error;
}
export async function deleteSubject(id) {
  const {error}=await supabase.from('subjects').delete().eq('id',id);
  if(error)throw error;
}
export async function updateLesson(id, title) {
  const {error}=await supabase.from('lessons').update({title:title.trim()}).eq('id',id);
  if(error)throw error;
}
export async function deleteLesson(id) {
  const {error}=await supabase.from('lessons').delete().eq('id',id);
  if(error)throw error;
}
export async function loadLibrary({includePrivate=false,userId=null}={}) {
 const cacheKey=libraryCacheKey(userId,includePrivate);
 const cached=async()=>{
  const local=await readOfflineSnapshot(cacheKey)
   ||(includePrivate?await readOfflineSnapshot(libraryCacheKey(null,false)):null);
  if(!local)throw Error('المكتبة غير محفوظة على هذا الجهاز. اتصل بالإنترنت مرة واحدة لتحميلها.');
  const pending=await listOfflineEdits(userId);
  return overlayOfflineEdits(local,pending);
 };
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return cached();
 if(!supabase)return cached();
 try{
  // Supabase REST defaults to a maximum of 1000 returned rows: paginate before
  // declaring a catalog complete. Stable primary-key tiebreak avoids skipped items.
  const getAll=async(table,order)=>{
   const rows=[];
   for(let start=0;start<25000;start+=500){
    const {data,error}=await supabase.from(table).select('*')
     .order(order,{ascending:true}).order('id',{ascending:true})
     .range(start,start+499);
    if(error)throw error;
    rows.push(...(data||[]));
    if(!data||data.length<500)return rows;
   }
   throw Error('المكتبة أكبر من حد التنزيل الآمن، ولن نحتفظ بنسخة محلية ناقصة.');
  };
  const [subjects,lessons,sections]=await Promise.all([
   getAll(includePrivate?'subjects':'public_catalog_subjects','created_at'),
   getAll(includePrivate?'lessons':'public_catalog_lessons','position'),
   getAll(includePrivate?'sections':'public_catalog_sections','position')
  ]);
  const fresh={subjects,lessons,sections,progress:[]};
  await saveOfflineSnapshot(cacheKey,fresh).catch(()=>{});
  return overlayOfflineEdits(fresh,await listOfflineEdits(userId).catch(()=>[]));
 }catch(error){
  if(error instanceof TypeError||/failed to fetch|networkerror|network request|timeout|fetch failed/i.test(String(error?.message||''))){
   return cached();
  }
  throw error;
 }
}

export async function addSubject(title, description = '') {
  const { data, error } = await supabase.from('subjects').insert({ title, description }).select().single();
  if (error) throw error; return data;
}
export async function addLesson(subjectId, title, extracted, file, userId) {
  let source_path = null;
  const name = file?.name || 'محتوى نصي';
  if (file) {
    source_path = safeSourcePath(userId,crypto.randomUUID(),file);
    const up = await supabase.storage.from('study-source').upload(source_path, file, { upsert: false });
    if (up.error) throw up.error;
  }
  let lesson;
  try {
    const created = await supabase.from('lessons').insert({ subject_id: subjectId, title, source_filename: name, source_path }).select().single();
    if (created.error) throw created.error;
    lesson = created.data;
    const items = extracted.map((text, i) => ({ lesson_id: lesson.id, position: i, content_en: text, content_ar: sourceLanguage(text)==='ar'?text:'' }));
    // Batch to avoid request limits.
    for (let i = 0; i < items.length; i += 50) {
      const inserted = await supabase.from('sections').insert(items.slice(i, i + 50));
      if (inserted.error) throw inserted.error;
    }
    return lesson;
  } catch (error) {
    if (lesson) await supabase.from('lessons').delete().eq('id', lesson.id);
    if (source_path) await supabase.storage.from('study-source').remove([source_path]);
    throw error;
  }
}
export async function saveSection(id, payload) {
  const { error } = await supabase.from('sections').update(payload).eq('id', id);
  if (error) throw error;
}
export async function saveProgress(lessonId, sectionId, track, speed) {
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)throw Error('يجب تسجيل الدخول لحفظ تقدم الدراسة.');
  const { error } = await supabase.from('study_progress').upsert({ user_id:user.id, lesson_id: lessonId, section_id: sectionId, audio_track: track, speed, updated_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
  if (error) throw error;
}
export const getGeneratorStatus=managedAIStatus;
export async function getNewSections(lessonIds){
  const result=[];
  for(const id of lessonIds){
    for(let start=0;start<25000;start+=500){
     const {data,error}=await supabase.from('sections').select('id,lesson_id,position,source_page,content_en,content_ar,translated_at,translation_reviewed_at,explanation_ar,explanation_en,explanation_mixed,processed_at,reviewed_at,audio_ar_path,audio_en_path,audio_mixed_path').eq('lesson_id',id).order('position').order('id').range(start,start+499);
     if(error)throw error;result.push(...(data||[]));if(!data||data.length<500)break;
     if(start===24500)throw Error('عدد الفقرات أكبر من الحد المدعوم.');
    }
  }
  return result;
}
async function authorizedAI(mode,id,level){
  if(!supabase)throw Error('قاعدة البيانات غير متاحة حاليًا.');
  const {data:{session},error:authError}=await supabase.auth.getSession();
  if(authError||!session?.access_token)throw Error('سجّل الدخول إلى حساب المشرف أولًا.');
  return requestManagedAI({mode,sectionId:id,level,accessToken:session.access_token,allowExternalProcessing:true});
}
export async function translateSection(id){
  const result=await authorizedAI('translate',id,'intermediate');
  const translation=String(result?.translation||'').trim();
  if(!translation)throw Error('لم تصل ترجمة عربية. لم يتم حفظ أي بيانات.');
  return {
    translation,
    auto_save:result?.auto_save!==false,
    review_required:result?.review_required!==false,
    warnings:Array.isArray(result?.warnings)?result.warnings:[],
    quality_checks:result?.quality_checks||[],
    message:result?.message||'',
  };
}
export async function generateTranslation(id, level='intermediate') {
  const result=await authorizedAI('generate',id,level);
  const {validateGeneratedDraft}=await import('./generation.js');
  return validateGeneratedDraft(result?.draft);
}
export async function uploadAudio(section, track, file, userId) {
  const path = safeAudioPath(userId,section.id,crypto.randomUUID(),file);
  const uploaded = await supabase.storage.from('study-audio').upload(path, file);
  if (uploaded.error) throw uploaded.error;
  const field = { mixed: 'audio_mixed_path', en: 'audio_en_path', ar: 'audio_ar_path' }[track];
  const previous = section[field];
  try {
    await saveSection(section.id, { [field]: path });
    if (previous) await supabase.storage.from('study-audio').remove([previous]);
  } catch (error) {
    await supabase.storage.from('study-audio').remove([path]);
    throw error;
  }
}
/**
 * Study recordings have private, expiring server URLs. The cached bytes are
 * stored in authenticated per-user IndexedDB (never in the SW HTTP cache).
 * An offline recording may be played only for a previously signed-in user.
 */
export async function cacheStudyAudio(path,userId){
 if(!path||!userId)throw Error('التسجيل يحتاج حسابًا مخولًا.');
 if(await readOfflineAudio(userId,path))return {cached:true};
 if(typeof navigator!=='undefined'&&navigator.onLine===false)
  throw Error('لم يُنزّل هذا التسجيل على الجهاز بعد. صِل الإنترنت وحمّله أولًا.');
 if(!supabase)throw Error('قاعدة بيانات الملفات غير متاحة.');
 const {data,error}=await supabase.storage.from('study-audio').createSignedUrl(path,3600);
 if(error||!data?.signedUrl)throw error||Error('تعذر تفويض تحميل التسجيل.');
 const response=await fetch(data.signedUrl,{cache:'no-store'});
 if(!response.ok)throw Error('تعذر تنزيل التسجيل، رمز '+response.status);
 const audio=await response.blob();
 if(!audio.size)throw Error('وصل تسجيل فارغ.');
 await saveOfflineAudio(userId,path,audio);
 return {cached:true,size:audio.size};
}
export async function signedAudioUrl(path,userId=null){
 if(!path)return null;
 const getLocal=async()=>{
  if(!userId)throw Error('يلزم تسجيل الدخول على هذا الجهاز للاستماع إلى التسجيل المحفوظ.');
  const audio=await readOfflineAudio(userId,path);
  if(!audio)throw Error('التسجيل غير محفوظ دون إنترنت. افتحه مرة متصلًا أو نزّله من مركز العمل دون إنترنت.');
  return URL.createObjectURL(audio);
 };
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return getLocal();
 if(!supabase)return getLocal();
 try{
  const {data,error}=await supabase.storage.from('study-audio').createSignedUrl(path,3600);
  if(error||!data?.signedUrl)throw error||Error('تعذر الوصول للتسجيل.');
  // Cache only after the server has authorized this specific request.
  // Never block streaming while the background download completes.
  if(userId)void cacheStudyAudio(path,userId).catch(()=>{});
  return data.signedUrl;
 }catch(error){
  if(typeof navigator!=='undefined'&&navigator.onLine===false||
   error instanceof TypeError||/failed to fetch|networkerror|timeout|fetch failed/i.test(String(error?.message||''))){
    return getLocal();
  }
  throw error;
 }
}

export async function addLessonBundle(subjectId, chapters, file, userId) {
  if (!chapters.length) throw Error('لا توجد دروس لإضافتها.');
  const filename = file?.name || 'محتوى نصي';
  let source_path = null;
  const created = [];
  try {
    if(file) {
      source_path = safeSourcePath(userId,crypto.randomUUID(),file);
      const uploaded = await supabase.storage.from('study-source').upload(source_path, file, {upsert:false});
      if(uploaded.error) throw uploaded.error;
    }
    for(const [position,chapter] of chapters.entries()) {
      const saved = await supabase.from('lessons').insert({
        subject_id:subjectId,title:chapter.title,position,source_filename:filename,source_path
      }).select().single();
      if(saved.error) throw saved.error;
      created.push(saved.data);
      const rows = chapter.sections.map((content_en,i)=>({lesson_id:saved.data.id,position:i,content_en,content_ar:sourceLanguage(content_en)==='ar'?content_en:'',...(chapter.pageNumbers?.[i]?{source_page:chapter.pageNumbers[i]}:{})}));
      for(let i=0;i<rows.length;i+=50) {
        const inserted=await supabase.from('sections').insert(rows.slice(i,i+50));
        if(inserted.error) throw inserted.error;
      }
    }
    return created;
  }catch(error){
    for(const lesson of created) await supabase.from('lessons').delete().eq('id',lesson.id);
    if(source_path) await supabase.storage.from('study-source').remove([source_path]);
    throw error;
  }
}
