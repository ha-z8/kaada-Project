import test from 'node:test';
import assert from 'node:assert/strict';
import {requestManagedAI,managedAIStatus,ACADEMIC_AI_URL} from '../src/lib/managedAiClient.js';
test('AI readiness directly checks Cloudflare rather than a Netlify timed serverless function',async()=>{
 let called;
 const value=await managedAIStatus(async(url)=>{called=url;return Response.json({ready:true})});
 assert.equal(called,ACADEMIC_AI_URL+'/health');
 assert.equal(value.ready,true);
});
test('authenticated translation directly invokes protected worker with explicit consent',async()=>{
 let request;
 const data=await requestManagedAI({mode:'translate',sectionId:'00000000-0000-4000-8000-000000000000',accessToken:'dummy-jwt',allowExternalProcessing:true,
 fetcher:async(url,options)=>{
  request={url,options};return Response.json({translation:'بالعربية.',auto_save:true,warnings:[]});
 }});
 assert.equal(data.translation,'بالعربية.');
 assert.equal(request.url,ACADEMIC_AI_URL+'/translate');
 assert.equal(request.options.headers.Authorization,'Bearer dummy-jwt');
 assert.equal(JSON.parse(request.options.body).allow_external_processing,true);
 assert.equal(request.options.signal.aborted,false);
});
test('does not silently save unverified mathematical translation',async()=>{
 const result=await requestManagedAI({mode:'translate',sectionId:'00000000-0000-4000-8000-000000000000',accessToken:'token',allowExternalProcessing:true,
 fetcher:async()=>Response.json({translation:'نص يحتاج مراجعة',auto_save:false,warnings:['numbers-changed']})});
 assert.equal(result.auto_save,false);
 assert.deepEqual(result.warnings,['numbers-changed']);
});
test('requires explicit consent before any network request',async()=>{
 let requests=0;
 await assert.rejects(requestManagedAI({mode:'translate',sectionId:'section',accessToken:'token',fetcher:async()=>{requests++}}),/الموافقة/);
 assert.equal(requests,0);
});
test('reports worker quota and timeout clearly',async()=>{
 await assert.rejects(requestManagedAI({mode:'generate',sectionId:'id',accessToken:'token',allowExternalProcessing:true,fetcher:async()=>Response.json({message:'quota exceeded'},{status:429})}),/quota exceeded/);
 await assert.rejects(requestManagedAI({mode:'translate',sectionId:'id',accessToken:'token',allowExternalProcessing:true,fetcher:async()=>{throw Object.assign(Error('Timeout'),{name:'TimeoutError'})}}),/وقتًا أطول/);
});
