import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeSiteSettings,SITE_OWNER_FIELDS} from '../src/lib/siteSettings.js';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('About narration is enabled by default for legacy data, false disables it',()=>{
 assert.equal(normalizeSiteSettings({}).aboutNarrationEnabled,true);
 assert.equal(normalizeSiteSettings({aboutNarrationEnabled:true}).aboutNarrationEnabled,true);
 assert.equal(normalizeSiteSettings({aboutNarrationEnabled:false}).aboutNarrationEnabled,false);
 assert.ok(SITE_OWNER_FIELDS.includes('aboutNarrationEnabled'));
});

test('narrator only mounts if developer setting allows it, and is never fixed over registration',async()=>{
 const about=await source('src/components/AboutPage.jsx');
 const css=await source('src/styles.css');
 assert.match(about,/!preview&&site\.aboutNarrationEnabled&&<div className="about-narration-slot">/);
 assert.ok(about.indexOf('about-narration-slot')<about.indexOf('site.sectionOrder.map(renderSection)'));
 assert.match(css,/\.about-narration-slot>\.about-narration\{\s*position:relative/);
 assert.match(css,/\.about-narration-slot>\.about-narration\.is-collapsed\{\s*position:relative/);
 assert.match(css,/\.about-page:has\(\.about-narration\.is-collapsed\)\{padding-bottom:0\}/);
});
test('the toggle is only rendered inside platform developer settings, and searchable',async()=>{
 const editor=await source('src/components/SiteSettingsPage.jsx');
 const search=await source('src/lib/settingsNavigation.js');
 assert.match(editor,/isSiteOwner&&visiblePanelIds\.has\('developer'\)/);
 assert.match(editor,/data-setting-key="aboutNarrationEnabled"/);
 assert.match(editor,/checked=\{draft\.aboutNarrationEnabled\}/);
 assert.match(editor,/update\('aboutNarrationEnabled',e\.target\.checked\)/);
 assert.match(editor,/saveSiteSettings\(draft\)/);
 assert.match(search,/aboutNarrationEnabled/);
});
test('server protects developer-only visibility setting even when JSON is forged',async()=>{
 const sql=await source('supabase/about_narration_visibility_owner_guard.sql');
 const settings=await source('src/lib/siteSettings.js');
 assert.match(sql,/new\.content -> 'aboutNarrationEnabled'/);
 assert.match(sql,/old\.content -> 'aboutNarrationEnabled'/);
 assert.match(sql,/not app_private\.is_site_owner\(\)/);
 assert.match(sql,/before update of content on public\.site_settings/);
 assert.match(settings,/if\(!OWNER_FIELDS\.has\(key\)\|\|allowed\.has\(key\)\)content\[key\]=value/);
});
