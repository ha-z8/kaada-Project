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
   assert.equal(res.status,200);
   const flagged=await res.json();
   assert.equal(flagged.auto_save,false);
   assert.deepEqual(flagged.warnings,['numbers-changed']);
   assert.equal(flagged.review_required,true);
   assert.equal(calls,2);
 }finally{globalThis.fetch=previous}
});


test('short PDF passage translation uses neighbors as context but translates TARGET only',async()=>{
  const prior=globalThis.fetch;
  const lesson='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const target='Although the exact origins of what is now known as Operations Research are';
  const next='not precisely documented, historical writings indicate that scientific methods have';
  const arabic='على الرغم من أن الأصول الدقيقة لما يُعرف اليوم باسم بحوث العمليات هي';
  let prompts=[],securedRequests=[];
  globalThis.fetch=async (url,options)=>{
    securedRequests.push({url:String(url),auth:options?.headers?.Authorization});
    if(String(url).includes('/auth/v1/user'))return Response.json({id:'00000000-0000-4000-8000-000000000001'});
    if(String(url).includes('/app_roles?'))return Response.json([{role:'admin'}]);
    if(String(url).includes('select=id,content_en,lesson_id,position'))
      return Response.json([{id:'00000000-0000-4000-8000-000000000000',content_en:target,lesson_id:lesson,position:7}]);
    if(String(url).includes('select=content_en,position'))
      return Response.json([{position:6,content_en:'Chapter 1 Introduction'},{position:7,content_en:target},{position:8,content_en:next}]);
    throw Error('Unexpected protected section query: '+url);
  };
  try{
    const env={AI:{run:async(_model,request)=>{prompts.push(request.messages[1].content);return {choices:[{message:{content:arabic}}]};}}};
    const res=await worker.fetch(new Request(endpoint+'/translate',{method:'POST',
      headers:{Authorization:'Bearer scoped-admin-jwt','Content-Type':'application/json'},
      body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',allow_external_processing:true}),
    }),env);
    assert.equal(res.status,200,await res.clone().text());
    assert.equal((await res.json()).translation,arabic);
    assert.ok(prompts.length>=2);
    assert.ok(prompts[0].includes(target)&&prompts[0].includes(next));
    assert.ok(prompts[0].includes('TARGET PASSAGE'));
    assert.ok(securedRequests.every(x=>x.auth==='Bearer scoped-admin-jwt'));
    assert.ok(securedRequests.some(x=>x.url.includes('lesson_id=eq.'+lesson)));
  }finally{globalThis.fetch=prior}
});

test('primary and alternate website origins can check health and translate without weakening authentication',async()=>{
 const env={AI:{run:async()=>{throw Error('no anonymous inference')}}};
 for(const origin of ['https://kaada.website','https://www.kaada.website','https://kaada-pro.netlify.app']){
  const health=await worker.fetch(new Request(endpoint+'/health',{headers:{Origin:origin}}),env);
  assert.equal(health.headers.get('access-control-allow-origin'),origin);
  const preflight=await worker.fetch(new Request(endpoint+'/translate',{method:'OPTIONS',headers:{Origin:origin}}),env);
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
  const denied=await worker.fetch(new Request(endpoint+'/translate',{method:'POST',headers:{Origin:origin}}),env);
  assert.equal(denied.status,401);assert.equal(denied.headers.get('access-control-allow-origin'),origin);
 }
 const rejected=await worker.fetch(new Request(endpoint+'/translate',{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}}),env);
 assert.equal(rejected.status,403);assert.equal(rejected.headers.get('access-control-allow-origin'),null);
});

test('selection translation is scoped to authorized source and never translates the whole paragraph',async()=>{
 const old=globalThis.fetch;const prompts=[];
 globalThis.fetch=async url=>String(url).includes('/auth/v1/user')?Response.json({id:'00000000-0000-4000-8000-000000000001'}):String(url).includes('/app_roles?')?Response.json([{role:'admin'}]):Response.json([{content_en:'The objective function determines the best solution.'}]);
 try{
 const env={AI:{run:async(_,args)=>{prompts.push(args.messages[1].content);return {choices:[{message:{content:'دالة الهدف'}}]}}}};
 const req=selection=>new Request(endpoint+'/translate',{method:'POST',headers:{Authorization:'Bearer session','Content-Type':'application/json'},body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',selection_text:selection,allow_external_processing:true})});
 const res=await worker.fetch(req('objective function'),env);assert.equal(res.status,200);assert.equal((await res.json()).translation,'دالة الهدف');
 assert.match(prompts[0],/TARGET PASSAGE \(TRANSLATE ONLY THIS\):\n\nobjective function\n\nNEXT CONTEXT/);
 const count=prompts.length;assert.equal((await worker.fetch(req('unrelated words'),env)).status,422);assert.equal(prompts.length,count);
 }finally{globalThis.fetch=old}
});
