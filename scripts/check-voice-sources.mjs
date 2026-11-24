/**
 * Non-destructive remote model source audit: checks small JSON configs and
 * HEAD responses, never downloads 11 giant ONNX weights during CI.
 * Does NOT prove browser inference, native dialect accuracy or sound quality.
 */
import {OFFLINE_VOICE_PACKS} from '../src/lib/voiceManifest.js';
const unique=[...new Map(OFFLINE_VOICE_PACKS.map(pack=>[pack.modelKey,pack])).values()];
const failures=[];
async function probe(pack){
 try{
  const ctl=AbortSignal.timeout(18000);
  const cfg=await fetch(pack.configUrl,{signal:ctl,redirect:'follow'});
  if(!cfg.ok)throw Error('config returned HTTP '+cfg.status);
  const config=await cfg.json();
  if(config.phoneme_type!=='espeak'||!config.espeak?.voice)
   throw Error('phoneme_type/espeak voice does not match runtime');
  if(pack.speakerId>0){
   const n=Number(config.num_speakers||
    Object.keys(config.speaker_id_map||{}).length||1);
   if(n<=pack.speakerId)throw Error('speakerId '+pack.speakerId+' is not present ('+n+' speakers)');
  }
  const head=await fetch(pack.modelUrl,{method:'HEAD',redirect:'follow',
   signal:AbortSignal.timeout(25000)});
  if(!head.ok)throw Error('model returned HTTP '+head.status);
  const bytes=Number(head.headers.get('content-length')||0);
  if(bytes>0&&bytes<1024*1024)throw Error('model unexpectedly small ('+bytes+' bytes)');
  console.log('OK  '+pack.label+' '+pack.modelKey+
   ' speakers='+Number(config.num_speakers||1)+
   ' modelBytes='+(bytes||'unknown'));
 }catch(error){
  const message=pack.modelKey+': '+String(error?.message||error);
  failures.push(message);
  console.warn('FAIL '+message);
 }
}
for(let i=0;i<unique.length;i+=3)
 await Promise.all(unique.slice(i,i+3).map(probe));
console.log('Checked '+unique.length+' distinct model URLs and configs, '+failures.length+' failures.');
if(failures.length)process.exitCode=1;
