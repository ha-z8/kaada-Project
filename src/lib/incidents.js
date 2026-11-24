// Never store request bodies, URLs, tokens, stack traces or arbitrary error messages.
const sources=new Set(['database','hosting','accounts','audio','network','frontend','storage','ai']);
const kinds=new Set(['http','network','runtime','operation','health']);
const pages=new Set(['home','reader','about','accounts','site-settings','my-account','incidents']);
let active=false,page='unknown',pending=[],recent=new Map(),write=null,installed=false;
export function setIncidentContext(enabled,currentPage,writer){
 active=enabled;page=pages.has(currentPage)?currentPage:'unknown';write=writer||null;
 if(!enabled){pending=[];recent.clear();}
 else void flushIncidents();
}
let flushing=false;
export async function flushIncidents(){
 if(flushing||!active||!write||!pending.length||navigator.onLine===false)return;
 flushing=true;const batch=pending.slice(0,20);
 try{const result=await write(batch);if(!result?.error)pending=pending.filter(x=>!batch.includes(x))}
 catch{}finally{flushing=false}
}
export function recordIncident(source,kind,status=null){
 if(!active||!sources.has(source)||!kinds.has(kind))return;
 if(!Number.isInteger(status)||status<100||status>599)status=null;
 const key=[source,kind,status,page].join('|'),now=Date.now();
 if(now-(recent.get(key)||0)<15000)return;
 if(recent.size>150)recent.clear();
 recent.set(key,now);pending.push({source,kind,status,page});pending=pending.slice(-100);void flushIncidents();
}
export function pendingIncidents(){return pending.map(x=>({...x}))}
export function classifyRequest(input,origin){
 try{
  const u=new URL(typeof input==='string'||input instanceof URL?input:input.url,origin);
  if(u.hostname==='oaihjgmmoxvunuxtucin.supabase.co'){
   if(u.pathname.includes('/platform_incidents'))return null;
   if(u.pathname.includes('/account-control')||u.pathname.startsWith('/auth/'))return 'accounts';
   if(u.pathname.startsWith('/storage/'))return 'storage';
   return 'database';
  }
  if(u.hostname==='kaada-study-ai.kaada-p.workers.dev'||u.pathname.includes('/generate-explanation'))return 'ai';
  if(u.origin===origin)return 'hosting';
 }catch{}
 return null;
}
export function installIncidentCapture(){
 if(installed||typeof window==='undefined')return;
 installed=true;const original=window.fetch.bind(window);
 window.fetch=async function(input,init){
  const source=classifyRequest(input,window.location.origin);
  try{const result=await original(input,init);if(source&&!result.ok)recordIncident(source,'http',result.status);return result}
  catch(error){if(source&&error?.name!=='AbortError')recordIncident(source,'network');throw error}
 };
 window.addEventListener('error',e=>recordIncident(e.target!==window?'hosting':'frontend','runtime'),true);
 window.addEventListener('unhandledrejection',()=>recordIncident('frontend','runtime'));
 window.addEventListener('offline',()=>recordIncident('network','network'));
 window.addEventListener('online',()=>void flushIncidents());
 window.addEventListener('hsa:online-voice-unavailable',()=>recordIncident('audio','operation'));
}
