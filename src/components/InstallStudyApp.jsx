import {useEffect,useState} from 'react';
import {Download,Smartphone} from 'lucide-react';
import {hasInstallPrompt,isAppInstalled,installFromBrowser,installationGuide,PWA_INSTALL_EVENT} from '../lib/pwaInstall.js';
import {notifyUser} from '../lib/notifications.js';
export default function InstallStudyApp(){
 const [installed,setInstalled]=useState(isAppInstalled),[available,setAvailable]=useState(hasInstallPrompt),[guide,setGuide]=useState(false);
 useEffect(()=>{const update=()=>{setInstalled(isAppInstalled());setAvailable(hasInstallPrompt());};window.addEventListener(PWA_INSTALL_EVENT,update);const mode=window.matchMedia?.('(display-mode: standalone)');mode?.addEventListener?.('change',update);update();return()=>{window.removeEventListener(PWA_INSTALL_EVENT,update);mode?.removeEventListener?.('change',update);};},[]);
 if(installed)return null;
 const install=async()=>{if(!available){setGuide(v=>!v);return;}try{const outcome=await installFromBrowser();if(outcome==='accepted')notifyUser('تم قبول تثبيت التطبيق. افتحه من جهازك لإكمال تجهيز المحتوى.','success');else if(outcome==='manual')setGuide(true);}catch{setGuide(true);}};
 return <div className="study-install"><button className="outline-btn" type="button" aria-label="تثبيت التطبيق" onClick={install}><Download size={16}/> تثبيت التطبيق</button>{guide&&<div className="study-install-guide"><strong><Smartphone size={16}/> التثبيت من المتصفح</strong><p>{installationGuide()}</p><button className="outline-btn" onClick={()=>setGuide(false)}>إغلاق</button></div>}</div>;
}
