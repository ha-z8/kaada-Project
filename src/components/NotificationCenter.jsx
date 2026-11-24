import {useEffect,useState,useRef} from 'react';
import {CheckCircle2,AlertTriangle,Info,X} from 'lucide-react';
import {subscribeNotifications} from '../lib/notifications.js';
const labels={success:'تم بنجاح',error:'تعذّر التنفيذ',warning:'تنبيه',info:'إشعار'};
function Toast({item,onClose}){
 useEffect(()=>{const id=setTimeout(()=>onClose(item.id),item.type==='error'?7500:4700);return ()=>clearTimeout(id)},[item.id,onClose]);
 const Icon=item.type==='success'?CheckCircle2:item.type==='error'||item.type==='warning'?AlertTriangle:Info;
 return <div className={'hsa-toast hsa-toast-'+item.type} role={item.type==='error'?'alert':'status'}>
  <Icon size={21}/><div><strong>{labels[item.type]}</strong><p dir="auto">{item.message}</p></div><button type="button" onClick={()=>onClose(item.id)} aria-label="إغلاق الإشعار"><X size={17}/></button>
 </div>;
}
export default function NotificationCenter(){
 const [items,setItems]=useState([]);
 const remove=useRef(id=>setItems(prev=>prev.filter(x=>x.id!==id))).current;
 useEffect(()=>subscribeNotifications(item=>setItems(prev=>[...prev.filter(x=>x.message!==item.message||x.type!==item.type),item].slice(-4))),[]);
 return <div className="hsa-notification-stack" dir="rtl" aria-label="إشعارات المنصة">{items.map(item=><Toast key={item.id} item={item} onClose={remove}/>)}</div>;
}
