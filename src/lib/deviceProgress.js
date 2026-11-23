// Progress belongs to the current browser/device, never to an account or the server.
export const DEVICE_PROGRESS_KEY='hsa-device-study-progress-v1';
const safeText=v=>typeof v==='string'?v:'';
export function normalizeDeviceProgress(raw){
 const records=Array.isArray(raw)?raw:Object.values(raw&&typeof raw==='object'?raw:{});
 const unique=new Map();
 for(const item of records.slice(-2000)){
  if(!item||typeof item!=='object')continue;
  const lesson_id=safeText(item.lesson_id).slice(0,80);
  const section_id=safeText(item.section_id).slice(0,80);
  if(!lesson_id||!section_id)continue;
  const audio_track=['mixed','en','ar'].includes(item.audio_track)?item.audio_track:'mixed';
  const n=Number(item.speed);
  const speed=Number.isFinite(n)?Math.min(2,Math.max(.75,n)):1;
  unique.set(lesson_id,{lesson_id,section_id,audio_track,speed,
   updated_at:safeText(item.updated_at)||new Date(0).toISOString()});
 }
 return [...unique.values()].slice(-500);
}
export function readDeviceProgress(storage=globalThis.localStorage){
 try{return normalizeDeviceProgress(JSON.parse(storage.getItem(DEVICE_PROGRESS_KEY)||'[]'))}
 catch{return []}
}
export function writeDeviceProgress(lessonId,sectionId,track='mixed',speed=1,storage=globalThis.localStorage){
 if(!lessonId||!sectionId)return readDeviceProgress(storage);
 const now=new Date().toISOString();
 const other=readDeviceProgress(storage).filter(p=>p.lesson_id!==lessonId);
 const result=normalizeDeviceProgress([...other,{lesson_id:lessonId,section_id:sectionId,audio_track:track,speed,updated_at:now}]);
 try{storage.setItem(DEVICE_PROGRESS_KEY,JSON.stringify(result))}catch{}
 return result;
}
