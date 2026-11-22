/**
 * Curated, short KAADA voice names. They label installed operating-system
 * voices; they do not themselves synthesize voices or imply 12 models exist.
 */
// Fixed display names: altering any name/order requires an explicit catalogue migration.
export const VOICE_NAMES=Object.freeze({
  ar:Object.freeze({male:Object.freeze(['فهد','سعود','راشد']),female:Object.freeze(['نورة','ريم','سارة'])}),
  en:Object.freeze({male:Object.freeze(['James','Liam','Noah']),female:Object.freeze(['Emma','Olivia','Sophia'])}),
});
export const FIXED_VOICE_CATALOG_KEY='kaada-fixed-voice-catalog-v1';
const REGION={ar:['ar-SA','ar-AE','ar-KW','ar-BH','ar-QA','ar-EG','ar'],en:['en-US','en-CA','en-GB','en']};
const KNOWN={
 ar:{
  male:/\b(hamed|hamid|hamad|naayf|nayef|nayyef|majed|maged|shakir|bassam|basam|faris|fahad|fahd|tarik|tariq|youssef|yousef|omar|abdullah|abdulrahman|ahmed|saeed|khalid|khaled|ali|hassan|mohammed|nasser|nasir|rashid|rashed|sultan|firas)\b/i,
  female:/\b(zariyah|zaria|salma|layla|laila|leila|amira|maryam|hoda|fatima|fatma|reema|noura|noora|rana|sara|sarah|yasmin|zainab|asma|asmaa|aisha|ayesha|arwa|shereen|shahd|suha|hanan|amal|basma|afnan|maysa|hessa)\b/i,
 },
 en:{
  male:/\b(david|mark|guy|christopher|andrew|brian|eric|roger|ryan|daniel|george|james|oliver|thomas|liam|alex|matthew|michael|jacob|william)\b/i,
  female:/\b(jenny|aria|zira|samantha|ava|emma|olivia|victoria|karen|susan|hazel|jessa|sophie|sophia|amy|sara|sonia|jane|allison|ashley)\b/i,
 },
};
export function classifyVoiceGender(voice,language){
 const declared=String(voice?.gender||'').toLowerCase();
 if(declared==='male'||declared==='female')return declared;
 const name=String(voice?.name||'');
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
export function voiceQualityScore(voice,language){
 if(!voice)return -1;
 const name=String(voice.name||'');
 const region=String(voice.lang||'').toLowerCase();
 const rank=(REGION[language]||[]).findIndex(v=>v.toLowerCase()===region);
 const locale=rank<0?0:(REGION[language].length-rank)*6;
 const modern=/neural|natural|enhanced|premium|high.?quality|online/i.test(name)?120:0;
 const legacy=/compact|espeak|classic|legacy|robot|saba|sabah|سبا|صبا/i.test(name)?-85:0;
 return locale+modern+legacy+(voice.default?3:0);
}
export function groupedSystemVoices(available,language){
 const output={male:[],female:[],other:[]};
 if(!['ar','en'].includes(language))return output;
 const unique=new Set();
 const entries=(Array.isArray(available)?available:[])
  .filter(v=>v&&typeof v.name==='string'&&typeof v.lang==='string'&&v.lang.toLowerCase().startsWith(language))
  // The old Saba voice was explicitly rejected by users for its robotic tone.
  .filter(v=>!/(?:^|\W)(?:saba|sabah|سبا|صبا)(?:$|\W)/i.test(v.name))
  .filter(v=>{const key=v.name+'|'+v.lang.toLowerCase();if(unique.has(key))return false;unique.add(key);return true})
  .sort((a,b)=>voiceQualityScore(b,language)-voiceQualityScore(a,language));
 for(const v of entries){
  const gender=classifyVoiceGender(v,language);
  const bucket=gender||'other';
  if(output[bucket].length>=(bucket==='other'?3:3))continue;
  output[bucket].push({
   id:v.name,lang:v.lang,gender,quality:voiceQualityScore(v,language),
   enhanced:/neural|natural|enhanced|premium|high.?quality/i.test(v.name),
   label:gender?VOICE_NAMES[language][gender][output[bucket].length]: 'صوت إضافي '+(output.other.length+1),
  });
 }
 return output;
}
// Compatibility with old simple-voice screens/tests; use the six-voice catalog
// in the player to avoid presenting duplicated and misleading voice aliases.
export function friendlySystemVoices(available,language,max=3){
 const groups=groupedSystemVoices(available,language);
 const voices=[...groups.female,...groups.male,...groups.other].sort((a,b)=>b.quality-a.quality);
 const labels=language==='ar'?['نورة','ريم','سارة']:['Emma','Olivia','Sophia'];
 return voices.slice(0,Math.max(0,Math.min(3,max))).map((v,i)=>({...v,label:labels[i],language}));
}


/**
 * Pin each friendly name to an actual, installed voice name+locale. Once
 * assigned, never reshuffle an alias when the OS adds/removes/updates voices.
 * Missing pinned voices render as disabled until installed again, instead
 * of silently using a different person under the saved name.
 *
 * The user owns these preferences in this browser's site storage; deleting
 * that storage or using a different device cannot retain device voice IDs.
 */
export function lockVoiceCatalog(available,saved={}){
 const current=(saved && typeof saved==='object'&&!Array.isArray(saved))?saved:{};
 const assignments={...current};
 const groups={};
 for(const language of ['ar','en']){
   const used=new Set();
   const choices=(Array.isArray(available)?available:[])
     .filter(v=>v&&typeof v.name==='string'&&typeof v.lang==='string'&&v.lang.toLowerCase().startsWith(language))
     .filter(v=>!/(?:^|\W)(?:saba|sabah|سبا|صبا)(?:$|\W)/i.test(v.name))
     .sort((a,b)=>voiceQualityScore(b,language)-voiceQualityScore(a,language));
   const buckets={male:[null,null,null],female:[null,null,null],other:[]};
   // Reserve every pinned identity before filling any empty slot.
   for(const gender of ['female','male']){
     for(let i=0;i<3;i++){
       const pinned=assignments[language+':'+gender+':'+i];
       if(pinned?.name&&pinned?.lang)used.add(pinned.name+'|'+String(pinned.lang).toLowerCase());
     }
   }
   for(const gender of ['female','male']){
     for(let i=0;i<3;i++){
       const key=language+':'+gender+':'+i;
       const savedVoice=assignments[key];
       let found=null;
       if(savedVoice?.name&&savedVoice?.lang){
         found=choices.find(v=>v.name===savedVoice.name&&v.lang.toLowerCase()===String(savedVoice.lang).toLowerCase()
           &&classifyVoiceGender(v,language)===gender)||null;
       }else{
         found=choices.find(v=>classifyVoiceGender(v,language)===gender&&!used.has(v.name+'|'+v.lang.toLowerCase()))||null;
         if(found)assignments[key]={name:found.name,lang:found.lang};
       }
       if(found){
         used.add(found.name+'|'+found.lang.toLowerCase());
         buckets[gender][i]={
           id:found.name,lang:found.lang,gender,
           label:VOICE_NAMES[language][gender][i],
           enhanced:/neural|natural|enhanced|premium|high.?quality/i.test(found.name),
           quality:voiceQualityScore(found,language),
         };
       }
     }
   }
   groups[language]=buckets;
 }
 return {assignments,groups};
}
