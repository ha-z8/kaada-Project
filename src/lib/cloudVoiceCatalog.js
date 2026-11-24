/**
 * HSA fixed 12-voice studio. Every slot has an independent named Google
 * Chirp 3 HD speaker. Display aliases are Saudi names (Arabic) or common
 * English given names, not claims of Saudi dialect or human identity.
 *
 * Arabic voices are ar-XA = generic Arabic, NOT ar-SA Saudi accent.
 * Source: Google Cloud Text-to-Speech officially supported voices:
 * https://cloud.google.com/text-to-speech/docs/voices
 */
const catalog=[
 {id:'cloud:ar-fahad',label:'فهد',lang:'ar',gender:'male',locale:'ar-XA',speaker:'Achird'},
 {id:'cloud:ar-abdullah',label:'عبدالله',lang:'ar',gender:'male',locale:'ar-XA',speaker:'Charon'},
 {id:'cloud:ar-saud',label:'سعود',lang:'ar',gender:'male',locale:'ar-XA',speaker:'Fenrir'},
 {id:'cloud:ar-noura',label:'نورة',lang:'ar',gender:'female',locale:'ar-XA',speaker:'Achernar'},
 {id:'cloud:ar-reem',label:'ريم',lang:'ar',gender:'female',locale:'ar-XA',speaker:'Aoede'},
 {id:'cloud:ar-sarah',label:'سارة',lang:'ar',gender:'female',locale:'ar-XA',speaker:'Leda'},
 {id:'cloud:en-james',label:'James',lang:'en',gender:'male',locale:'en-US',speaker:'Algenib'},
 {id:'cloud:en-liam',label:'Liam',lang:'en',gender:'male',locale:'en-US',speaker:'Orus'},
 {id:'cloud:en-noah',label:'Noah',lang:'en',gender:'male',locale:'en-US',speaker:'Schedar'},
 {id:'cloud:en-emma',label:'Emma',lang:'en',gender:'female',locale:'en-US',speaker:'Autonoe'},
 {id:'cloud:en-olivia',label:'Olivia',lang:'en',gender:'female',locale:'en-US',speaker:'Kore'},
 {id:'cloud:en-sophia',label:'Sophia',lang:'en',gender:'female',locale:'en-US',speaker:'Zephyr'},
];
export const CLOUD_VOICES=Object.freeze(catalog.map(v=>Object.freeze({
 ...v,providerId:v.locale+'-Chirp3-HD-'+v.speaker,
 accent:v.lang==='ar'?'عربية فصحى عامة، وليست لهجة سعودية':'إنجليزية أمريكية'
})));
export const isCloudVoice=id=>typeof id==='string'&&id.startsWith('cloud:');
export const findCloudVoice=id=>CLOUD_VOICES.find(v=>v.id===id)||null;
export const defaultCloudVoice=lang=>CLOUD_VOICES.find(v=>v.lang===lang)?.id||'';
export function cloudVoiceGroups(lang){
 const list=CLOUD_VOICES.filter(v=>v.lang===lang);
 return {
  male:list.filter(v=>v.gender==='male').map(v=>({...v,localService:false,voiceURI:v.providerId})),
  female:list.filter(v=>v.gender==='female').map(v=>({...v,localService:false,voiceURI:v.providerId})),
  other:[]
 };
}
