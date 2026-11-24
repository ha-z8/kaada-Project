import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSiteSettings} from '../src/lib/siteSettings.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('studio uses a single page viewport and player, with contextual annotation and settings panels',()=>{
 const source=read('src/components/OriginalDocumentReader.jsx');
 assert.equal((source.match(/className="document-sheet-wrap"/g)||[]).length,1);
 assert.equal((source.match(/className="document-reader-dock"/g)||[]).length,1);
 assert.match(source,/DocumentPageNavigator/);assert.match(source,/studio-panel-scroll/);
 assert.match(source,/previewSpeaker/);assert.match(source,/\{isAdmin&&blob&&/);
});
test('about guide describes current original document and preserves custom identity',()=>{
 const site=normalizeSiteSettings({siteName:'Custom',aboutTitle:'Custom guide',team:[]});
 assert.equal(site.aboutTitle,'Custom guide');assert.equal(site.siteName,'Custom');assert.equal(site.team.length,0);
 assert.ok(site.features.some(f=>f.id==='marks'));assert.ok(site.features.some(f=>f.id==='review'));
});
