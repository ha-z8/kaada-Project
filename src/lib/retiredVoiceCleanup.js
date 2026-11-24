/**
 * One-time per browser-profile removal of retired Piper voice downloads.
 *
 * Scope is intentionally narrow: two app-owned OPFS model directories and
 * one Piper runtime Cache Storage bucket. Never delete generic caches,
 * IndexedDB, study content, recordings, login data or OS-installed voices.
 */
const CLEANUP_KEY='hsa-retired-piper-downloads-cleaned-v1';
const OLD_MODEL_DIRS=['hsa-voice-models-v2','piper'];
const OLD_RUNTIME_CACHE='hsa-tts-runtime-v1';

export async function cleanupRetiredVoiceDownloads(){
 if(typeof window==='undefined')return false;
 try{
  if(window.localStorage?.getItem(CLEANUP_KEY)==='true')return true;
 }catch{/* Storage may be restricted; try cleanup without a marker. */}
 let success=true;
 if(navigator.storage?.getDirectory){
  try{
   const root=await navigator.storage.getDirectory();
   for(const directory of OLD_MODEL_DIRS){
    try{
     await root.removeEntry(directory,{recursive:true});
    }catch(error){
     if(error?.name!=='NotFoundError')success=false;
    }
   }
  }catch{success=false}
 }
 if(typeof caches!=='undefined'){
  try{await caches.delete(OLD_RUNTIME_CACHE)}
  catch{success=false}
 }
 if(success){
  try{window.localStorage?.setItem(CLEANUP_KEY,'true')}catch{}
 }
 return success;
}
