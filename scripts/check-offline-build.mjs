import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const dist=resolve('dist');
const sw=await readFile(resolve(dist,'sw.js'),'utf8');
const html=await readFile(resolve(dist,'index.html'),'utf8');
const manifest=JSON.parse(await readFile(resolve(dist,'manifest.webmanifest'),'utf8'));
if(sw.includes('__HSA_PRECACHE_LIST__')||sw.includes('__HSA_BUILD_VERSION__'))
 throw Error('Service worker was not replaced with a production asset list.');
if(!/const VERSION="[a-f0-9]{14}"/.test(sw))throw Error('Missing versioned offline shell cache.');
const marker='const PRECACHE=';
const start=sw.indexOf(marker);
const end=sw.indexOf(';',start);
if(start<0||end<0)throw Error('Missing service worker precache manifest.');
const assets=JSON.parse(sw.slice(start+marker.length,end));
if(!assets.includes('/')||!assets.includes('/index.html')||
 !assets.some(p=>/\/assets\/.*\.js$/.test(p))||
 !assets.some(p=>/\/assets\/.*\.css$/.test(p)))
 throw Error('Offline manifest missing home, JavaScript or CSS.');
if(!html.includes('manifest.webmanifest'))throw Error('PWA manifest reference absent from entry HTML.');
if(manifest.display!=='standalone'||manifest.start_url!=='/')throw Error('Installable PWA manifest misconfigured.');
for(const url of assets){
 if(!url.startsWith('/')||url.includes('..')||url.startsWith('/api/')||
    url.startsWith('/.netlify/')||url.includes('supabase.co'))
  throw Error('Unexpected or unsafe cached resource: '+url);
}
console.log('Verified offline production shell:',assets.length,'same-origin files with a versioned service worker.');
