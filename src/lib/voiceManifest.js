/**
 * Twelve DISTINCT neural speakers: three men and three women per language.
 * Arabic display names are Saudi-style names, NOT claims of Saudi dialect.
 * Speaker identity is (modelKey, speakerId); two Hadra voices are genuinely
 * different trained speakers sharing a single model.
 *
 * Models are loaded from their original public repositories once, then kept
 * in per-origin OPFS. No server-side TTS credentials or impersonation.
 */
const hf=(repo,file)=>'https://huggingface.co/'+repo+'/resolve/main/'+file;
const official=(voice,path,meta)=>({
 id:'piper:'+voice,model:voice,modelKey:voice,
 modelUrl:hf('diffusionstudio/piper-voices',path+'/'+voice+'.onnx'),
 configUrl:hf('diffusionstudio/piper-voices',path+'/'+voice+'.onnx.json'),
 speakerId:0,quality:'medium',...meta
});
const custom=(id,repo,name,meta)=>({
 id:'piper:'+id,model:id,modelKey:id,
 modelUrl:hf(repo,name+'.onnx'),configUrl:hf(repo,name+'.onnx.json'),
 speakerId:0,quality:'high',...meta
});
const hadra={
 modelKey:'hsa-hadra-multispeaker-v1',
 model:'hsa-hadra-multispeaker-v1',
 modelUrl:hf('touati-kamel/Hadra-TTS-piper','model.onnx'),
 configUrl:hf('touati-kamel/Hadra-TTS-piper','model.onnx.json'),
 quality:'medium',
 source:'https://huggingface.co/touati-kamel/Hadra-TTS-piper',
 license:'MIT',
 accent:'جزائرية — ليست لهجة سعودية',
};
export const OFFLINE_VOICE_PACKS=Object.freeze([
 // Saudi-style display names are explicitly separated from model provenance.
 {...custom('hsa-miro-v2','csukuangfj/vits-piper-ar_JO-SA_miro_V2-high','ar_JO-SA_miro_V2-high',
    {lang:'ar',gender:'male',label:'فهد',accent:'عربي خليجي',license:'CC BY-NC-SA 4.0',
     source:'https://huggingface.co/csukuangfj/vits-piper-ar_JO-SA_miro_V2-high'}),recommended:false},
 {...official('ar_JO-kareem-medium','ar/ar_JO/kareem/medium',
    {lang:'ar',gender:'male',label:'سعود',accent:'عربي أردني',license:'راجع بطاقة النموذج',
     source:'https://huggingface.co/rhasspy/piper-voices'}),recommended:true},
 {...hadra,id:'piper:hsa-hadra-rawi',speakerId:1,
    lang:'ar',gender:'male',label:'راشد',recommended:false},
 {...custom('hsa-dii','csukuangfj/vits-piper-ar_JO-SA_dii-high','ar_JO-SA_dii-high',
    {lang:'ar',gender:'female',label:'نورة',accent:'عربي خليجي',license:'CC BY-NC-SA 4.0',
     source:'https://huggingface.co/csukuangfj/vits-piper-ar_JO-SA_dii-high'}),recommended:false},
 {...custom('hsa-emirati-female','vadimbelsky/arabic-emirati-female-piper','arabic-emirati-female-model',
    {lang:'ar',gender:'female',label:'ريم',accent:'عربي إماراتي',license:'MIT',
     source:'https://huggingface.co/vadimbelsky/arabic-emirati-female-piper'}),recommended:false},
 {...hadra,id:'piper:hsa-hadra-loubna',speakerId:2,
    lang:'ar',gender:'female',label:'سارة',recommended:false},
 {...official('en_US-joe-medium','en/en_US/joe/medium',
    {lang:'en',gender:'male',label:'James',accent:'American English',license:'See model card',
     source:'https://huggingface.co/rhasspy/piper-voices'}),recommended:true},
 {...official('en_US-bryce-medium','en/en_US/bryce/medium',
    {lang:'en',gender:'male',label:'Liam',accent:'American English',license:'See model card',
     source:'https://huggingface.co/rhasspy/piper-voices'}),recommended:false},
 {...official('en_GB-alan-medium','en/en_GB/alan/medium',
    {lang:'en',gender:'male',label:'Noah',accent:'British English',license:'See model card',
     source:'https://huggingface.co/rhasspy/piper-voices'}),recommended:false},
 {...official('en_US-kristin-medium','en/en_US/kristin/medium',
    {lang:'en',gender:'female',label:'Emma',accent:'American English',license:'See model card',
     source:'https://huggingface.co/rhasspy/piper-voices'}),recommended:false},
 {...official('en_GB-alba-medium','en/en_GB/alba/medium',
    {lang:'en',gender:'female',label:'Olivia',accent:'British English',license:'CC BY 4.0',
     source:'https://huggingface.co/rhasspy/piper-voices'}),recommended:false},
 {...official('en_US-hfc_female-medium','en/en_US/hfc_female/medium',
    {lang:'en',gender:'female',label:'Sophia',accent:'American English',license:'See model card',
     source:'https://huggingface.co/rhasspy/piper-voices'}),recommended:false},
].map(pack=>Object.freeze(pack)));

export function findOfflineVoice(id){return OFFLINE_VOICE_PACKS.find(p=>p.id===id)||null}
export const isOnDeviceVoice=id=>typeof id==='string'&&id.startsWith('piper:');
export const OFFLINE_VOICE_EVENT='hsa-offline-voice-updated';
export const VOICE_GROUPS=Object.freeze([
 {lang:'ar',gender:'male',title:'أصوات عربية رجالية'},
 {lang:'ar',gender:'female',title:'أصوات عربية نسائية'},
 {lang:'en',gender:'male',title:'English male voices'},
 {lang:'en',gender:'female',title:'English female voices'},
]);
export const uniqueVoiceModels=packs=>new Set(packs.map(pack=>pack.modelKey));
