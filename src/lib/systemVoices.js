/**
 * Curated, short KAADA voice names. They label installed operating-system
 * voices; they do not themselves synthesize voices or imply 12 models exist.
 */
export const VOICE_NAMES=Object.freeze({
  ar:Object.freeze({male:['فهد','سعود','راشد'],female:['نورة','ريم','سارة']}),
  en:Object.freeze({male:['James','Liam','Noah'],female:['Emma','Olivia','Sophia']}),
});
const REGION={ar:['ar-SA','ar-AE','ar-KW','ar-BH','ar-QA','ar-EG','ar'],en:['en-US','en-CA','en-GB','en']};
const KNOWN={
 ar:{
  male:/\b(hamed|hamid|naayf|nayef|majed|maged|shakir|bassam|basam|faris|fahad|tarik|tariq|youssef|yousef|omar|abdullah|ahmed|saeed|khalid|khaled|ali|hassan|mohammed)\b/i,
  female:/\b(zariyah|zaria|salma|layla|laila|amira|maryam|hoda|fatima|reema|noura|noora|rana|sara|sarah|yasmin|zainab|saba|sabah)\b/i,
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
 return male&&!female?'male':female&&!male?'female':null;
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
