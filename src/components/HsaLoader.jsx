/** Shared, locally available branded loading indicator. */
export default function HsaLoader({size=24,progress,label}){
 const determinate=Number.isFinite(progress);
 const value=determinate?Math.min(100,Math.max(0,progress)):null;
 const accessible=determinate||Boolean(label);
 return <span className={'hsa-loader'+(determinate?' hsa-loader-determinate':'')}
  style={{'--hsa-size':Math.max(18,size)+'px',...(determinate?{'--hsa-progress':value+'%'}:{})}}
  role={determinate?'progressbar':label?'status':undefined} aria-label={accessible?(label||'جارٍ التحميل'):undefined}
  aria-valuemin={determinate?0:undefined} aria-valuemax={determinate?100:undefined}
  aria-valuenow={determinate?Math.round(value):undefined} aria-hidden={accessible?undefined:true}>
  <img src="/favicon.svg" alt="" draggable={false}/>
 </span>;
}
