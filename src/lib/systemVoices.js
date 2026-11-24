/**
 * Fixed display aliases for browser-provided remote voices on THIS device.
 * The underlying speaker is identified by its real provider voiceURI/name.
 * Missing speakers stay unavailable; we never invent or duplicate them.
 * Aliases are not claims about accent or the real name of a speaker.
 */
export const VOICE_NAMES=Object.freeze({
  ar:Object.freeze({male:Object.freeze(['محمد','عبدالله','سعود']),female:Object.freeze(['نورة','ريم','سارة'])}),
  en:Object.freeze({male:Object.freeze(['Oliver','Harry','George']),female:Object.freeze(['Amelia','Charlotte','Sophie'])}),
});
export const FIXED_VOICE_CATALOG_KEY='kaada-fixed-voice-catalog-v1';
const REGION={ar:['ar-SA','ar-AE','ar-KW','ar-BH','ar-QA','ar-EG','ar'],en:['en-GB','en-IE','en-US','en-CA','en']};
const KNOWN={
 ar:{
  male:/\b(hamed|hamid|hamad|naayf|nayef|nayyef|majed|maged|shakir|bassam|basam|faris|fahad|fahd|tarik|tariq|youssef|yousef|omar|abdullah|abdulrahman|ahmed|saeed|khalid|khaled|ali|hassan|mohammed|nasser|nasir|rashid|rashed|sultan|firas)\b/i,
  female:/\b(zariyah|zaria|salma|layla|laila|leila|amira|maryam|hoda|fatima|fatma|reema|noura|noora|rana|sara|sarah|yasmin|zainab|asma|asmaa|aisha|ayesha|arwa|shereen|shahd|suha|hanan|amal|basma|afnan|maysa|hessa)\b/i,
 },
 en:{
  male:/\b(david|mark|guy|christopher|andrew|brian|eric|roger|ryan|daniel|george|james|oliver|thomas|liam|alex|matthew|michael|jacob|william|alfie|elliot|graham|archie|ethan|harry|alfred|benjamin|arthur|oscar|freddie)\b/i,
  female:/\b(jenny|aria|zira|samantha|ava|emma|olivia|victoria|karen|susan|hazel|jessa|sophie|sophia|amy|sara|sonia|jane|allison|ashley|libby|maisie|abbi|hollie|ada|priya|natasha|gemma|laura|catherine|florence|rosie|grace|ellie|alice|emily)\b/i,
 },
};
export function classifyVoiceGender(voice,language){
 const declared=String(voice?.gender||'').toLowerCase();
 if(declared==='male'||declared==='female')return declared;
 const name=String(voice?.name||'');
 // Some browsers expose an explicit gender in the voice name rather than
 // a machine-readable gender field. These tokens are not speaker identities.
 if(/\b(female|woman)\b/i.test(name))return 'female';
 if(/\b(male|man)\b/i.test(name))return 'male';
 const match=KNOWN[language];
 if(!match)return null;
 const male=match.male.test(name),female=match.female.test(name);
 if(male!==female)return male?'male':'female';
 if(language==='ar'){
  const tokens=name.split(/[^\p{L}]+/u);
  const arabicMale=new Set(['حامد','نايف','ماجد','فهد','سعود','راشد','عمر','أحمد','محمد','خالد','ناصر','سلطان','فارس','عبدالله']);
  const arabicFemale=new Set(['نورة','نور','ريم','سارة','سلمى','ليلى','هدى','فاطمة','مريم','أسماء','عائشة','أروى','حنان','أمل','بسمة']);
  const matchedMale=tokens.some(t=>arabicMale.has(t));
  const matchedFemale=tokens.some(t=>arabicFemale.has(t));
  if(matchedMale!==matchedFemale)return matchedMale?'male':'female';
 }
 return null;
}
/**
 * Only voices explicitly declared remote by the Web Speech API can be
 * offered. A browser/system voice with localService=true or unknown status
 * is never represented as an online option.
 * Web Speech voiceURI identifies the underlying synthesis engine/voice.
 */
export function onlineSpeechVoices(available,language=''){
 const seenURI=new Set(),seenName=new Set();
 return (Array.isArray(available)?available:[]).filter(v=>{
  if(!v||typeof v.name!=='string'||!v.name.trim()
      ||typeof v.lang!=='string'||v.localService!==false
      ||(language&&!v.lang.toLowerCase().startsWith(language)))return false;
  if(/(?:^|\W)(?:saba|sabah|سبا|صبا)(?:$|\W)/i.test(v.name))return false;
  const uri=String(v.voiceURI||'').trim().toLowerCase();
  const name=v.name.trim().toLowerCase()+'|'+v.lang.toLowerCase();
  if((uri&&seenURI.has(uri))||seenName.has(name))return false;
  if(uri)seenURI.add(uri);
  seenName.add(name);
  return true;
 });
}
export function voiceQualityScore(voice,language){
 if(!voice||voice.localService===true)return -1000;
 const name=String(voice.name||'');
 const region=String(voice.lang||'').toLowerCase();
 const rank=(REGION[language]||[]).findIndex(v=>v.toLowerCase()===region);
 const locale=rank<0?0:(REGION[language].length-rank)*6;
 const modern=/neural|natural|enhanced|premium|high.?quality|online/i.test(name)?120:0;
 const legacy=/compact|espeak|classic|legacy|robot|saba|sabah|سبا|صبا/i.test(name)?-85:0;
 return locale+modern+legacy+(voice.localService===false?100:0)+(voice.default?3:0);
}
export function groupedSystemVoices(available,language){
 const output={male:[],female:[],other:[]};
 if(!['ar','en'].includes(language))return output;
 const entries=onlineSpeechVoices(available,language)
  .sort((a,b)=>voiceQualityScore(b,language)-voiceQualityScore(a,language));
 for(const voice of entries){
  const gender=classifyVoiceGender(voice,language);
  const bucket=gender||'other';
  if(output[bucket].length>=3)continue;
  output[bucket].push({
   id:voice.name,lang:voice.lang,gender,voiceURI:voice.voiceURI||'',
   quality:voiceQualityScore(voice,language),
   localService:false,enhanced:/neural|natural|enhanced|premium|high.?quality/i.test(voice.name),
   // Display the actual provider name, never a misleading fabricated alias.
   label:voice.name,
  });
 }
 return output;
}
export function friendlySystemVoices(available,language,max=3){
 const groups=groupedSystemVoices(available,language);
 const voices=[...groups.female,...groups.male,...groups.other].sort((a,b)=>b.quality-a.quality);
 return voices.slice(0,Math.max(0,Math.min(3,max))).map(v=>({...v,language}));
}

/**
 * Preserve previously selected genuine voices if they still exist remotely;
 * release stale/missing/local assignments so an online speaker can replace a
 * broken slot. Never assign the same voiceURI or same name+locale twice.
 */
export function lockVoiceCatalog(available,saved={}){
 const current=(saved&&typeof saved==='object'&&!Array.isArray(saved))?saved:{};
 const assignments={};
 const groups={};
 // A single remote voiceURI must not populate different language slots.
 const globallyUsed=new Set();
 for(const language of ['ar','en']){
  const choices=onlineSpeechVoices(available,language)
   .sort((a,b)=>voiceQualityScore(b,language)-voiceQualityScore(a,language));
  const used=globallyUsed;
  const buckets={male:[null,null,null],female:[null,null,null],other:[]};
  const identity=v=>String(v.voiceURI||v.name+'|'+v.lang).toLowerCase();
  for(const gender of ['female','male']){
   for(let i=0;i<3;i++){
    const key=language+':'+gender+':'+i;
    const pinned=current[key];
    const matches=v=>
     classifyVoiceGender(v,language)===gender&&!used.has(identity(v));
    let found=null;
    if(pinned?.name&&pinned?.lang){
     found=choices.find(v=>matches(v)&&v.name===pinned.name&&
      v.lang.toLowerCase()===String(pinned.lang).toLowerCase()&&
      (!pinned.voiceURI||!v.voiceURI||v.voiceURI===pinned.voiceURI))||null;
    }
    if(!found)found=choices.find(matches)||null;
    if(!found)continue;
    const voiceURI=String(found.voiceURI||'');
    assignments[key]={name:found.name,lang:found.lang,voiceURI};
    used.add(identity(found));
    buckets[gender][i]={
     id:found.name,lang:found.lang,voiceURI,gender,localService:false,
     // UI alias never replaces the real speaker ID used by SpeechSynthesis.
     label:VOICE_NAMES[language][gender][i],providerName:found.name,
     enhanced:/neural|natural|enhanced|premium|high.?quality/i.test(found.name),
     quality:voiceQualityScore(found,language)
    };
   }
  }
  groups[language]=buckets;
 }
 return {assignments,groups};
}
