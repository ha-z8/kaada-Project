// Deployed Edge Function check: no account creation, no sensitive credentials.
import {PUBLIC_SUPABASE_KEY} from '../src/lib/publicSupabaseConfig.js';
const url='https://oaihjgmmoxvunuxtucin.supabase.co/functions/v1/account-control';
const origin='https://kaada-pro.netlify.app';
const preflight=await fetch(url,{
  method:'OPTIONS',
  headers:{
    Origin:origin,
    'Access-Control-Request-Method':'POST',
    'Access-Control-Request-Headers':'authorization,apikey,x-client-info,content-type',
  },
  signal:AbortSignal.timeout(15000),
});
console.log('OPTIONS:',preflight.status,'Allow-Origin:',preflight.headers.get('access-control-allow-origin'));
if(!preflight.ok||preflight.headers.get('access-control-allow-origin')!==origin){
  throw Error('Edge function failed CORS preflight');
}
// Unauthenticated clients must be rejected BEFORE input validation or account creation.
const res=await fetch(url,{
  method:'POST',
  headers:{Origin:origin,'Content-Type':'application/json',apikey:PUBLIC_SUPABASE_KEY,'Authorization':'Bearer '+PUBLIC_SUPABASE_KEY},
  body:JSON.stringify({action:'register',username:'a',password:'x'}),
  signal:AbortSignal.timeout(15000),
});
const body=await res.text();
console.log('POST invalid-input:',res.status,body.slice(0,320));
let payload;
try{payload=JSON.parse(body)}catch{throw Error('Edge function returned invalid JSON.')}
if(res.status!==403||payload?.code!=='STAFF_ONLY'||
   res.headers.get('access-control-allow-origin')!==origin)
  throw Error('Edge function must deny public account registration with CORS intact.');
console.log('Edge CORS and unauthorised registration denial: PASS');
