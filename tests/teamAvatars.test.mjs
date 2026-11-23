import test from 'node:test';
import assert from 'node:assert/strict';
import {validTeamAvatarPath,normalizeSiteSettings} from '../src/lib/siteSettings.js';
import {teamAvatarPublicUrl,validateAvatarFile,MAX_SOURCE_AVATAR_BYTES,TEAM_AVATAR_BUCKET} from '../src/lib/teamAvatars.js';

const path='team/123e4567-e89b-42d3-a456-426614174000.webp';

test('the photo is stored on the member and preserved by settings normalization',()=>{
 const custom=normalizeSiteSettings({team:[{id:'someone',name:'مسؤول المحتوى',role:'مشارك',avatarPath:path,socials:[]}]});
 assert.equal(custom.team[0].avatarPath,path);
 assert.equal(custom.team[0].name,'مسؤول المحتوى');
 assert.equal(normalizeSiteSettings({team:[{name:'عضو'}]}).team[0].avatarPath,'');
});
test('rejects external URLs, unsupported paths and unsafe objects in About settings',()=>{
 for(const bad of [
  'https://example.com/photo.webp','team/../../secret.webp','team/not-a-uuid.webp',
  '/team/123e4567-e89b-42d3-a456-426614174000.webp',
  'team/123e4567-e89b-42d3-a456-426614174000.svg',
  'team/123e4567-e89b-42d3-a456-426614174000.webp?hack',
 ]){
  assert.equal(validTeamAvatarPath(bad),false,bad);
  assert.equal(teamAvatarPublicUrl(bad),'',bad);
  assert.equal(normalizeSiteSettings({team:[{name:'عضو',avatarPath:bad}]}).team[0].avatarPath,'');
 }
 assert.equal(validTeamAvatarPath(path),true);
});
test('the local public URL points to the dedicated original team portrait bucket',()=>{
 assert.equal(TEAM_AVATAR_BUCKET,'team-avatars');
 const url=teamAvatarPublicUrl(path);
 assert.ok(url.startsWith('https://'));
 assert.match(url,/storage\/v1\/object\/public\/team-avatars\/team\//);
 assert.ok(url.endsWith(path));
});
test('only lightweight supported image files may be uploaded',()=>{
 assert.equal(validateAvatarFile({size:1024,type:'image/jpeg'}),true);
 assert.equal(validateAvatarFile({size:2048,type:'image/png'}),true);
 assert.equal(validateAvatarFile({size:1024,type:'image/webp'}),true);
 assert.throws(()=>validateAvatarFile({size:0,type:'image/png'}),/فارغ/);
 assert.throws(()=>validateAvatarFile({size:MAX_SOURCE_AVATAR_BYTES+1,type:'image/png'}),/الحد الأقصى/);
 assert.throws(()=>validateAvatarFile({size:1024,type:'image/svg+xml'}),/غير مدعوم/);
 assert.throws(()=>validateAvatarFile({size:1024,type:'text/html'}),/غير مدعوم/);
});
