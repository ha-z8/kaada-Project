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

const STAFF_AVATAR_PATH=/^staff\/[0-9a-f-]{36}\/[0-9a-f-]{36}[.]webp$/i;
export const validStaffAvatarPath=path=>typeof path==='string'&&STAFF_AVATAR_PATH.test(path);
export const validAccountAvatarPath=path=>validTeamAvatarPath(path)||validStaffAvatarPath(path);
function avatarPublicUrl(path){
 const base=(import.meta.env?.VITE_SUPABASE_URL||PUBLIC_SUPABASE_URL).replace(/\/+$/,'');
 return base+'/storage/v1/object/public/'+TEAM_AVATAR_BUCKET+'/'+path;
}
export function teamAvatarPublicUrl(path){
 return validTeamAvatarPath(path)?avatarPublicUrl(path):'';
}
export function accountAvatarPublicUrl(path){
 return validAccountAvatarPath(path)?avatarPublicUrl(path):'';
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

// Keep the *whole* original photo at its natural aspect ratio. The crop, height,
// focus and zoom are adjusted non-destructively inside the visible team card.
export function avatarFullImageSize(sourceWidth,sourceHeight,maxEdge=960){
 if(!(sourceWidth>0&&sourceHeight>0&&maxEdge>0))throw Error('أبعاد الصورة غير صحيحة.');
 const ratio=Math.min(1,maxEdge/Math.max(sourceWidth,sourceHeight));
 return {width:Math.max(1,Math.round(sourceWidth*ratio)),
         height:Math.max(1,Math.round(sourceHeight*ratio))};
}
export async function createTeamAvatarThumbnail(file){
 validateAvatarFile(file);
 if(typeof document==='undefined')throw Error('معالجة الصور تتطلب متصفحًا يدعم الصور.');
 const source=await readImage(file);
 try{
  if(!source.width||!source.height)throw Error('أبعاد الصورة غير صحيحة.');
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('تعذر تجهيز الصورة في المتصفح.');
  for(const edge of [960,800,640,512]){
   const {width,height}=avatarFullImageSize(source.width,source.height,edge);
   canvas.width=width;canvas.height=height;
   ctx.imageSmoothingEnabled=true;
   ctx.imageSmoothingQuality='high';
   ctx.fillStyle='#fff';
   ctx.fillRect(0,0,width,height);
   ctx.drawImage(source.image,0,0,source.width,source.height,0,0,width,height);
   for(const quality of [.84,.70,.54,.40]){
    const blob=await canvasToWebp(canvas,quality);
    if(blob.size<=MAX_UPLOADED_AVATAR_BYTES)return blob;
   }
  }
  throw Error('تعذّر ضغط الصورة بما يكفي. اختر صورة أخرى.');
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

/** Personal upload paths are generated in the logged-in user's folder, enforced by Storage RLS. */
export async function uploadAccountAvatar(file,targetUserId){
 const {supabase}=await import('./supabase.js');
 if(!supabase)throw Error('الاتصال بالتخزين غير متاح حاليًا.');
 validateAvatarFile(file);
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw Error('سجّل الدخول بحساب عضو التدريس أو المشرف لرفع صورتك.');
 const image=await createTeamAvatarThumbnail(file);
 if(targetUserId&&(!/^[0-9a-f-]{36}$/i.test(targetUserId)))throw Error('معرّف الحساب غير صحيح.');
 const path='staff/'+(targetUserId||user.id)+'/'+crypto.randomUUID()+'.webp';
 const {error}=await supabase.storage.from(TEAM_AVATAR_BUCKET).upload(
  path,image,{contentType:'image/webp',cacheControl:'3600',upsert:false}
 );
 if(error)throw Error('تعذّر رفع الأفتار: '+(error.message||'تحقق من الصلاحيات وحجم الصورة.'));
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
