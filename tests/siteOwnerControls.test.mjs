import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SITE_OWNER_FIELDS,normalizeSiteSettings} from '../src/lib/siteSettings.js';

const repositoryFile=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('only owner can change team member cards, portraits, personal links, and titles',()=>{
 for(const field of ['team','teamTitle','teamIntro','teamKicker','teamEmpty']){
  assert.ok(SITE_OWNER_FIELDS.includes(field),field);
 }
 const settings=normalizeSiteSettings();
 assert.equal(settings.team[0].name,'هزاع الهزاع');
});

test('branding and page structure are owner only; learning descriptions are editable by admins',()=>{
 for(const field of ['siteName','shortName','tagline','heroLead','heroAccent','footerText','footerNote','sectionOrder','hiddenSections']){
  assert.ok(SITE_OWNER_FIELDS.includes(field),field);
 }
 for(const field of ['features','featuresTitle','steps','stepsTitle','notes','mission','aboutTitle','sampleTitle']){
  assert.ok(!SITE_OWNER_FIELDS.includes(field),field);
 }
});

test('site settings saves use database-derived protected JSON for nonowners',async()=>{
 const code=await repositoryFile('src/lib/siteSettings.js');
 assert.match(code,/supabase\.rpc\('is_site_owner'\)/);
 assert.match(code,/if\(!owner\)/);
 assert.match(code,/\.select\('content'\)\.eq\('id',1\)\.single\(\)/);
 assert.match(code,/if\(!OWNER_FIELDS\.has\(key\)\)content\[key\]=value/);
 assert.match(code,/guard.*final authority/);
});

test('Postgres protection guards against forged client writes and locks team-avatars storage',async()=>{
 const code=await repositoryFile('supabase/owner_controls.sql');
 assert.match(code,/create or replace function public\.is_site_owner\(\)/i);
 assert.match(code,/security definer/i);
 assert.match(code,/on public\.site_settings[\s\S]*?execute function public\.site_settings_owner_guard/i);
 assert.match(code,/old\.content[\s\S]*?new\.content|new\.content[\s\S]*?old\.content/i);
 assert.match(code,/for insert to authenticated[\s\S]*?is_site_owner/i);
 assert.match(code,/for delete to authenticated[\s\S]*?is_site_owner/i);
 assert.match(code,/where p\.username='hazzaa'/);
});

test('site editor hides all sensitive sections from other administrators',async()=>{
 const code=await repositoryFile('src/components/SiteSettingsPage.jsx');
 const guarded=code.match(/<OwnerLockedSection/g)||[];
 assert.equal(guarded.length,3);
 assert.match(code,/isSiteOwner \?[\s\S]*?<OwnerLockedSection title="الهوية العامة"/);
 assert.match(code,/isSiteOwner \?[\s\S]*?<OwnerLockedSection title="فريق العمل"/);
});

test('account-control service verifies immutable owner ID before role and account mutation',async()=>{
 const code=await repositoryFile('supabase/functions/account-control/index.ts');
 assert.match(code,/db\.from\("site_owners"\)\.select\("user_id"\)/);
 assert.match(code,/const isOwner=actor\.id===owner\.user_id/);
 assert.match(code,/userId===owner\.user_id&&!isOwner/);
 assert.match(code,/!isOwner&&\(oldRole\?\.role==="admin"\|\|nextRole==="admin"\)/);
 assert.match(code,/!isOwner&&oldRole\?\.role==="admin"/);
 assert.match(code,/input\.role==="admin"&&!isOwner/);
});

test('regular admins retain permission to edit educational About page copy in principle',()=>{
 const fromDb={siteName:'HSA 4 Study',team:[{name:'عضو'}],aboutTitle:'الدليل'};
 const requested={...fromDb,team:[{name:'مختلف'}],aboutTitle:'الدليل المعدل'};
 const merge={...fromDb};
 for(const [key,value] of Object.entries(requested))if(!SITE_OWNER_FIELDS.includes(key))merge[key]=value;
 assert.equal(merge.team[0].name,'عضو');
 assert.equal(merge.aboutTitle,'الدليل المعدل');
});
