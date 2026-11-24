import {useState,useEffect} from 'react';
import {Languages,Download} from 'lucide-react';
import {notifyUser} from '../lib/notifications.js';
import {localTranslationReady,prepareLocalTranslation} from '../lib/localTranslation.js';
import {LOCAL_TRANSLATION_EVENT} from '../lib/localTranslationConfig.js';
import HsaLoader from './HsaLoader.jsx';
export default function LocalTranslationSetup(){
 const [ready,setReady]=useState(false),[stage,setStage]=useState(''),[confirm,setConfirm]=useState(false);
 useEffect(()=>{let alive=true;const update=()=>localTranslationReady().then(r=>{if(alive)setReady(r)});update();window.addEventListener(LOCAL_TRANSLATION_EVENT,update);return()=>{alive=false;window.removeEventListener(LOCAL_TRANSLATION_EVENT,update)}},[]);
 const prepare=async()=>{if(stage)return;setConfirm(false);setStage('runtime');try{await prepareLocalTranslation(setStage);setReady(true);notifyUser('تم تجهيز الترجمة المحلية واختبارها.','success')}catch(e){setReady(false);notifyUser(e?.message||'تعذّر تجهيز المترجم.','error')}finally{setStage('')}};
 return <div className="compat-voice-setup"><strong><Languages size={15}/> ترجمة دون إنترنت</strong><button className="outline-btn" disabled={!!stage} onClick={()=>setConfirm(v=>!v)}>{stage?<HsaLoader size={17}/>:<Download size={15}/>} {stage?({runtime:'تجهيز المحرك',model:'تنزيل نموذج الترجمة',verify:'اختبار الترجمة المحلية'}[stage]):ready?'المترجم جاهز · إعادة التحقق':'تجهيز الترجمة المحلية'}</button>{confirm&&<div className="compat-voice-confirm"><p>تنزيل اختياري لمترجم إنجليزي–عربي يعمل داخل الجهاز. يحتاج نحو 200–300 ميجابايت ومساحة إضافية أثناء التهيئة. الترجمة آلية وقد تحتاج مراجعة.</p><button className="primary-btn" onClick={prepare}>تأكيد التنزيل</button><button className="outline-btn" onClick={()=>setConfirm(false)}>إلغاء</button></div>}</div>
}
