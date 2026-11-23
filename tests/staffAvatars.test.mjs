import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validStaffAvatarPath,validAccountAvatarPath,accountAvatarPublicUrl,teamAvatarPublicUrl} from '../src/lib/teamAvatars.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const owner='2c78de9c-68e9-4727-80ce-d11b60123e12';
const photo='38096e7b-a2ed-411a-bac1-af00cbdf6879';
const staff='staff/'+owner+'/'+photo+'.webp';
const team='team/'+photo+'.webp';

test('profile images accept only team photos or individual staff folder webp paths',()=>{
 assert.equal(validStaffAvatarPath(staff),true);
 assert.equal(validStaffAvatarPath(team),false);
 assert.equal(validAccountAvatarPath(team),true);
 assert.equal(validAccountAvatarPath(staff),true);
 assert.equal(validAccountAvatarPath('javascript:alert(1)'),false);
 assert.equal(validAccountAvatarPath('https://example.net/photo.webp'),false);
 assert.equal(validAccountAvatarPath('staff/../../evil.webp'),false);
 assert.equal(accountAvatarPublicUrl('staff/../../evil.webp'),'');
 assert.ok(accountAvatarPublicUrl(staff).includes('/team-avatars/staff/'));
 assert.ok(teamAvatarPublicUrl(team).includes('/team-avatars/team/'));
 assert.equal(teamAvatarPublicUrl(staff),'');
});

test('owner team photo upload button and frame editor are clickable again',async()=>{
 const css=await source('src/styles.css');
 const form=await source('src/components/SiteSettingsPage.jsx');
 assert.match(css,/\.owner-readonly-fieldset:disabled \.team-photo-upload\{pointer-events:none/);
 assert.match(css,/\.owner-readonly-fieldset:disabled \.photo-frame-editor\{pointer-events:none/);
 assert.doesNotMatch(css,/\.owner-readonly-fieldset \.team-photo-upload\{pointer-events:none/);
 assert.doesNotMatch(css,/\.owner-readonly-fieldset \.photo-frame-editor\{pointer-events:none/);
 assert.match(form,/uploadMemberPhoto\(member\.id,file\)/);
 assert.match(form,/team-photo-upload-status/);
 assert.match(form,/setPhotoStatus\(\{memberId,message:'نجح رفع الصورة/);
 assert.doesNotMatch(form,/deleteUnusedTeamAvatars/);
});

test('self-edit profile pictures are restricted to staff user and only avatar_path column',async()=>{
 const sql=await source('supabase/staff_avatars.sql');
 const adminSql=await source('supabase/staff_avatar_admin_upload.sql');
 assert.match(sql,/add column if not exists avatar_path/);
 assert.match(sql,/grant update \(avatar_path\) on public\.user_profiles to authenticated/);
 assert.match(sql,/user_profiles_self_avatar_update/);
 assert.match(sql,/user_id = \(select auth\.uid\(\)\)/);
 assert.match(sql,/staff_avatar_upload/);
 assert.match(sql,/role in \('admin','teacher'\)/);
 assert.match(adminSql,/staff_avatar_admin_upload/);
 assert.match(adminSql,/actor\.role = 'admin'/);
 assert.doesNotMatch(adminSql,/target\.role/);
 assert.match(sql,/storage\.foldername\(name\)/);
 assert.match(adminSql,/name ~ '\^staff\//);
});

test('staff avatar upload returns user-specific URL-safe storage path',async()=>{
 const uploader=await source('src/lib/teamAvatars.js');
 assert.match(uploader,/export async function uploadAccountAvatar\(file,targetUserId\)/);
 assert.match(uploader,/supabase\.auth\.getUser\(\)/);
 assert.match(uploader,/const path='staff\/'\+\(targetUserId\|\|user\.id\)/);
 assert.match(uploader,/upsert:false/);
});

test('staff can change portrait in My Account, and owner/team images can be reused without copying',async()=>{
 const account=await source('src/components/MyAccountSettings.jsx');
 const picker=await source('src/components/AvatarPicker.jsx');
 const avatar=await source('src/components/AccountAvatar.jsx');
 const app=await source('src/App.jsx');
 assert.match(account,/from\('user_profiles'\)\.update\(\{avatar_path:path\}\)/);
 assert.match(account,/onAvatarUpdated\?\.\(\{\.\.\.profile,avatar_path:data\.avatar_path\}\)/);
 assert.match(picker,/teamAvatarPublicUrl\(person\.avatarPath\)/);
 assert.match(picker,/uploadAccountAvatar\(file,targetUserId\)/);
 assert.match(picker,/onClick=\{\(\)=>void select\(person\.avatarPath\)\}/);
 assert.match(avatar,/accountAvatarPublicUrl\(path\)/);
 assert.match(app,/teamPhotos=\{siteSettings\.team\}/);
 assert.match(app,/AccountAvatar path=\{isStaff\?profile\?\.avatar_path:''\}/);
});

test('admin dashboard lists and edits staff portraits; server validates image paths and protects owner account',async()=>{
 const admin=await source('src/components/AccountManager.jsx');
 const edge=await source('supabase/functions/account-control/index.ts');
 assert.match(admin,/AccountAvatar path=\{a\.avatar_path\}/);
 assert.match(admin,/AvatarPicker value=\{form\.avatar_path\}/);
 assert.match(admin,/requiresSave/);
 assert.match(admin,/avatar_path:form\.avatar_path\|\|''/);
 assert.match(edge,/allowAvatar\(db,avatarPath,null\)/);
 assert.match(edge,/allowAvatar\(db,selectedAvatar,userId\)/);
 assert.match(edge,/\.select\("user_id,username,display_name,avatar_path,created_at"\)/);
 assert.match(edge,/userId===owner\.user_id&&!isOwner/);
 assert.match(edge,/team\.some\(member=>member\.avatarPath===path\)/);
});
