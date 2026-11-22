import test from 'node:test';
import assert from 'node:assert/strict';
import generate, { config } from '../netlify/functions/generate-explanation.mjs';

test('public callers cannot trigger paid AI generation', async () => {
  const res=await generate(new Request('https://example.net/api/study/generate',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({section_id:'00000000-0000-4000-8000-000000000000',allow_external_processing:true}),
  }));
  assert.equal(res.status,401);
  assert.equal((await res.json()).error,'LOGIN_REQUIRED');
});

test('only POST and rate-limited authorized generation path are configured', async()=>{
  const res=await generate(new Request('https://example.net/api/study/generate',{method:'GET'}));
  assert.equal(res.status,405);
  assert.equal(config.path,'/api/study/generate');
  assert.equal(config.rateLimit.windowLimit,3);
  assert.ok(config.rateLimit.aggregateBy.includes('ip'));
});
