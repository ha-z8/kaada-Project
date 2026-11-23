// Visible ownership banner for browser developer tools.
// It is a copyright notice, NOT an access-control mechanism.
export const CONSOLE_COPYRIGHT_TEXT='جميع حقوق الأكواد محفوظة لدى © 2026 | هزاع الهزاع — hazzaa alhazzaa';

const PALETTE={
  heading:'background:#11381d;color:#fedc00;font-size:20px;font-weight:900;padding:12px 18px;border-radius:8px;font-family:Tahoma,Arial,sans-serif;',
  rights:'background:#11381d;color:#c2dbc9;font-size:14px;font-weight:800;padding:9px 13px;font-family:Tahoma,Arial,sans-serif;',
  accent:'background:#00804a;color:#fff;font-size:12px;font-weight:700;padding:6px 10px;font-family:Tahoma,Arial,sans-serif;',
  muted:'background:#edf5ef;color:#11381d;font-size:11px;font-weight:650;padding:5px 9px;font-family:Tahoma,Arial,sans-serif;'
};

export function copyrightConsoleLines(){
 const tagline='حقوق النشر والتصميم والبرمجة محفوظة لمطور المنصة.';
 const sequence=[
  {text:'  HSA 4 STUDY  |  HAZZAA ALHAZZAA  ',style:'heading'},
  {text:CONSOLE_COPYRIGHT_TEXT,style:'rights'},
  {text:'━━━━━━━━━━━━━━━━━━  منصة HSA 4 Study  ━━━━━━━━━━━━━━━━━━',style:'accent'},
  {text:'© 2026  |  حقوق النشر محفوظة',style:'muted'},
  {text:'التصميم والبرمجة: هزاع الهزاع',style:'muted'},
  {text:'Developer: hazzaa alhazzaa',style:'muted'},
  {text:'  HSA 4 Study · All Rights Reserved  ',style:'accent'},
  {text:CONSOLE_COPYRIGHT_TEXT,style:'rights'},
  {text:'هذه الرسائل إشعار بالحقوق وليست آلية لإخفاء الشيفرة.',style:'muted'},
  {text:'الحقوق محفوظة لصاحب المشروع.',style:'muted'},
  {text:'© HSA 4 Study — 2026',style:'accent'},
  {text:CONSOLE_COPYRIGHT_TEXT,style:'rights'},
  {text:'تم تطوير واجهة المنصة وبرمجتها بعناية.',style:'muted'},
  {text:'جميع حقوق التصميم محفوظة.',style:'muted'},
  {text:'جميع حقوق البرمجة محفوظة.',style:'muted'},
  {text:'  hazzaa alhazzaa  |  HSA 4 STUDY  ',style:'accent'},
  {text:CONSOLE_COPYRIGHT_TEXT,style:'rights'},
  {text:tagline,style:'muted'},
  {text:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',style:'accent'},
  {text:CONSOLE_COPYRIGHT_TEXT,style:'heading'}
 ];
 return sequence;
}

export function showCopyrightConsole(logger=console,production=Boolean(import.meta.env?.PROD)){
 if(!production)return 0;
 const lines=copyrightConsoleLines();
 for(const line of lines)logger.log('%c'+line.text,PALETTE[line.style]);
 return lines.length;
}
