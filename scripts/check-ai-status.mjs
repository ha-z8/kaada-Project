// Readiness check only: no user content, keys, or account details are transmitted.
const endpoint='https://kaada-pro.netlify.app/api/study/generate';
const response=await fetch(endpoint,{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Live AI readiness endpoint responded HTTP '+response.status);
const body=await response.json();
if(typeof body.ready!=='boolean')throw Error('AI readiness response missing boolean ready');
console.log('KAADA production AI service readiness:',body.ready?'ready':'not configured');
console.log('Automatic bilingual explanation requires explicit upload consent; normal reading voice works independently.');
