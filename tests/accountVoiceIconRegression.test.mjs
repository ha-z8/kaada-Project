import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {voiceDeviceContext,voiceCompatibility} from '../src/lib/systemVoices.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('runtime voice device context',()=>{
 const nav={userAgent:'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Edg/130.0'};
 assert.equal(voiceDeviceContext(nav).label,'Edge · Windows');
 assert.match(voiceCompatibility({id:'Microsoft Hamed',lang:'ar-SA'},nav),/Edge · Windows · Microsoft · ar-SA/);
 assert.match(voiceCompatibility(null,nav),/غير متاح/);
});
test('favicon has no background rectangle',()=>{assert.doesNotMatch(read('public/favicon.svg'),/<rect/);});
test('account reads explicitly pass JWT and never cache edited passwords',()=>{
 assert.match(read('src/lib/accounts.js'),/Authorization:'Bearer '\+token/);
 assert.doesNotMatch(read('src/components/AccountManager.jsx'),/\{\.\.\.a,\.\.\.values\}/);
});
