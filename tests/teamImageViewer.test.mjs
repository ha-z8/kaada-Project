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
 assert.match(viewer,/<img className="team-image-lightbox-photo" src=\{imageUrl\}/);
 assert.doesNotMatch(viewer,/avatarImageGeometry|avatarZoom|avatarX/);
 assert.match(viewer,/createPortal\(/);
 assert.match(viewer,/role="dialog" aria-modal="true"/);
 assert.match(viewer,/className="team-image-lightbox-photo"/);
 assert.doesNotMatch(viewer,/<header|team-image-lightbox-header|team-image-lightbox-stage/);
 assert.doesNotMatch(viewer,/className="team-image-lightbox"/);
 assert.match(viewer,/<div className="team-image-lightbox-backdrop" role="dialog"/);
 assert.match(viewer,/className="team-image-lightbox-close"[\s\S]*?<img className="team-image-lightbox-photo"/);
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
 assert.match(styles,/\.team-image-lightbox-backdrop > \.team-image-lightbox-photo\s*\{/);
 assert.match(styles,/object-fit:contain/);
 assert.match(styles,/max-height:calc\(100dvh - 24px\)/);
 assert.match(styles,/background:transparent;border:0;border-radius:0;box-shadow:none/);
 assert.doesNotMatch(styles,/\.team-image-lightbox\s*\{/);
 assert.match(styles,/\.about-member-photo-trigger:focus-visible/);
});

test('team is first below About intro, and admins retain the ability to reorder sections',async()=>{
 const {DEFAULT_SITE_SETTINGS,ABOUT_SECTION_IDS,normalizeSiteSettings}=await import('../src/lib/siteSettings.js');
 assert.equal(DEFAULT_SITE_SETTINGS.sectionOrder[0],'team');
 assert.equal(ABOUT_SECTION_IDS[0],'team');
 assert.equal(normalizeSiteSettings({}).sectionOrder[0],'team');
 const manual=normalizeSiteSettings({sectionOrder:['mission','team','features','steps','sample','notes']});
 assert.equal(manual.sectionOrder[0],'mission');
 assert.equal(manual.sectionOrder[1],'team');
 const about=await source('src/components/AboutPage.jsx');
 assert.match(about,/site\.sectionOrder\.map\(renderSection\)/);
});
