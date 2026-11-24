/**
 * Heavy Piper neural synthesis MUST never run on the UI thread.
 * Vite bundles this module worker and its WASM/phonemizer dependencies
 * separately, and the PWA precaches the worker bundle for offline use.
 */
import {synthesizePiper} from './piperEngine.js';
self.onmessage=async event=>{
 const {id,text,modelKey,modelBlob,config,speakerId}=event.data||{};
 if(typeof id!=='number')return;
 try{
  const audio=await synthesizePiper(text,modelKey,modelBlob,config,speakerId);
  self.postMessage({id,ok:true,audio});
 }catch(error){
  self.postMessage({id,ok:false,error:String(error?.message||error)});
 }
};
