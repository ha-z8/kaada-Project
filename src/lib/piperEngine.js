/**
 * Piper VITS synthesis in a single in-browser ONNX Runtime.
 * Supports actual speaker IDs (the old third-party helper hard-coded 0).
 * Source phonemizer: Mintplex-Labs/piper-tts-web MIT, vendored separately.
 */
import {createPiperPhonemize} from '../vendor/piperPhonemize.js';
import {cleanVoiceText,modelPhonemeIds} from './voiceText.js';

let ortPromise;
let current=null;
let initializePromise=null;

const ortLibrary=async()=>{
 if(!ortPromise)ortPromise=import('onnxruntime-web');
 return ortPromise;
};
function toWav(pcm,sampleRate){
 const data=pcm instanceof Float32Array?pcm:Float32Array.from(pcm||[]);
 const ab=new ArrayBuffer(44+data.length*2),view=new DataView(ab);
 const writeString=(pos,str)=>{for(let i=0;i<str.length;i++)view.setUint8(pos+i,str.charCodeAt(i))};
 writeString(0,'RIFF');view.setUint32(4,36+data.length*2,true);
 writeString(8,'WAVE');writeString(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);
 view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);
 view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);
 view.setUint16(34,16,true);writeString(36,'data');
 view.setUint32(40,data.length*2,true);
 for(let i=0;i<data.length;i++){
  const v=Math.max(-1,Math.min(1,data[i]||0));
  view.setInt16(44+i*2,Math.round(v<0?v*32768:v*32767),true);
 }
 return new Blob([ab],{type:'audio/wav'});
}
async function phonemize(text,config){
 return new Promise(async(resolve,reject)=>{
  let finished=false;
  const settle=(err,ids)=>{
   if(finished)return;
   finished=true;
   if(err)reject(err);else resolve(ids);
  };
  try{
   const module=await createPiperPhonemize({
    print:data=>{
     try{
      const result=JSON.parse(data);
      const ids=modelPhonemeIds(result.phonemes,config);
      settle(null,ids);
     }catch(e){settle(e)}
    },
    printErr:message=>{if(/error|failed|cannot|exception/i.test(String(message)))settle(Error(String(message)));},
    locateFile:name=>name.endsWith('.wasm')
     ?'/tts-runtime/piper_phonemize.wasm'
     :name.endsWith('.data')
      ?'/tts-runtime/piper_phonemize.data':name,
   });
   const lang=config.espeak?.voice;
   if(typeof lang!=='string'||!lang)throw Error('النموذج لا يتضمن صوت النطق المطلوب.');
   module.callMain(['-l',lang,'--input',JSON.stringify([{text:cleanVoiceText(text)}]),
    '--espeak_data','/espeak-ng-data']);
  }catch(e){settle(e)}
 });
}
export async function initializePiperModel(modelKey,modelBlob,config){
 if(current?.modelKey===modelKey)return current;
 if(initializePromise)await initializePromise;
 if(current?.modelKey===modelKey)return current;
 initializePromise=(async()=>{
  if(!config||config.phoneme_type!=='espeak')
   throw Error('نموذج الصوت غير متوافق مع محرك النطق المحلي (يلزم espeak).');
  const ort=await ortLibrary();
  ort.env.wasm.wasmPaths='/tts-runtime/';
  ort.env.wasm.numThreads=1; // Safari and non-cross-origin-isolated contexts
  const session=await ort.InferenceSession.create(await modelBlob.arrayBuffer(),{
   executionProviders:['wasm'],graphOptimizationLevel:'all'
  });
  const previous=current;
  current={modelKey,config,session,ort};
  if(previous?.session)await previous.session.release().catch(()=>{});
  return current;
 })();
 try{return await initializePromise}finally{initializePromise=null}
}
export async function synthesizePiper(text,modelKey,modelBlob,config,speakerId=0){
 if(!String(text||'').trim())throw Error('النص المطلوب قراءته فارغ.');
 const runtime=await initializePiperModel(modelKey,modelBlob,config);
 const ids=await phonemize(String(text).trim(),config);
 const {ort,session}=runtime;
 const feeds={
  input:new ort.Tensor('int64',BigInt64Array.from(ids),[1,ids.length]),
  input_lengths:new ort.Tensor('int64',BigInt64Array.of(BigInt(ids.length)),[1]),
  scales:new ort.Tensor('float32',Float32Array.from([
   Math.min(.55,Number(config.inference?.noise_scale??0.55)),
   Number(config.inference?.length_scale??1),
   Math.min(.65,Number(config.inference?.noise_w??0.65))
  ]),[3])
 };
 if(session.inputNames.includes('sid')){
  const max=Number(config.num_speakers||Object.keys(config.speaker_id_map||{}).length||1);
  if(speakerId<0||speakerId>=max)throw Error('رقم المتحدث غير موجود داخل نموذج الصوت.');
  feeds.sid=new ort.Tensor('int64',BigInt64Array.of(BigInt(speakerId)),[1]);
 }else if(speakerId!==0){
  throw Error('النموذج لم يحتوِ متحدثين متعددين كما هو موضح في بطاقة الصوت.');
 }
 const results=await session.run(feeds);
 const tensor=results.output||results[session.outputNames[0]];
 if(!tensor?.data?.length)throw Error('النموذج لم يُنتج مقطعًا صوتيًا.');
 return toWav(tensor.data,Number(config.audio?.sample_rate||22050));
}
