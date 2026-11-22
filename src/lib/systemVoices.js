// Keep the learner-facing voice catalogue short and independent of provider names.
// Labels are KAADA UI aliases, not claims about a voice's identity or quality.
const LABELS={
  ar:['سَنا','أثير','مَزن'],
  en:['Ava','Leo','Mia'],
};
const REGION={ar:['ar-SA','ar'],en:['en-US','en-GB','en']};
export function friendlySystemVoices(available,language,max=3){
  if(!['ar','en'].includes(language))return [];
  const voices=(Array.isArray(available)?available:[])
    .filter(v=>v&&typeof v.name==='string'&&typeof v.lang==='string'&&v.lang.toLowerCase().startsWith(language))
    .map(v=>({...v,lang:v.lang.toLowerCase()}));
  const region=REGION[language];
  const priority=v=>{
    const name=v.name.toLowerCase();
    const rank=region.findIndex(r=>v.lang===r.toLowerCase());
    const localeScore=rank<0?0:(region.length-rank)*3;
    return localeScore+(/natural|neural|enhanced|high.?quality/i.test(name)?12:0);
  };
  const sorted=voices.map((v,i)=>({...v,_order:i,_rank:priority(v)}))
    .sort((a,b)=>b._rank-a._rank||a._order-b._order);
  const seen=new Set();
  const unique=sorted.filter(v=>{
    if(seen.has(v.name))return false;
    seen.add(v.name);return true;
  });
  return unique.slice(0,Math.max(0,Math.min(max,3))).map((v,i)=>({
    id:v.name,language,lang:v.lang,label:LABELS[language][i],
  }));
}
