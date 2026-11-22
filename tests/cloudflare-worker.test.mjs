import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/kaada-study-ai/worker.js';
const endpoint='https://kaada-study-ai.kaada-p.workers.dev';
test('managed AI health and anonymous rejection without consuming provider credits',async()=>{
  const env={AI:{run:async()=>{throw Error('must not call provider')}}};
  const status=await worker.fetch(new Request(endpoint+'/health'),env);
  assert.equal(status.status,200);
  assert.equal((await status.json()).ready,true);
  const denied=await worker.fetch(new Request(endpoint+'/generate',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',allow_external_processing:true})}),env);
  assert.equal(denied.status,401);
});
test('admin-only generation uses RLS source text and returns a complete editable bilingual draft',async()=>{
  const old=globalThis.fetch;
  const calls=[];const fields=['content_ar','explanation_ar','explanation_en','explanation_mixed','speech_ar','speech_en'];
  const generated=Object.fromEntries(fields.map(k=>[k,k==='content_ar'?'المتغير يمثل قيمة مجهولة.':k+' explanation text']));
  globalThis.fetch=async (url)=>{
    calls.push(String(url));
    if(String(url).includes('/auth/v1/user'))return Response.json({id:'00000000-0000-4000-8000-000000000001'});
    if(String(url).includes('/app_roles?'))return Response.json([{role:'admin'}]);
    if(String(url).includes('/sections?'))return Response.json([{content_en:'A variable represents an unknown quantity.'}]);
    throw Error('unexpected URL');
  };
  try{
    const env={AI:{run:async(model,args)=>{
      assert.match(model,/gemma-4/);
      assert.ok(args.messages[1].content.includes('A variable represents'));
      assert.equal(args.chat_template_kwargs.enable_thinking,false);
      return {choices:[{message:{content:'```json\n'+JSON.stringify(generated)+'\n```'}}]};
    }}};
    const res=await worker.fetch(new Request(endpoint+'/generate',{method:'POST',headers:{
      'Content-Type':'application/json',Authorization:'Bearer mock-user-session',
    },body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',level:'basic',allow_external_processing:true})}),env);
    assert.equal(res.status,200,await res.clone().text());
    const result=await res.json();
    assert.deepEqual(result.draft,generated);
    assert.equal(result.review_required,true);
    assert.equal(calls.length,3);
  }finally{globalThis.fetch=old}
});
test('AI cannot be invoked for non-admin users or without consent',async()=>{
  const old=globalThis.fetch;let modelCalls=0;
  globalThis.fetch=async (url)=>String(url).includes('/auth/v1/user')?Response.json({id:'00000000-0000-4000-8000-000000000001'}):Response.json([{role:'user'}]);
  try{
    const env={AI:{run:async()=>{modelCalls++}}};
    const req=body=>new Request(endpoint+'/generate',{method:'POST',headers:{Authorization:'Bearer session','Content-Type':'application/json'},body:JSON.stringify(body)});
    const denied=await worker.fetch(req({section_id:'00000000-0000-4000-8000-000000000000',allow_external_processing:true}),env);
    assert.equal(denied.status,403);
    const noConsent=await worker.fetch(req({section_id:'00000000-0000-4000-8000-000000000000',allow_external_processing:false}),env);
    assert.equal(noConsent.status,403);
    assert.equal(modelCalls,0);
  }finally{globalThis.fetch=old}
});


test('translation is a distinct reviewed draft and preserves mathematical notation',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async (url)=>{
   if(String(url).includes('/auth/v1/user'))return Response.json({id:'00000000-0000-4000-8000-000000000001'});
   if(String(url).includes('/app_roles?'))return Response.json([{role:'admin'}]);
   return Response.json([{content_en:'A feasible solution is not necessarily optimal. Z = 5x1 + 3x2; x1 ≤ 10.'}]);
 };
 let modelCalls=0;
 try{
   const env={AI:{run:async(_model,args)=>{
     modelCalls++;
     assert.match(args.messages[0].content,/mathematical|scientific/i);
     return {choices:[{message:{content:'الحل الممكن ليس بالضرورة حلاً أمثل. Z = 5x1 + 3x2؛ x1 ≤ 10.'}}]};
   }}};
   const response=await worker.fetch(new Request(endpoint+'/translate',{method:'POST',
     headers:{Authorization:'Bearer valid-user-session','Content-Type':'application/json'},
     body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',allow_external_processing:true}),
   }),env);
   assert.equal(response.status,200,await response.clone().text());
   const body=await response.json();
   assert.match(body.translation,/الحل الممكن/);
   assert.equal(body.review_required,true);
   assert.equal(modelCalls,2);
 }finally{globalThis.fetch=previous}
});
test('an invalid number in a translated equation is rejected even after retry',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async (url)=>{
   if(String(url).includes('/auth/v1/user'))return Response.json({id:'00000000-0000-4000-8000-000000000001'});
   if(String(url).includes('/app_roles?'))return Response.json([{role:'admin'}]);
   return Response.json([{content_en:'Minimize Z = 5x1 + 3x2.'}]);
 };
 try{
   let calls=0;
   const res=await worker.fetch(new Request(endpoint+'/translate',{method:'POST',
     headers:{Authorization:'Bearer valid-user-session','Content-Type':'application/json'},
     body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',allow_external_processing:true}),
   }),{AI:{run:async()=>{calls++;return {choices:[{message:{content:'قلّل Z = 6x1 + 3x2.'}}]};}}});
   assert.equal(res.status,422);
   assert.equal(calls,2);
 }finally{globalThis.fetch=previous}
});
