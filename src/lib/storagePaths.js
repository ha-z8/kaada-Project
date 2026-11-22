/**
 * Supabase Storage object keys must be portable and independent from user-controlled
 * file names. The original Arabic file name stays in the lessons DB metadata.
 */
const ALLOWED_SOURCE_EXTENSIONS=new Set(['pdf','docx','txt','md']);
const AUDIO_EXTENSIONS=new Set(['mp3','wav','ogg','m4a','webm','aac','flac']);
const SAFE_ID=/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;
function stableSegment(value){
  const s=String(value||'');
  if(!SAFE_ID.test(s))throw Error('معرّف التخزين غير صالح.');
  return s;
}
export function sourceExtension(file){
  const name=String(file?.name||'').toLowerCase();
  const ext=name.split('.').pop();
  if(ALLOWED_SOURCE_EXTENSIONS.has(ext))return ext;
  if(file?.type==='application/pdf')return 'pdf';
  if(file?.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return 'docx';
  if(file?.type==='text/plain')return 'txt';
  return 'bin';
}
export function safeSourcePath(userId,uniqueId,file){
  return stableSegment(userId)+'/'+stableSegment(uniqueId)+'/source.'+sourceExtension(file);
}
export function safeAudioPath(userId,sectionId,uniqueId,file){
  const suffix=String(file?.name||'').toLowerCase().split('.').pop();
  const ext=AUDIO_EXTENSIONS.has(suffix)?suffix:'mp3';
  return stableSegment(userId)+'/'+stableSegment(sectionId)+'/audio-'+stableSegment(uniqueId)+'.'+ext;
}
