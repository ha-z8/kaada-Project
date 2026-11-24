import {useState} from 'react';
import {Download,Headphones} from 'lucide-react';
import {prepareIndependentVoice,readPreparedVoiceFlags} from '../lib/speech.js';
import {notifyUser} from '../lib/notifications.js';
import HsaLoader from './HsaLoader.jsx';
export default function VoiceCompatibilitySetup({languages=['ar','en'],onPrepared}){
 const [busy,setBusy]=useState(''),[confirm,setConfirm]=useState(''),[ready,setReady]=useState(readPreparedVoiceFlags);
 const prepare=async lang=>{if(busy)return;setConfirm('');setBusy(lang);try{const id=await prepareIndependentVoice(lang);setReady(readPreparedVoiceFlags());onPrepared?.(lang,id);notifyUser('تم تجهيز الصوت '+(lang==='ar'?'العربي':'الإنجليزي')+'. جرّبه من المشغل.','success')}catch(e){notifyUser(e?.message||'تعذّر تجهيز الصوت.','error')}finally{setBusy('')}};
 return <div className="compat-voice-setup"><strong><Headphones size={15}/> صوت مستقل</strong>{languages.map(lang=><button key={lang} className="outline-btn" disabled={!!busy} onClick={()=>setConfirm(lang)}>{busy===lang?<HsaLoader size={17}/>:<Download size={15}/>} {ready[lang]?'إعادة تجهيز الصوت':'تجهيز الصوت'} {lang==='ar'?'العربي':'الإنجليزي'}</button>)}{confirm&&<div className="compat-voice-confirm" role="dialog" aria-label="تأكيد تجهيز الصوت"><p>يتطلب تنزيل نموذج صوتي بحجم نحو 64 ميجابايت وملفات التشغيل عند الاستخدام الأول. يُحفظ على جهازك ولا يحتاج اشتراكًا.</p><button className="primary-btn" onClick={()=>prepare(confirm)}>تأكيد التنزيل</button><button className="outline-btn" onClick={()=>setConfirm('')}>إلغاء</button></div>}</div>;
}
