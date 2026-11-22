const base='https://kaada-study-ai.kaada-p.workers.dev';
const health=await fetch(base+'/health',{signal:AbortSignal.timeout(20000)});
if(!health.ok)throw Error('Managed academic AI backend is unreachable: '+health.status);
const json=await health.json();
if(json.ready!==true)throw Error('Cloudflare Workers AI binding not active');
const denied=await fetch(base+'/generate',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',level:'basic',allow_external_processing:true}),
  signal:AbortSignal.timeout(20000),
});
if(denied.status!==401)throw Error('Public AI worker did not reject unauthorized inference: '+denied.status);
console.log('Cloudflare AI health: ready');
console.log('Unauthorized explanation inference correctly denied (401)');
const refusedTranslation=await fetch(base+'/translate',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',allow_external_processing:true}),
  signal:AbortSignal.timeout(20000),
});
if(refusedTranslation.status!==401)throw Error('Public translation endpoint did not reject anonymous caller: '+refusedTranslation.status);
console.log('Unauthorized scientific translation correctly denied (401)');
const origin='https://kaada-pro.netlify.app';
const preflight=await fetch(base+'/translate',{
  method:'OPTIONS',
  headers:{
    Origin:origin,
    'Access-Control-Request-Method':'POST',
    'Access-Control-Request-Headers':'authorization,content-type',
  },
  signal:AbortSignal.timeout(12000),
});
if(preflight.status!==204||preflight.headers.get('access-control-allow-origin')!==origin)
  throw Error('Browser translation CORS preflight failed: '+preflight.status);
const deniedCors=await fetch(base+'/translate',{
  method:'POST',
  headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',allow_external_processing:true}),
  signal:AbortSignal.timeout(12000),
});
if(deniedCors.status!==401||deniedCors.headers.get('access-control-allow-origin')!==origin)
  throw Error('Browser translation error response lacked correct CORS headers.');
console.log('Cloudflare scientific translation CORS: PASS');

