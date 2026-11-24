// Durable, per-browser IndexedDB cache and outbox.
// Never fall back to "saved" when storage is unavailable or quota is exhausted.
export const OFFLINE_DB_NAME='hsa-study-offline-v1';
export const OFFLINE_DB_VERSION=2;
export const OFFLINE_CHANGE_EVENT='hsa-offline-queue-changed';
let pendingOpen;

export function openOfflineDatabase(){
 if(typeof indexedDB==='undefined')return Promise.reject(Error('المتصفح لا يدعم التخزين الدائم دون إنترنت.'));
 if(!pendingOpen)pendingOpen=new Promise((resolve,reject)=>{
  const req=indexedDB.open(OFFLINE_DB_NAME,OFFLINE_DB_VERSION);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'key'});
   if(!db.objectStoreNames.contains('media'))db.createObjectStore('media',{keyPath:'key'});
   if(!db.objectStoreNames.contains('outbox')){
    const out=db.createObjectStore('outbox',{keyPath:'operationId'});
    out.createIndex('userId','userId',{unique:false});
   }
  };
  req.onerror=()=>reject(req.error||Error('تعذّر فتح التخزين المحلي.'));
  req.onblocked=()=>reject(Error('أغلق التبويبات القديمة من المنصة لتحديث التخزين المحلي.'));
  req.onsuccess=()=>{
   const db=req.result;
   db.onversionchange=()=>{db.close();pendingOpen=null};
   resolve(db);
  };
 }).catch(error=>{pendingOpen=null;throw error});
 return pendingOpen;
}
async function operation(store,mode,method,payload){
 const db=await openOfflineDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode);
  let answer;
  tx.oncomplete=()=>resolve(answer);
  tx.onabort=()=>reject(tx.error||Error('تعذّر حفظ البيانات على الجهاز.'));
  tx.onerror=()=>{};
  const req=tx.objectStore(store)[method](...payload);
  req.onsuccess=()=>{answer=req.result};
 });
}
const get=(s,key)=>operation(s,'readonly','get',[key]);
const put=(s,entry)=>operation(s,'readwrite','put',[entry]);
const del=(s,key)=>operation(s,'readwrite','delete',[key]);
const all=s=>operation(s,'readonly','getAll',[]);
function changed(){
 if(typeof window!=='undefined')window.dispatchEvent(new Event(OFFLINE_CHANGE_EVENT));
}
export function libraryCacheKey(userId,privateData=false){
 return privateData&&userId?'library:staff:'+userId:'library:public';
}
export async function readOfflineSnapshot(key){
 const row=await get('snapshots',key);
 return row?.value??null;
}
export async function saveOfflineSnapshot(key,value){
 await put('snapshots',{key,value,savedAt:Date.now()});
 changed();
 return value;
}
export async function removeOfflineSnapshot(key){await del('snapshots',key)}
/** Offline audio is stored per authenticated account, not in the public service-worker cache. */
export function offlineAudioKey(userId,path){
 if(!userId||!path||typeof path!=='string')throw Error('مفتاح التسجيل المحلي غير صالح.');
 return 'study-audio:'+userId+':'+path;
}
export async function readOfflineAudio(userId,path){
 const row=await get('media',offlineAudioKey(userId,path));
 return row?.audio instanceof Blob?row.audio:null;
}
export async function saveOfflineAudio(userId,path,audio){
 if(!(audio instanceof Blob)||audio.size===0)throw Error('ملف الصوت ناقص ولا يمكن حفظه.');
 await put('media',{key:offlineAudioKey(userId,path),audio,savedAt:Date.now()});
 changed();
 return audio;
}
export async function clearStaffAudio(userId){
 if(!userId)return;
 const db=await openOfflineDatabase();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('media','readwrite');
  const request=tx.objectStore('media').openCursor();
  const prefix='study-audio:'+userId+':';
  request.onsuccess=()=>{
   const cursor=request.result;
   if(!cursor)return;
   if(String(cursor.key).startsWith(prefix)||String(cursor.key).startsWith('study-document:'+userId+':'))cursor.delete();
   cursor.continue();
  };
  tx.oncomplete=resolve;
  tx.onerror=()=>reject(tx.error||Error('تعذّر مسح التسجيلات المحلية.'));
  tx.onabort=()=>reject(tx.error||Error('تعذّر مسح التسجيلات المحلية.'));
 });
}
async function clearDocumentAttachmentSnapshots(userId){
 const db=await openOfflineDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');const req=tx.objectStore('snapshots').openCursor();req.onsuccess=()=>{const cursor=req.result;if(!cursor)return;if(String(cursor.key).startsWith('document-attachment:'+userId+':'))cursor.delete();cursor.continue()};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});
}
export async function clearStaffSnapshots(userId){
 if(!userId)return;
 try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('hsa-document-marks:'+userId+':'))localStorage.removeItem(key)}}catch{}
 await Promise.all([
  removeOfflineSnapshot(libraryCacheKey(userId,true)),
  removeOfflineSnapshot('profile:'+userId),
  removeOfflineSnapshot('accounts:admin:'+userId),
  removeOfflineSnapshot('site-owner:'+userId),
  removeOfflineSnapshot('site-edit-permissions:'+userId),
  clearStaffAudio(userId),clearDocumentAttachmentSnapshots(userId)
 ]);
 try{localStorage.removeItem('hsa-offline-role:'+userId)}catch{}
}
// Outbox items deliberately contain neither access tokens nor passwords.
export function createOfflineEdit({userId,entity,recordId,patch,base,operationId}){
 if(!userId||!recordId||!['subjects','subjects:create','lessons','sections','site_settings'].includes(entity))
  throw Error('لا يمكن تجهيز تغيير دون حساب موظف ونوع بيانات معروف.');
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length)
  throw Error('لا توجد بيانات متغيرة لحفظها.');
 const expected={};
 if(entity!=='subjects:create'){
  for(const key of Object.keys(patch)){
   if(!base||!Object.hasOwn(base,key))throw Error('لا توجد نسخة مرجعية للحقل '+key+'؛ افتح الدرس متصلًا قبل تعديله.');
   expected[key]=base[key]??null;
  }
 }
 return {
  operationId:operationId||crypto.randomUUID(),
  userId,entity,recordId:String(recordId),
  patch:structuredClone(patch),expected:structuredClone(expected),
  createdAt:new Date().toISOString(),status:'pending',
  attemptCount:0,lastError:'',server:null
 };
}
export async function queueOfflineEdit(input){
 const entry=createOfflineEdit(input);
 await put('outbox',entry);
 changed();
 return entry;
}
export async function listOfflineEdits(userId){
 if(!userId)return [];
 const records=await all('outbox');
 return records.filter(item=>item.userId===userId).sort((a,b)=>
  a.createdAt.localeCompare(b.createdAt)||a.operationId.localeCompare(b.operationId));
}
export async function updateOfflineEdit(entry){
 await put('outbox',entry);changed();return entry;
}
export async function removeOfflineEdit(id){await del('outbox',id);changed()}
export async function resolveOfflineConflict(userId,operationId,action){
 const item=(await listOfflineEdits(userId)).find(x=>x.operationId===operationId);
 if(!item)throw Error('التغيير المطلوب غير موجود.');
 if(action==='discard'){await removeOfflineEdit(operationId);return}
 if(action!=='retry'||item.status!=='conflict'||!item.server)throw Error('لا توجد نسخة خادم متعارضة لتحديثها.');
 const expected=Object.fromEntries(Object.keys(item.patch).map(key=>[key,item.server[key]??null]));
 await updateOfflineEdit({...item,expected,server:null,status:'pending',lastError:'',attemptCount:0});
}
export function overlayOfflineEdits(library,items){
 const next={...library,subjects:[...(library.subjects||[])],
  lessons:[...(library.lessons||[])],sections:[...(library.sections||[])]};
 for(const item of items){
  if(item.status==='error')continue;
  const name=item.entity==='subjects:create'?'subjects':item.entity;
  if(!['subjects','lessons','sections'].includes(name))continue;
  const rows=next[name];
  const index=rows.findIndex(row=>String(row.id)===item.recordId);
  if(index<0&&item.entity==='subjects:create'){
   rows.push({id:item.recordId,...item.patch,created_at:item.createdAt,offline_pending:true});
  }else if(index>=0){
   rows[index]={...rows[index],...item.patch,offline_pending:true};
  }
 }
 return next;
}

export async function readOfflineDocument(scope,path){
 const row=await get('media','study-document:'+scope+':'+path);
 return row?.document instanceof Blob?row.document:null;
}
export async function saveOfflineDocument(scope,path,document){
 if(!(document instanceof Blob)||!document.size||document.size>30*1024*1024)throw Error('ملف غير صالح أو أكبر من 30 ميجابايت.');
 await put('media',{key:'study-document:'+scope+':'+path,document,savedAt:Date.now()});
 return document;
}
