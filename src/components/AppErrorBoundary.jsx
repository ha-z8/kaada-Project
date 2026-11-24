import React from 'react';

/** Prevent one unexpected render exception from blanking the entire platform.
 * Never remove OPFS, IndexedDB, or students' offline drafts as "recovery".
 */
export default class AppErrorBoundary extends React.Component{
 constructor(props){
  super(props);
  this.state={failed:false};
 }
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error,info){
  console.error('HSA interface error:',error,info?.componentStack||'');
 }
 render(){
  if(!this.state.failed)return this.props.children;
  return <main dir="rtl" role="alert" style={{
   minHeight:'100dvh',display:'grid',placeItems:'center',padding:'24px',
   background:'#f6f8f7',fontFamily:'system-ui,-apple-system,sans-serif',color:'#123b2a'
  }}>
   <section style={{
    width:'min(100%,520px)',padding:'clamp(20px,5vw,34px)',
    border:'1px solid #d9e5dc',borderRadius:'18px',background:'white',
    boxShadow:'0 16px 40px rgba(0,0,0,.07)'
   }}>
    <h1 style={{fontSize:'22px',margin:'0 0 12px'}}>تعذّر عرض أحد أجزاء المنصة</h1>
    <p style={{lineHeight:1.9,fontSize:'14px'}}>
     لم تُحذف ملفاتك أو بيانات الدراسة المحفوظة. جرّب إعادة تحميل الصفحة،
     وإن استمرت المشكلة يمكنك الرجوع إلى المكتبة بعد التحديث.
    </p>
    <button type="button" onClick={()=>window.location.reload()} style={{
     cursor:'pointer',background:'#136a4b',color:'white',border:0,
     borderRadius:'9px',padding:'12px 20px',fontSize:'14px',fontWeight:700
    }}>إعادة تحميل المنصة</button>
   </section>
  </main>;
 }
}
