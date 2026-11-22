import { supabase } from './supabase.js';
import { sourceLanguage } from './speech.js';
export async function loadLibrary() {
  const [subjects, lessons, sections, progress] = await Promise.all([
    supabase.from('subjects').select('*').order('created_at'),
    supabase.from('lessons').select('*').order('position'),
    supabase.from('sections').select('*').order('position'),
    supabase.from('study_progress').select('*'),
  ]);
  for (const response of [subjects, lessons, sections, progress]) if (response.error) throw response.error;
  return { subjects: subjects.data || [], lessons: lessons.data || [], sections: sections.data || [], progress: progress.data || [] };
}
export async function addSubject(title, description = '') {
  const { data, error } = await supabase.from('subjects').insert({ title, description }).select().single();
  if (error) throw error; return data;
}
export async function addLesson(subjectId, title, extracted, file, userId) {
  let source_path = null;
  const name = file?.name || 'محتوى نصي';
  if (file) {
    source_path = `${userId}/${crypto.randomUUID()}/${name.replace(/[^\w.\-\u0600-\u06FF]/g, '_')}`;
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
export async function generateTranslation(id, level='intermediate') {
  if(!supabase) throw Error('قاعدة البيانات لم تُربط بالموقع بعد. يمكن تعديل النص والشرح يدويًا حتى إكمال الربط.');
  const {data:{session},error:authError}=await supabase.auth.getSession();
  if(authError||!session?.access_token)throw Error('سجّل الدخول إلى حسابك أولًا.');
  let response;
  try {
    response=await fetch('/api/study/generate',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({section_id:id,level,allow_external_processing:true}),
    });
  } catch {
    throw Error('تعذّر الاتصال بخدمة الشرح في Netlify. تأكد من نشر الموقع مع Netlify Functions.');
  }
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('application/json'))
    throw Error('خدمة الشرح لم تُنشر بعد على Netlify أو رابطها غير صحيح.');
  const data=await response.json();
  if(!response.ok)throw Error(data?.message||'تعذّر توليد الشرح، راجع إعدادات Netlify.');
  const { validateGeneratedDraft }=await import('./generation.js');
  return validateGeneratedDraft(data?.draft);
}
export async function uploadAudio(section, track, file, userId) {
  const path = `${userId}/${section.id}/${track}-${crypto.randomUUID()}${file.name.match(/\.[^.]+$/)?.[0] || '.mp3'}`;
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
      source_path = `${userId}/${crypto.randomUUID()}/${filename.replace(/[^\w.\-\u0600-\u06FF]/g, '_')}`;
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
