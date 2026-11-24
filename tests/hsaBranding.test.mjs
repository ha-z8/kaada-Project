import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateAppIcons} from '../scripts/generate-app-icons.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('official HSA 4 Study name and icon appear in HTML metadata',()=>{
  const html=read('index.html');
  assert.match(html,/<title>HSA 4 Study\s*\|/);
  assert.match(html,/name="apple-mobile-web-app-title" content="HSA 4 Study"/);
  assert.match(html,/rel="icon"[^>]*href="\/favicon\.svg/);
  assert.match(html,/rel="manifest" href="\/manifest\.webmanifest"/);
  assert.doesNotMatch(html,/KAADA (?:Pro|Study)/);
});
test('official HSA SVG contains recognizable book-lettermark and approved palette',()=>{
  const svg=read('public/hsa-logo.svg');
  assert.match(svg,/aria-label="HSA 4 Study book logo"/);
  for(const color of ['#11381D','#C2DBC9','#B08551','#00804A'])assert.ok(svg.includes(color),color);
  assert.match(svg,/<path/);
  const favicon=read('public/favicon.svg');
  assert.match(favicon,/viewBox=/);
  assert.doesNotMatch(favicon,/KAADA/);
});
test('site manifest points to valid real PNG and SVG icons',async()=>{
  const manifest=JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.name,'HSA 4 Study');
  assert.equal(manifest.short_name,'HSA 4 Study');
  assert.equal(manifest.theme_color,'#11381D');
  const dir=await mkdtemp(join(tmpdir(),'hsa-icons-'));
  try{await generateAppIcons(dir);
   for(const icon of manifest.icons){
    assert.ok(icon.src.startsWith('/'));
    if(icon.sizes==='512x512'){const bytes=readFileSync(join(dir,icon.src.slice(1)));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),512);assert.equal(bytes.readUInt32BE(20),512);assert.ok(bytes.length>1000);}
    else assert.ok(existsSync(new URL('../public'+icon.src,import.meta.url)),icon.src);
   }
  }finally{await rm(dir,{recursive:true,force:true});}
  const png=readFileSync(new URL('../public/hsa-icon-192.png',import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),192);
  assert.equal(png.readUInt32BE(20),192);
  assert.ok(png.length>1000);
});
test('login, sidebar and footer retain HSA branding while dashboard hero keeps original book artwork',()=>{
  const app=read('src/App.jsx');
  assert.match(app,/brand-logo-sidebar/);
  assert.match(app,/brand-logo-auth/);
  assert.match(app,/hero-illustration/);
  assert.match(app,/hero-paper-front/);
  assert.match(app,/floating-headphones/);
  assert.doesNotMatch(app,/className="hero-brand-panel"/);
  assert.match(app,/HSA 4 Study/);
  assert.doesNotMatch(app,/KAADA (?:Pro|Study)/);
});
