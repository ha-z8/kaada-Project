import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRequest} from '../src/lib/incidents.js';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('incident sources classify without retaining raw request data',()=>{
 const origin='https://kaada.website';
 assert.equal(classifyRequest('https://oaihjgmmoxvunuxtucin.supabase.co/rest/v1/platform_incidents',origin),null);
 assert.equal(classifyRequest('https://oaihjgmmoxvunuxtucin.supabase.co/functions/v1/account-control',origin),'accounts');
 assert.equal(classifyRequest('/manifest.webmanifest',origin),'hosting');
 assert.equal(classifyRequest('https://example.org',origin),null);
});
test('incident page and data are admin only',()=>{
 assert.match(read('src/App.jsx'),/isAdmin&&screen==='incidents'/);
 assert.match(read('src/lib/sidebarMenu.js'),/id:'incidents',label:'مركز الأخطاء',access:'admin'/);
 assert.match(read('supabase/platform_incidents.sql'),/enable row level security/);
 assert.match(read('supabase/platform_incidents.sql'),/r.role='admin'/);
});
