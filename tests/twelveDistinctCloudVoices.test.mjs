import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOUD_VOICES,cloudVoiceGroups,defaultCloudVoice,findCloudVoice}
 from '../src/lib/cloudVoiceCatalog.js';
import handler,{config} from '../netlify/functions/cloud-tts.mjs';

test('exactly three independent male and female speakers per language with no duplicate source identity',()=>{
 assert.equal(CLOUD_VOICES.length,12);
 assert.equal(new Set(CLOUD_VOICES.map(v=>v.id)).size,12);
 assert.equal(new Set(CLOUD_VOICES.map(v=>v.speaker)).size,12);
 assert.equal(new Set(CLOUD_VOICES.map(v=>v.providerId)).size,12);
 for(const lang of ['ar','en'])for(const gender of ['male','female']){
  const voices=CLOUD_VOICES.filter(v=>v.lang===lang&&v.gender===gender);
  assert.equal(voices.length,3,lang+' '+gender);
  assert.ok(voices.every(v=>v.localService===undefined));
  assert.ok(voices.every(v=>v.providerId===v.locale+'-Chirp3-HD-'+v.speaker));
 }
 assert.deepEqual(cloudVoiceGroups('ar').male.map(v=>v.label),['فهد','عبدالله','سعود']);
 assert.deepEqual(cloudVoiceGroups('ar').female.map(v=>v.label),['نورة','ريم','سارة']);
 assert.deepEqual(cloudVoiceGroups('en').male.map(v=>v.label),['James','Liam','Noah']);
 assert.deepEqual(cloudVoiceGroups('en').female.map(v=>v.label),['Emma','Olivia','Sophia']);
 assert.equal(findCloudVoice(defaultCloudVoice('ar')).lang,'ar');
 assert.ok(CLOUD_VOICES.filter(v=>v.lang==='ar').every(v=>v.accent.includes('ليست لهجة سعودية')));
});

test('proxy rejects missing credentials, forged voices and empty text',async()=>{
 const previous=process.env.GOOGLE_CLOUD_TTS_API_KEY;
 delete process.env.GOOGLE_CLOUD_TTS_API_KEY;
 try{
  const get=await handler(new Request('https://kaada-pro.netlify.app/.netlify/functions/cloud-tts'));
  assert.deepEqual((await get.json()).ready,false);
  const request=body=>new Request('https://kaada-pro.netlify.app/.netlify/functions/cloud-tts',{
   method:'POST',headers:{'Content-Type':'application/json','Origin':'https://kaada-pro.netlify.app'},
   body:JSON.stringify(body)
  });
  const offline=await handler(request({voiceId:CLOUD_VOICES[0].id,text:'مرحبًا'}));
  assert.equal(offline.status,503);
  process.env.GOOGLE_CLOUD_TTS_API_KEY='TEST_ONLY_PRIVATE_KEY';
  const forged=await handler(request({voiceId:'cloud:ar-imposter',text:'مرحبًا'}));
  assert.equal(forged.status,422);
  const empty=await handler(request({voiceId:CLOUD_VOICES[0].id,text:''}));
  assert.equal(empty.status,422);
  const tooLong=await handler(request({voiceId:CLOUD_VOICES[0].id,text:'x'.repeat(651)}));
  assert.equal(tooLong.status,422);
  const badOrigin=await handler(new Request('https://kaada-pro.netlify.app/.netlify/functions/cloud-tts',{
   method:'POST',headers:{Origin:'https://hostile.example'},
   body:JSON.stringify({voiceId:CLOUD_VOICES[0].id,text:'Hello'})
  }));
  assert.equal(badOrigin.status,403);
 }finally{
  if(previous===undefined)delete process.env.GOOGLE_CLOUD_TTS_API_KEY;
  else process.env.GOOGLE_CLOUD_TTS_API_KEY=previous;
 }
});

test('each alias is mapped to a distinct exact Google provider ID in real proxy request',async()=>{
 const originalKey=process.env.GOOGLE_CLOUD_TTS_API_KEY;
 const originalFetch=globalThis.fetch;
 const names=[];
 process.env.GOOGLE_CLOUD_TTS_API_KEY='SERVER_TEST_KEY_NEVER_COMMITTED';
 globalThis.fetch=async(url,init)=>{
  assert.equal(url,'https://texttospeech.googleapis.com/v1/text:synthesize');
  assert.equal(init.headers['X-Goog-Api-Key'],'SERVER_TEST_KEY_NEVER_COMMITTED');
  names.push(JSON.parse(init.body).voice.name);
  return new Response(JSON.stringify({audioContent:Buffer.alloc(128,1).toString('base64')}),{
   status:200,headers:{'Content-Type':'application/json'}
  });
 };
 try{
  for(const voice of CLOUD_VOICES){
   const req=new Request('https://kaada-pro.netlify.app/.netlify/functions/cloud-tts',{
    method:'POST',
    headers:{'Content-Type':'application/json',Origin:'https://kaada-pro.netlify.app'},
    body:JSON.stringify({voiceId:voice.id,text:voice.lang==='ar'?'مرحبًا بكم':'Welcome to your lesson'})
   });
   const res=await handler(req);
   assert.equal(res.status,200,voice.label);
   assert.equal(res.headers.get('Content-Type'),'audio/mpeg');
   assert.equal((await res.arrayBuffer()).byteLength,128);
  }
  assert.deepEqual(names,CLOUD_VOICES.map(v=>v.providerId));
  assert.equal(new Set(names).size,12);
  assert.deepEqual(config.rateLimit.aggregateBy,['ip','domain']);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GOOGLE_CLOUD_TTS_API_KEY;
  else process.env.GOOGLE_CLOUD_TTS_API_KEY=originalKey;
 }
});

test('the fixed studio uses cloud MP3 audio rather than synthesizing different voices locally',async()=>{
 const {readFile}=await import('node:fs/promises');
 const src=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const voice=await src('src/lib/cloudSpeech.js');
 const audio=await src('src/lib/speech.js');
 const app=await src('src/App.jsx');
 const ui=await src('src/components/StudyAudioPanel.jsx');
 assert.match(voice,/new Audio\(\)/);
 assert.match(voice,/response\.blob\(\)/);
 assert.match(voice,/onplaying/);
 assert.match(audio,/speakCloudParts/);
 assert.match(app,/cloudVoiceGroups\('ar'\)/);
 assert.match(app,/cloudVoiceGroups\('en'\)/);
 assert.match(ui,/FixedCloudVoices/);
 assert.match(ui,/٣ رجال و٣ نساء/);
 assert.doesNotMatch(voice,/speechSynthesis|speakOfflineVoiceParts|piperWorker/);
});
