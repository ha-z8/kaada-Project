import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {teamAvatarPublicUrl} from '../src/lib/teamAvatars.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('only members with a real uploaded portrait have a clickable view button',async()=>{
 const about=await source('src/components/AboutPage.jsx');
 assert.match(about,/teamAvatarPublicUrl\(member\.avatarPath\)/);
 assert.match(about,/className="about-member-photo-trigger"/);
 assert.match(about,/onClick=\{\(\)=>setViewedMember\(member\)\}/);
 assert.match(about,/aria-label=\{'عرض صورة '/);
 assert.match(about,/:<TeamAvatar member=\{member\}\/>/);
});

test('image viewer opens complete uploaded photo rather than card crop',async()=>{
 const viewer=await source('src/components/TeamImageViewer.jsx');
 const valid='team/123e4567-e89b-42d3-a456-426614174000.webp';
 assert.ok(teamAvatarPublicUrl(valid).startsWith('https://'));
 assert.match(viewer,/teamAvatarPublicUrl\(member\?\.avatarPath\)/);
 assert.match(viewer,/<img src=\{imageUrl\}/);
 assert.doesNotMatch(viewer,/avatarImageGeometry|avatarZoom|avatarX/);
 assert.match(viewer,/createPortal\(/);
 assert.match(viewer,/role="dialog" aria-modal="true"/);
});

test('viewer restores focus, supports Escape and backdrop dismissal and locks scroll',async()=>{
 const viewer=await source('src/components/TeamImageViewer.jsx');
 assert.match(viewer,/document\.activeElement/);
 assert.match(viewer,/previousFocus\.focus\(\)/);
 assert.match(viewer,/document\.body\.style\.overflow='hidden'/);
 assert.match(viewer,/document\.body\.style\.overflow=previousOverflow/);
 assert.match(viewer,/e\.key==='Escape'/);
 assert.match(viewer,/e\.key==='Tab'/);
 assert.match(viewer,/e\.target===e\.currentTarget/);
 assert.match(viewer,/aria-label="إغلاق عرض الصورة"/);
});
test('mobile and desktop styles use contained imagery, not stretched/cropped pictures',async()=>{
 const styles=await source('src/styles.css');
 assert.match(styles,/\.team-image-lightbox-stage img\s*\{/);
 assert.match(styles,/object-fit:contain/);
 assert.match(styles,/max-height:calc\(100dvh - 125px\)/);
 assert.match(styles,/\.about-member-photo-trigger:focus-visible/);
});
