import {useEffect,useRef} from 'react';
const subscribers=new Set();
let nextId=0;
export function notifyUser(message,type='info'){
 if(!message)return;
 const item={id:++nextId,message:String(message).slice(0,500),type:['success','error','warning','info'].includes(type)?type:'info'};
 for(const fn of subscribers)fn(item);
}
export function subscribeNotifications(fn){subscribers.add(fn);return ()=>subscribers.delete(fn)}
export function useNotice(message,type='info'){
 const last=useRef('');
 useEffect(()=>{if(message&&message!==last.current)notifyUser(message,type);last.current=message||''},[message,type]);
}
