import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('public share card uses canonical domain and a real 1200 × 630 PNG',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const image=readFileSync(new URL('../public/social-preview-v1.png',import.meta.url));
 assert.match(html,/property="og:image" content="https:\/\/kaada\.website\/social-preview-v1\.png"/);
 assert.match(html,/name="twitter:card" content="summary_large_image"/);
 assert.match(html,/name="twitter:description" content="[^"]+"/);
 assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(image.readUInt32BE(16),1200);
 assert.equal(image.readUInt32BE(20),630);
 assert.ok(image.length<300000);
});
