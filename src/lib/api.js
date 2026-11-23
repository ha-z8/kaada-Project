import { supabase } from './supabase.js';
import { sourceLanguage } from './speech.js';
import { safeSourcePath, safeAudioPath } from './storagePaths.js';
import { managedAIStatus, requestManagedAI } from './managedAiClient.js';
export async function loadMyRole(userId) {
  if(!userId) return 'user';
  const {data,error}=await supabase.from('app_roles').select('role').eq('user_id',userId).maybeSingle();
  if(error) throw error;
  return data?.role==='admin'?'admin':data?.role==='teacher'?'teacher':'user';
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
export async function loadLibrary({includePrivate=false}={}) {
  if(!supabase)throw Error('لا يمكن الاتصال بمكتبة المنصة.');
  // Anonymous visitors use minimized views; authorized staff retain old private audio functionality.
  const [subjects,lessons,sections]=await Promise.all([
   supabase.from(includePrivate?'subjects':'public_catalog_subjects').select('*').order('created_at'),
   supabase.from(includePrivate?'lessons':'public_catalog_lessons').select('*').order('position'),
   supabase.from(includePrivate?'sections':'public_catalog_sections').select('*').order('position'),
  ]);
  for(const response of [subjects,lessons,sections])if(response.error)throw response.error;
  return {subjects:subjects.data||[],lessons:lessons.data||[],sections:sections.data||[],progress:[]};
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
    const {data,error}=await supabase.from('sections').select('id,lesson_id,content_en,content_ar,translated_at,translation_reviewed_at,explanation_ar,explanation_en,explanation_mixed,processed_at,reviewed_at,audio_ar_path,audio_en_path,audio_mixed_path').eq('lesson_id',id).order('position');
    if(error)throw error;
    result.push(...(data||[]));
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
export async function signedAudioUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('study-audio').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
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
      const rows = chapter.sections.map((content_en,i)=>({lesson_id:saved.data.id,position:i,content_en,content_ar:sourceLanguage(content_en)==='ar'?content_en:''}));
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
