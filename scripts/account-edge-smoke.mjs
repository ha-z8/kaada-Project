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
// This request MUST fail validation before any auth account is created.
const res=await fetch(url,{
  method:'POST',
  headers:{Origin:origin,'Content-Type':'application/json',apikey:PUBLIC_SUPABASE_KEY,'Authorization':'Bearer '+PUBLIC_SUPABASE_KEY},
  body:JSON.stringify({action:'register',username:'a',password:'x'}),
  signal:AbortSignal.timeout(15000),
});
const body=await res.text();
console.log('POST invalid-input:',res.status,body.slice(0,320));
if(res.status!==422||res.headers.get('access-control-allow-origin')!==origin)
  throw Error('Edge function did not validate registration correctly.');
console.log('Edge CORS and registration validation: PASS');
