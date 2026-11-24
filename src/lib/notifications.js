import {useEffect,useRef} from 'react';
const subscribers=new Set();
let nextId=0;
export function notifyUser(message,type='info'){
 if(!message)return;
 const raw=String(message);
 const visible=/Unable to create translator|NotSupportedError|NotAllowedError|Translator\.create/i.test(raw)?'تعذّر تجهيز الترجمة على هذا الجهاز. أعد المحاولة.':/supabase|netlify|postgres|indexeddb|opfs|stack trace|service.role|jwt|https?:\/\/|functionsfetcherror|failed to fetch|permission denied for|violates row.level security/i.test(raw)
  ?'تعذّر إكمال العملية. حاول مرة أخرى.':raw;
 const item={id:++nextId,message:visible.slice(0,500),type:['success','error','warning','info'].includes(type)?type:'info'};
 for(const fn of subscribers)fn(item);
}
export function subscribeNotifications(fn){subscribers.add(fn);return ()=>subscribers.delete(fn)}
export function useNotice(message,type='info'){
 const last=useRef('');
 useEffect(()=>{if(message&&message!==last.current)notifyUser(message,type);last.current=message||''},[message,type]);
}
