import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 CONSOLE_COPYRIGHT_TEXT,copyrightConsoleLines,showCopyrightConsole
} from '../src/lib/copyrightConsole.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('exact Arabic copyright text and developer English name appear in a 20-line console banner',()=>{
 assert.equal(CONSOLE_COPYRIGHT_TEXT,'جميع حقوق الأكواد محفوظة لدى © 2026 | هزاع الهزاع — hazzaa alhazzaa');
 const lines=copyrightConsoleLines();
 assert.equal(lines.length,20);
 assert.ok(lines.filter(item=>item.text.includes(CONSOLE_COPYRIGHT_TEXT)).length>=4);
 assert.ok(lines.every(item=>typeof item.text==='string'&&item.text.trim()&&item.style));
 assert.ok(lines.some(item=>item.text.includes('HSA 4 STUDY')));
});

test('copyright banner is rendered only for production and uses colored DevTools text',()=>{
 const calls=[];
 const logger={log(...args){calls.push(args)}};
 assert.equal(showCopyrightConsole(logger,false),0);
 assert.equal(calls.length,0);
 assert.equal(showCopyrightConsole(logger,true),20);
 assert.equal(calls.length,20);
 for(const [message,style] of calls){
  assert.ok(message.startsWith('%c'));
  assert.ok(style.includes('color:'));
  assert.ok(style.includes('background:'));
  assert.equal(message.includes('token='),false);
 }
});

test('copyright notice prints before mounting React without breaking console inspection',async()=>{
 const main=await read('src/main.jsx');
 assert.ok(main.indexOf('showCopyrightConsole();')<main.indexOf('createRoot('));
 assert.match(main,/from '.\/lib\/copyrightConsole\.js'/);
 assert.doesNotMatch(main,/console\.clear\(|devtools-open|oncontextmenu|onkeydown=|disable.*devtools/i);
});

test('minified production JavaScript remains safely inspectable but excludes original source maps and debugger traps',async()=>{
 const vite=await read('vite.config.js');
 const packageJson=JSON.parse(await read('package.json'));
 assert.match(vite,/sourcemap:false/);
 assert.match(vite,/minify:'esbuild'/);
 assert.match(vite,/cssMinify:'esbuild'/);
 assert.match(vite,/drop:\['debugger'\]/);
 assert.match(packageJson.scripts.build,/check-offline-build\.mjs/);
 assert.match(packageJson.scripts.build,/check-production-security\.mjs/);
 const check=await read('scripts/check-production-security.mjs');
 assert.match(check,/sourceMappingURL/);
 assert.match(check,/sb_secret_/);
 assert.match(check,/PRIVATE KEY/);
 assert.match(check,/noticePresent/);
 assert.match(check,/netlify\.toml/);
});

test('Netlify security response headers defend site without blocking known authorized Supabase and AI hosts',async()=>{
 const toml=await read('netlify.toml');
 const header=toml.match(/Content-Security-Policy = "([^"]+)"/);
 assert.ok(header,'Expected enforced CSP');
 const csp=header[1];
 for(const piece of [
 "default-src 'self'","script-src 'self'","object-src 'none'",
 "frame-ancestors 'none'","base-uri 'self'","worker-src 'self' blob:",
 "https://oaihjgmmoxvunuxtucin.supabase.co",
 "wss://oaihjgmmoxvunuxtucin.supabase.co",
 "https://kaada-study-ai.kaada-p.workers.dev"
 ])assert.ok(csp.includes(piece),'Missing CSP directive: '+piece);
 assert.ok(!csp.includes("'unsafe-eval'"));
 assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"));
 for(const name of [
 'Strict-Transport-Security','Permissions-Policy','X-Frame-Options',
 'X-Content-Type-Options','Referrer-Policy','Cross-Origin-Opener-Policy'
 ])assert.ok(toml.includes(name));
 assert.match(toml,/for = "\/sw\.js"[\s\S]+?max-age=0, must-revalidate/);
 assert.match(toml,/for = "\/assets\/\*"[\s\S]+?immutable/);
});

test('the Supabase frontend client contains only a publishable key, never an administrator service credential',async()=>{
 const config=await read('src/lib/publicSupabaseConfig.js');
 const client=await read('src/lib/supabase.js');
 assert.match(config,/sb_publishable_/);
 assert.doesNotMatch(config,/sb_secret_[A-Za-z0-9_-]{8,}/);
 assert.doesNotMatch(config,/eyJ[A-Za-z0-9_-]{80,}/);
 assert.match(client,/PUBLIC_SUPABASE_KEY/);
 assert.match(client,/persistSession: true/);
});
