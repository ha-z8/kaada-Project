import {PUBLIC_SUPABASE_URL} from './publicSupabaseConfig.js';
import {validTeamAvatarPath} from './siteSettings.js';

export const TEAM_AVATAR_BUCKET='team-avatars';
export const MAX_SOURCE_AVATAR_BYTES=8*1024*1024;
export const MAX_UPLOADED_AVATAR_BYTES=512*1024;
export const ACCEPTED_AVATAR_TYPES=Object.freeze(['image/jpeg','image/png','image/webp']);

export function validateAvatarFile(file){
 if(!file)throw Error('اختر صورة أولًا.');
 if(!ACCEPTED_AVATAR_TYPES.includes(file.type))
  throw Error('نوع الصورة غير مدعوم. اختر JPG أو PNG أو WebP.');
 if(file.size>MAX_SOURCE_AVATAR_BYTES)
  throw Error('حجم الصورة كبير جدًا. الحد الأقصى قبل ضغطها 8 ميجابايت.');
 if(!file.size)throw Error('ملف الصورة فارغ.');
 return true;
}

export function teamAvatarPublicUrl(path){
 if(!validTeamAvatarPath(path))return '';
 const base=(import.meta.env?.VITE_SUPABASE_URL||PUBLIC_SUPABASE_URL).replace(/\/+$/,'');
 return base+'/storage/v1/object/public/'+TEAM_AVATAR_BUCKET+'/'+path;
}

async function readImage(file){
 if(typeof createImageBitmap==='function'){
  try{
   const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
   return {image:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};
  }catch{ /* Fall back to HTMLImageElement for browsers without supported decoding. */ }
 }
 const objectUrl=URL.createObjectURL(file);
 try{
  const image=await new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>resolve(img);
   img.onerror=()=>reject(Error('تعذر قراءة الصورة؛ جرّب صورة JPG أو PNG أخرى.'));
   img.src=objectUrl;
  });
  return {image,width:image.naturalWidth,height:image.naturalHeight,close:()=>URL.revokeObjectURL(objectUrl)};
 }catch(error){URL.revokeObjectURL(objectUrl);throw error}
}

function canvasToWebp(canvas,quality){
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
  if(!blob||blob.type!=='image/webp')reject(Error('تعذر ضغط الصورة إلى WebP في هذا المتصفح.'));
  else resolve(blob);
 },'image/webp',quality));
}

export async function createTeamAvatarThumbnail(file){
 validateAvatarFile(file);
 if(typeof document==='undefined')throw Error('معالجة الصور تتطلب متصفحًا يدعم الصور.');
 const source=await readImage(file);
 try{
  if(!source.width||!source.height)throw Error('أبعاد الصورة غير صحيحة.');
  const canvas=document.createElement('canvas');
  canvas.width=384;
  canvas.height=384;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('تعذر تجهيز الصورة في المتصفح.');
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const crop=Math.min(source.width,source.height);
  const x=(source.width-crop)/2;
  const y=(source.height-crop)/2;
  ctx.drawImage(source.image,x,y,crop,crop,0,0,384,384);
  for(const q of [.84,.70,.55,.4]){
   const blob=await canvasToWebp(canvas,q);
   if(blob.size<=MAX_UPLOADED_AVATAR_BYTES)return blob;
  }
  throw Error('تعذر ضغط هذه الصورة بما يكفي. اختر صورة أخرى.');
 }finally{source.close()}
}

export async function uploadTeamAvatar(file){
 const {supabase}=await import('./supabase.js');
 if(!supabase)throw Error('الاتصال بالتخزين غير متاح حاليًا.');
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw Error('سجّل الدخول بحساب المشرف لرفع الصور.');
 const image=await createTeamAvatarThumbnail(file);
 const path='team/'+crypto.randomUUID()+'.webp';
 const {error}=await supabase.storage.from(TEAM_AVATAR_BUCKET)
  .upload(path,image,{contentType:'image/webp',cacheControl:'3600',upsert:false});
 if(error)throw Error('تعذّر رفع الصورة: '+(error.message||'تحقق من اتصال الشبكة وصلاحيات الحساب.'));
 return path;
}

export async function deleteUnusedTeamAvatars(paths=[]){
 const valid=[...new Set(paths.filter(validTeamAvatarPath))];
 if(!valid.length)return;
 const {supabase}=await import('./supabase.js');
 if(!supabase)return;
 const {error}=await supabase.storage.from(TEAM_AVATAR_BUCKET).remove(valid);
 if(error)throw error;
}
