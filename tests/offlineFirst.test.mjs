import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createOfflineEdit,overlayOfflineEdits,libraryCacheKey,OFFLINE_DB_NAME} from '../src/lib/offlineStore.js';

const file=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const userId='2c78de9c-68e9-4727-80ce-d11b60123e12';
const lesson='e3edb042-f628-4a89-bf1a-1e604b9ea150';
test('offline edits are durable, scoped to a staff identity and based on explicit original values',()=>{
 const record=createOfflineEdit({userId,entity:'subjects',recordId:lesson,
  operationId:'3ca81308-2bde-4d17-b4da-9458a4eeb06c',
  patch:{title:'New title',description:''},base:{id:lesson,title:'Old title',description:'Old'}});
 assert.equal(record.operationId,'3ca81308-2bde-4d17-b4da-9458a4eeb06c');
 assert.deepEqual(record.expected,{title:'Old title',description:'Old'});
 assert.equal(record.status,'pending');
 assert.equal(record.userId,userId);
 assert.ok(!JSON.stringify(record).includes('access_token'));
 assert.ok(OFFLINE_DB_NAME.includes('offline'));
});
test('empty or malformed edits and absent original fields are never claimed as saved',()=>{
 assert.throws(()=>createOfflineEdit({userId,entity:'unknown',recordId:lesson,patch:{x:1},base:{x:1}}));
 assert.throws(()=>createOfflineEdit({userId,entity:'sections',recordId:lesson,patch:{content_en:'ok'},base:{}}));
 assert.throws(()=>createOfflineEdit({userId,entity:'subjects',recordId:lesson,patch:{},base:{}}));
 const item=createOfflineEdit({userId,entity:'sections',recordId:lesson,
  patch:{translation_reviewed_at:null},base:{translation_reviewed_at:undefined}});
 assert.deepEqual(item.expected,{translation_reviewed_at:null});
});
test('replayed offline edits overlay the cached data without touching the original snapshot',()=>{
 const original={subjects:[{id:lesson,title:'Old title'}],lessons:[],sections:[],progress:[]};
 const queued=createOfflineEdit({userId,entity:'subjects',recordId:lesson,
  patch:{title:'Draft title'},base:original.subjects[0]});
 const draft=overlayOfflineEdits(original,[queued]);
 assert.equal(draft.subjects[0].title,'Draft title');
 assert.equal(draft.subjects[0].offline_pending,true);
 assert.equal(original.subjects[0].title,'Old title');
 const create=createOfflineEdit({userId,entity:'subjects:create',
  recordId:'593243e8-4580-4fef-bb9f-ab78144fc5d4',patch:{title:'Local material',description:''},base:{}});
 const combined=overlayOfflineEdits(original,[queued,create]);
 assert.equal(combined.subjects.length,2);
 assert.equal(combined.subjects[1].title,'Local material');
 assert.equal(libraryCacheKey(userId,true),'library:staff:'+userId);
 assert.equal(libraryCacheKey(userId,false),'library:public');
});
test('production PWA is precached from exact build output and excludes Supabase auth and private requests',async()=>{
 const sw=await file('public/sw.js');
 const vite=await file('vite.config.js');
 const main=await file('src/main.jsx');
 assert.match(sw,/__HSA_PRECACHE_LIST__/);
 assert.match(vite,/offlineManifestPlugin/);
 assert.match(vite,/closeBundle/);
 assert.match(vite,/createHash\('sha256'\)/);
 assert.match(sw,/mode==='navigate'/);
 assert.match(sw,/request\.method!=='GET'/);
 assert.match(sw,/\/storage\\\/v1\\\/object\\\/public\\\/team-avatars/);
 assert.doesNotMatch(sw,/auth\/v1\/token|rest\/v1\/sections|service_role/);
 assert.match(sw,/caches\.match\('\/index\.html'\)/);
 assert.match(main,/serviceWorker\.register\('\/sw\.js'/);
 assert.match(main,/navigator\.storage\?\.persist\?\./);
});
test('entire library uses stable server pagination and cached fallback for offline sessions',async()=>{
 const api=await file('src/lib/api.js');
 const app=await file('src/App.jsx');
 assert.match(api,/\.range\(start,start\+499\)/);
 assert.match(api,/\.order\('id'/);
 assert.match(api,/start<25000/);
 assert.match(api,/readOfflineSnapshot\(cacheKey\)/);
 assert.match(api,/saveOfflineSnapshot\(cacheKey,fresh\)/);
 assert.match(app,/supabase\.auth\.getSession\(\)\.then/);
 assert.match(app,/includePrivate:isStaff,userId:session\?\.id/);
 assert.match(app,/queueOfflineEdit\(\{userId:session\.id,entity:'subjects:create'/);
 assert.match(app,/saveOrQueueEdit\(\{userId:session\?\.id,entity:'sections'/);
 assert.match(app,/OfflineSyncCenter userId=\{isStaff\?session\?\.id:null\}/);
});
test('safe sync validates authenticated staff role and handles conflict explicitly',async()=>{
 const queue=await file('src/lib/offlineSync.js');
 const ui=await file('src/components/OfflineSyncCenter.jsx');
 const sql=await file('supabase/offline_edit_replay.sql');
 assert.match(queue,/supabase\.auth\.getUser\(\)/);
 assert.match(queue,/user\?\.id!==userId/);
 assert.match(queue,/apply_offline_edit/);
 assert.match(queue,/data\?\.status==='conflict'/);
 assert.match(ui,/confirm\('ستحذف هذه النسخة المحلية/);
 assert.match(ui,/confirm\('سيتم اعتماد نصك المحلي/);
 assert.match(ui,/حفظ نسخة احتياطية/);
 assert.match(sql,/security invoker/);
 assert.match(sql,/offline_edit_receipts enable row level security/);
 assert.match(sql,/p_expected->field_name/);
 assert.match(sql,/raise exception 'Only administrators can create subjects'/);
 assert.match(sql,/if found then return prior/);
 assert.match(sql,/grant execute on function public\.apply_offline_edit/);
});
test('internet-only functions never report upload, AI or deletion completed while disconnected',async()=>{
 const app=await file('src/App.jsx');
 assert.match(app,/if\(navigator\.onLine===false\)return setError\('يتطلب حذف المواد اتصالًا بالإنترنت\.'/);
 assert.match(app,/if\(navigator\.onLine===false\)return setError\(\s*'يتطلب نشر الدرس اتصالًا بالإنترنت\.'/);
 assert.match(app,/الترجمة الآلية تحتاج الإنترنت/);
 assert.match(app,/التوليد الذكي يحتاج الإنترنت/);
 assert.match(app,/رفع التسجيلات يحتاج اتصالًا بالخادم/);
 const settings=await file('src/components/SiteSettingsPage.jsx');
 assert.match(settings,/saved\.__offline_queued/);
});
