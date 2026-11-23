import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';

const dist=resolve('dist');
async function walk(path){
 const results=[];
 for(const item of await readdir(path,{withFileTypes:true})){
  const name=resolve(path,item.name);
  if(item.isDirectory())results.push(...await walk(name));
  else if(item.isFile())results.push(name);
 }
 return results;
}
function fail(message){throw Error('Production security validation failed: '+message)}
const files=await walk(dist);
const rel=name=>relative(dist,name).split(sep).join('/');
const unwanted=files.filter(name=>name.endsWith('.map')
 ||/(?:^|\/)(?:src|tests|scripts)\/.+\.(?:jsx?|tsx?|mjs)$/i.test(rel(name))
 ||/\.(?:ts|tsx|jsx)$/i.test(name));
if(unwanted.length)fail('Development sources or source maps were published: '+unwanted.map(rel).join(', '));

const html=await readFile(resolve(dist,'index.html'),'utf8');
if(/(?:\/src\/main\.jsx|\/@vite\/client|localhost:\d+)/i.test(html))
 fail('Production entry includes a development file or server.');
if(!/\/assets\/[^"']+\.js/.test(html))fail('Missing production JavaScript bundle reference.');

const js=files.filter(name=>extname(name)==='.js'||extname(name)==='.mjs');
if(js.length===0)fail('No browser scripts were generated.');
let noticePresent=false;
for(const name of js){
 const source=await readFile(name,'utf8');
 if(/sourceMappingURL\s*=|\/\/#\s*sourceURL\s*=/.test(source))
  fail('Debug or source map comment in '+rel(name));
 if(source.includes('hazzaa alhazzaa')&&source.includes('2026'))noticePresent=true;
 if(/sb_secret_[A-Za-z0-9_-]{12,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source))
  fail('Potential secret embedded in '+rel(name)+'; inspect locally before publishing.');
}
if(!noticePresent)fail('Expected console copyright message absent from the final bundle.');

const settings=await readFile(resolve('netlify.toml'),'utf8');
const required=[
 'Content-Security-Policy',
 "script-src 'self'",
 "connect-src 'self'",
 'https://kaada-study-ai.kaada-p.workers.dev',
 'https://oaihjgmmoxvunuxtucin.supabase.co',
 "frame-ancestors 'none'",
 "object-src 'none'",
 'X-Content-Type-Options','Referrer-Policy','Permissions-Policy',
 'X-Frame-Options','Strict-Transport-Security'
];
for(const entry of required){
 if(!settings.includes(entry))
  fail('Missing Netlify security setting: '+entry);
}

console.log('Production security checks passed:',js.length,
 'minified JS assets, no distributed sources or source maps, console notice present, security headers configured.');
