import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeSiteSettings,SITE_IDENTITY_FIELDS,SITE_TEAM_FIELDS,SITE_OWNER_FIELDS} from '../src/lib/siteSettings.js';
import {DEFAULT_SITE_EDIT_PERMISSIONS,normalizeSiteEditPermissions} from '../src/lib/siteEditPermissions.js';
import {SETTINGS_PANELS,DEVELOPER_PANEL,findSettingsPanels,findSettingsTargets} from '../src/lib/settingsNavigation.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('developer edit flags default to locked and cannot be enabled using arbitrary truthy values',()=>{
 assert.deepEqual(DEFAULT_SITE_EDIT_PERMISSIONS,{allow_admin_identity:false,allow_admin_team:false});
 assert.deepEqual(normalizeSiteEditPermissions(),DEFAULT_SITE_EDIT_PERMISSIONS);
 assert.deepEqual(normalizeSiteEditPermissions({allow_admin_identity:'true',allow_admin_team:1}),DEFAULT_SITE_EDIT_PERMISSIONS);
 assert.deepEqual(normalizeSiteEditPermissions({allow_admin_identity:true,allow_admin_team:false}),
  {allow_admin_identity:true,allow_admin_team:false});
});
test('identity and team fields are separate, exhaustive and never included in ordinary site data',()=>{
 assert.deepEqual([...SITE_IDENTITY_FIELDS,...SITE_TEAM_FIELDS].sort(),[...SITE_OWNER_FIELDS].sort());
 assert.ok(SITE_IDENTITY_FIELDS.includes('siteName'));
 assert.ok(!SITE_IDENTITY_FIELDS.includes('team'));
 assert.ok(SITE_TEAM_FIELDS.includes('team'));
 assert.ok(!SITE_TEAM_FIELDS.includes('siteName'));
 const normalized=normalizeSiteSettings({...normalizeSiteSettings(),allow_admin_identity:true,allow_admin_team:true});
 assert.equal(Object.hasOwn(normalized,'allow_admin_identity'),false);
 assert.equal(Object.hasOwn(normalized,'allow_admin_team'),false);
});
test('developer section is invisible to ordinary admins even when they search its exact title',()=>{
 const settings=normalizeSiteSettings();
 assert.equal(SETTINGS_PANELS.length,11);
 assert.equal(findSettingsPanels(settings,'').length,11);
 assert.equal(findSettingsPanels(settings,'', 'all',true).length,12);
 assert.deepEqual(findSettingsPanels(settings,'', 'developer').map(p=>p.id),[]);
 assert.deepEqual(findSettingsPanels(settings,'','developer',true).map(p=>p.id),['developer']);
 assert.deepEqual(findSettingsPanels(settings,'صلاحيات مطور المنصة').map(p=>p.id),[]);
 assert.deepEqual(findSettingsPanels(settings,'صلاحيات مطور المنصة','all',true).map(p=>p.id),['developer']);
 assert.deepEqual(findSettingsTargets(settings,'السماح للمشرفين بتعديل الهوية العامة').map(x=>x.panelId),[]);
 const developerHits=findSettingsTargets({...settings,allow_admin_identity:false},'السماح للمشرفين بتعديل الهوية العامة','all',true);
 assert.equal(developerHits[0].panelId,'developer');
 assert.equal(developerHits[0].key,'allow_admin_identity');
 assert.equal(DEVELOPER_PANEL.group,'developer');
});
test('developer-only UI renders independent switches with their own save and no role bypass',async()=>{
 const editor=await read('src/components/SiteSettingsPage.jsx');
 const navigator=await read('src/components/SettingsNavigator.jsx');
 assert.match(editor,/isSiteOwner&&visiblePanelIds\.has\('developer'\)/);
 assert.match(editor,/isDeveloper=\{isSiteOwner\}/);
 assert.match(editor,/checked=\{permissionDraft\.allow_admin_identity\}/);
 assert.match(editor,/checked=\{permissionDraft\.allow_admin_team\}/);
 assert.match(editor,/onClick=\{saveDeveloperPermissions\}/);
 assert.match(editor,/saveSiteEditPermissions\(permissionDraft\)/);
 assert.match(editor,/locked=\{!canEditIdentity\}/);
 assert.match(editor,/locked=\{!canEditTeam\}/);
 assert.match(editor,/fieldset disabled=\{!canEditIdentity\}/);
 assert.match(editor,/fieldset disabled=\{!canEditTeam\}/);
 assert.match(editor,/if\(!file\|\|!canEditTeam\)return/);
 assert.match(editor,/disabled=\{!canEditTeam\|\|!!uploadingMemberId\|\|busy\|\|demo\}/);
 assert.match(navigator,/const groups=isDeveloper\?/);
 assert.match(navigator,/isDeveloper=false/);
});
test('nondeveloper saves consult live permissions, preserve forbidden fields, and use database guard',async()=>{
 const code=await read('src/lib/siteSettings.js');
 const api=await read('src/lib/siteEditPermissions.js');
 assert.match(code,/const permissions=await loadSiteEditPermissions\(\)/);
 assert.match(code,/permissions\.allow_admin_identity\?SITE_IDENTITY_FIELDS/);
 assert.match(code,/permissions\.allow_admin_team\?SITE_TEAM_FIELDS/);
 assert.match(code,/if\(!OWNER_FIELDS\.has\(key\)\|\|allowed\.has\(key\)\)content\[key\]=value/);
 assert.match(api,/\.from\('site_edit_permissions'\)/);
 assert.match(api,/\.update\(requested\)\.eq\('id',1\)/);
 assert.match(api,/\.select\('allow_admin_identity,allow_admin_team'\)/);
});
test('database restricts developer switches, protected settings, and team storage writes independently',async()=>{
 const sql=await read('supabase/developer_site_permissions.sql');
 assert.match(sql,/allow_admin_identity boolean not null default false/);
 assert.match(sql,/allow_admin_team boolean not null default false/);
 assert.match(sql,/alter table public\.site_edit_permissions enable row level security/);
 assert.match(sql,/grant update\(allow_admin_identity,allow_admin_team\) on public\.site_edit_permissions to authenticated/);
 assert.match(sql,/site_edit_permissions_developer_write/);
 assert.match(sql,/with check \(\(select public\.is_site_owner\(\)\)\)/);
 assert.match(sql,/app_private\.site_settings_owner_guard\(\)/);
 assert.match(sql,/allow_identity:=is_admin and coalesce\(allow_identity,false\)/);
 assert.match(sql,/allow_team:=is_admin and coalesce\(allow_team,false\)/);
 assert.match(sql,/raise exception 'Platform developer disabled supervisor edits to identity'/);
 assert.match(sql,/raise exception 'Platform developer disabled supervisor edits to team'/);
 assert.match(sql,/name ~ '\^team\/\[0-9a-f-\]\{36\}\[.\]webp\$'/);
 assert.match(sql,/public\.can_edit_site_team\(\)/);
 assert.doesNotMatch(sql,/grant (?:insert|delete) on public\.site_edit_permissions to authenticated/);
});
test('the protected account is called platform developer throughout account management',async()=>{
 const accountManager=await read('src/components/AccountManager.jsx');
 const accountEdge=await read('supabase/functions/account-control/index.ts');
 assert.match(accountManager,/مطور المنصة/);
 assert.doesNotMatch(accountManager,/مالك المنصة/);
 assert.match(accountManager,/a\.is_owner&&<small>\(مطور المنصة\)<\/small>/);
 assert.match(accountEdge,/مطور المنصة/);
 assert.match(accountEdge,/userId===owner\.user_id&&!isOwner/);
});
