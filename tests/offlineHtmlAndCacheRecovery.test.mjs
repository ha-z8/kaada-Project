import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('the initial HTML displays a recovery interface even when the JS entry bundle never executes',async()=>{
 const html=await source('index.html');
 assert.match(html,/<div id="root">\s*<main id="hsa-startup-fallback"/);
 assert.match(html,/إعادة فتح المنصة/);
 assert.match(html,/src="\/src\/main\.jsx"/);
 assert.doesNotMatch(html,/indexedDB\.deleteDatabase|localStorage\.clear\(\)/);
});
test('production offline service worker returns exact cached first-party JS and CSS before fetching network',async()=>{
 const sw=await source('public/sw.js');
 assert.match(sw,/const shell=await caches\.open\(SHELL_CACHE\)/);
 assert.match(sw,/PRECACHE\.includes\(url\.pathname\)\?await shell\.match\(url\.pathname\)/);
 assert.match(sw,/if\(cached\)return cached/);
 assert.match(sw,/return await shell\.match\(url\.pathname\)\|\|Response\.error\(\)/);
 assert.match(sw,/if\(request\.mode==='navigate'\)/);
 assert.doesNotMatch(sw,/fetch\(.+huggingface/);
});
