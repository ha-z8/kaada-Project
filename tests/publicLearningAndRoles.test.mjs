import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEVICE_PROGRESS_KEY,readDeviceProgress,writeDeviceProgress,normalizeDeviceProgress} from '../src/lib/deviceProgress.js';
import {normalizeSiteSettings,SITE_OWNER_FIELDS} from '../src/lib/siteSettings.js';
import {PUBLIC_PAGE_IDS,START_PAGE_IDS} from '../src/lib/sidebarMenu.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('device progress survives a browser session, is local only, and tracks lessons separately',()=>{
 const saved=new Map();
 const storage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
 writeDeviceProgress('lesson-a','section-1','en',1.25,storage);
 writeDeviceProgress('lesson-b','section-7','ar',1.5,storage);
 const next=writeDeviceProgress('lesson-a','section-4','mixed',.75,storage);
 assert.equal(next.length,2);
 assert.equal(next.find(x=>x.lesson_id==='lesson-a').section_id,'section-4');
 assert.equal(next.find(x=>x.lesson_id==='lesson-b').audio_track,'ar');
 assert.equal(saved.has(DEVICE_PROGRESS_KEY),true);
 assert.deepEqual(readDeviceProgress(storage),next);
});
test('local progress ignores malformed records and bounds speed with no shared user identifiers',()=>{
 const bad=normalizeDeviceProgress([
  null,{}, {lesson_id:'lesson-x',section_id:'part-1',speed:-20,audio_track:'bogus'},
  {lesson_id:'lesson-y',section_id:'part-2',speed:99,audio_track:'en'},
 ]);
 assert.equal(bad.length,2);
 assert.equal(bad[0].speed,.75);
 assert.equal(bad[1].speed,2);
 assert.equal(bad[0].audio_track,'mixed');
 assert.ok(!Object.hasOwn(bad[0],'user_id'));
});

test('settings constrain public landing to approved existing pages and keep a visible homepage',()=>{
 const defaults=normalizeSiteSettings();
 assert.equal(defaults.homePage,'home');
 assert.deepEqual(defaults.publicPages,PUBLIC_PAGE_IDS);
 assert.ok(!SITE_OWNER_FIELDS.includes('homePage'));
 assert.ok(!SITE_OWNER_FIELDS.includes('publicPages'));
 const custom=normalizeSiteSettings({homePage:'reader',publicPages:['reader','about','my-account','site-settings','reader']});
 assert.equal(custom.homePage,'reader');
 assert.deepEqual(custom.publicPages,['reader','about']);
 const malicious=normalizeSiteSettings({homePage:'accounts',publicPages:[]});
 assert.equal(malicious.homePage,'home');
 assert.deepEqual(malicious.publicPages,['home']);
 assert.ok(START_PAGE_IDS.includes(custom.homePage));
});

test('visitors can view public study without sign-in and cannot open account/admin routes',async()=>{
 const app=await source('src/App.jsx');
 const nav=await source('src/components/SidebarNav.jsx');
 const api=await source('src/lib/api.js');
 assert.match(app,/if\(staffLogin&&!session&&!demo\)return <AuthScreen/);
 assert.doesNotMatch(app,/if\(!session&&!demo\)return/);
 assert.match(app,/writeDeviceProgress\(/);
 assert.match(app,/readDeviceProgress\(/);
 assert.doesNotMatch(app,/تجهيز مقاطع قصيرة للدرس|تجهيز المقاطع القصيرة/);
 assert.match(nav,/if\(page.access==='auth'\)return isStaff/);
 assert.match(nav,/publicPages.includes\(page.id\)/);
 assert.match(api,/public_catalog_subjects/);
 assert.match(api,/public_catalog_lessons/);
 assert.match(api,/public_catalog_sections/);
 assert.doesNotMatch(api,/study_progress'\)\.select/);
});

test('there is no public registration in UI or account-control service',async()=>{
 const app=await source('src/App.jsx');
 const accounts=await source('supabase/functions/account-control/index.ts');
 assert.doesNotMatch(app,/accountRequest\('register'/);
 assert.doesNotMatch(app,/setSignup|setDisplayName/);
 assert.match(accounts,/if\(action==="register"\)return problem\(req/);
 assert.match(accounts,/if\(action==="create"\)return await register\(db,req,input,true\)/);
 assert.match(accounts,/value==="teacher"/);
 assert.match(accounts,/value==="admin"/);
});

test('teaching role is server-limited to academic corrections, without manage/import/delete',async()=>{
 const sql=await source('supabase/public_teaching_roles.sql');
 const headings=await source('supabase/teacher_syllabus_headings.sql');
 const app=await source('src/App.jsx');
 assert.match(sql,/app_private\.teacher_academic_guard\(\)/);
 assert.match(sql,/to_jsonb\(new\)-allowed/);
 assert.match(sql,/section_teacher_update/);
 assert.match(sql,/public_catalog_sections/);
 assert.match(headings,/teacher_subject_guard/);
 assert.match(headings,/teacher_lesson_guard/);
 assert.match(app,/const isTeacher=Boolean\(session\)&&role==='teacher'/);
 assert.match(app,/const canReview=isStaff/);
 assert.match(app,/\{isAdmin&&<button className="outline-btn danger-btn"[^>]*onClick=\{deleteSubject\}/);
 assert.match(app,/\{canReview&&dialog==='edit'/);
});

test('profile and responsive photo display are designed for staff and modest size',async()=>{
 const profile=await source('src/components/MyAccountSettings.jsx');
 const styles=await source('src/styles.css');
 assert.match(profile,/role==='admin'/);
 assert.match(profile,/عضو هيئة التدريس/);
 assert.match(profile,/staff-profile-banner/);
 assert.match(profile,/staff-password-input/);
 assert.match(styles,/max-width:min\(52vw,590px\)!important/);
 assert.match(styles,/max-height:54dvh!important/);
});
