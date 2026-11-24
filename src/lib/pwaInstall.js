let deferredPrompt=null;
export const PWA_INSTALL_EVENT='hsa:pwa-install-change';
export function isAppInstalled(win=globalThis.window,nav=globalThis.navigator){return Boolean(win?.matchMedia?.('(display-mode: standalone)').matches||nav?.standalone===true);}
export function hasInstallPrompt(){return Boolean(deferredPrompt);}
function update(){window.dispatchEvent(new Event(PWA_INSTALL_EVENT));}
export function captureInstallPrompt(){
 if(typeof window==='undefined')return;
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;update();});
 window.addEventListener('appinstalled',()=>{deferredPrompt=null;update();});
}
export async function installFromBrowser(){
 const prompt=deferredPrompt;if(!prompt)return 'manual';
 deferredPrompt=null;update();
 await prompt.prompt();
 const result=await prompt.userChoice;return result?.outcome||'dismissed';
}
export function installationGuide(nav=globalThis.navigator){
 const ua=nav?.userAgent||'';
 if(/iPhone|iPad|iPod/i.test(ua)||/Mac/i.test(ua)&&Number(nav?.maxTouchPoints)>1)return 'افتح قائمة المشاركة في Safari، ثم «إضافة إلى الشاشة الرئيسية»، وفعّل «فتح كتطبيق ويب» إن ظهر الخيار.';
 if(/Mac/i.test(ua)&&/Safari/i.test(ua)&&!/Chrome|Chromium|Edg/i.test(ua))return 'في Safari اختر مشاركة، ثم «إضافة إلى Dock».';
 if(/Android/i.test(ua))return 'من قائمة المتصفح ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».';
 return 'من شريط العنوان أو قائمة المتصفح في Chrome أو Edge اختر تثبيت التطبيق. إذا لم يظهر الخيار، يمكنك استخدام المنصة في المتصفح.';
}
