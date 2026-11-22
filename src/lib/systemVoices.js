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
  const capped=Math.max(0,Math.min(max,3));
  const recommended=[];
  // In Arabic, prefer a balanced selection when the browser actually has
  // clearly identified voices of both types.
  if(language==='ar'&&capped>=2){
    const woman=unique.find(v=>classifyVoiceGender(v,language)==='female');
    const man=unique.find(v=>classifyVoiceGender(v,language)==='male');
    if(woman)recommended.push(woman);
    if(man&&man.name!==woman?.name)recommended.push(man);
  }
  for(const voice of unique){
    if(recommended.length>=capped)break;
    if(!recommended.some(v=>v.name===voice.name))recommended.push(voice);
  }
  return recommended.slice(0,capped).map((v,i)=>({
    id:v.name,language,lang:v.lang,label:LABELS[language][i],
    gender:classifyVoiceGender(v,language),
  }));
}


/**
 * SpeechSynthesisVoice doesn't provide a standard gender property.
 * Categorise ONLY voices with explicit male/female metadata or established
 * named voices; never invent or guess a voice's gender from its language.
 * Friendly labels are UI aliases, not the name of the real speaker.
 */
const KNOWN={
 ar:{
  male:/\b(hamed|hamid|naayf|nayef|majed|maged|shakir|bas(s)?am|faris|fahad|tarik|tariq|youssef|yousef|omar|abdullah)\b/i,
  female:/\b(zariyah|zaria|salma|layla|laila|amira|maryam|hoda|fatima|reema|noura|noora|rana)\b/i,
 },
 en:{
  male:/\b(david|mark|guy|christopher|andrew|brian|eric|roger|ryan|daniel|george|james|oliver|thomas|liam)\b/i,
  female:/\b(jenny|aria|zira|samantha|ava|emma|olivia|victoria|karen|susan|hazel|jessa|sophie|amy|sara|sonia)\b/i,
 }
};
const ALIASES={
 ar:{male:['راشد','فهد','ناصر'],female:['نورة','سَنا','مها']},
 en:{male:['Adam','Liam','Noah'],female:['Ava','Emma','Olivia']},
};
export function classifyVoiceGender(voice,language){
 const declared=String(voice?.gender||'').toLowerCase();
 if(['male','female'].includes(declared))return declared;
 const name=String(voice?.name||'');
 const x=KNOWN[language];
 if(!x)return null;
 // The voices are standard OS voice models with published gendered names.
 const male=x.male.test(name),female=x.female.test(name);
 return male&&!female?'male':female&&!male?'female':null;
}
export function groupedSystemVoices(available,language){
 const empty={male:[],female:[],other:[]};
 if(!['ar','en'].includes(language))return empty;
 const voices=Array.isArray(available)?available:[];
 const unique=new Set();
 for(const voice of voices){
  if(!voice||typeof voice.name!=='string'||typeof voice.lang!=='string')continue;
  if(!voice.lang.toLowerCase().startsWith(language)||unique.has(voice.name))continue;
  unique.add(voice.name);
  const gender=classifyVoiceGender(voice,language);
  const group=gender||'other';
  empty[group].push({
    id:voice.name,lang:voice.lang,gender,
    label:gender?ALIASES[language][gender][empty[group].length]||'':'صوت الجهاز',
  });
 }
 const rank=v=>/natural|neural|enhanced|high.?quality/i.test(v.id)?1:0;
 for(const group of ['male','female']){
  empty[group].sort((a,b)=>rank(b)-rank(a));
  empty[group]=empty[group].slice(0,3).map((v,i)=>({...v,label:ALIASES[language][group][i]}));
 }
 empty.other=empty.other.slice(0,1);
 return empty;
}
