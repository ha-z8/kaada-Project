import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {readdir,readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';

async function listFiles(directory){
 const result=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const absolute=resolve(directory,entry.name);
  if(entry.isDirectory())result.push(...await listFiles(absolute));
  else if(entry.isFile())result.push(absolute);
 }
 return result;
}
function offlineManifestPlugin(){
 return {
  name:'hsa-offline-manifest',
  apply:'build',
  async closeBundle(){
   const dist=resolve('dist');
   const files=await listFiles(dist);
   // Cache production shell/assets/icons and local fonts, not private data or maps.
   const entries=await Promise.all(files.filter(f=>!/\/sw\.js$|\.map$/.test(f.replaceAll('\\','/')))
    .map(async f=>({path:'/'+relative(dist,f).split(sep).join('/'),size:(await stat(f)).size})));
   const allowed=entries.filter(f=>f.size<=18*1024*1024);
   if(!allowed.some(f=>f.path==='/index.html'))throw Error('Offline build missing index.html');
   const paths=[...new Set(['/',...allowed.map(f=>f.path)])].sort();
   const version=createHash('sha256').update(JSON.stringify(allowed)).digest('hex').slice(0,14);
   const template=await readFile(resolve('public/sw.js'),'utf8');
   const worker=template.replace('__HSA_BUILD_VERSION__',JSON.stringify(version))
    .replace('__HSA_PRECACHE_LIST__',JSON.stringify(paths));
   await writeFile(resolve(dist,'sw.js'),worker);
  }
 };
}
export default defineConfig({
 plugins:[react(),tailwindcss(),offlineManifestPlugin()],
 build:{outDir:'dist',sourcemap:false}
});
