import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {readdir,readFile,stat,writeFile,copyFile,mkdir} from 'node:fs/promises';
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
// Keep TTS runtime on this origin. Large voice ONNX models are downloaded once
// into OPFS instead of bloating Git history or mandatory app-shell installation.
function copyLocalTtsRuntimePlugin(){
 return {
  name:'hsa-local-tts-runtime',
  apply:'build',
  async closeBundle(){
   const destination=resolve('dist/tts-runtime');
   await mkdir(destination,{recursive:true});
   const files=[];
   for(const name of ['piper_phonemize.data','piper_phonemize.wasm']){
    const from=resolve('node_modules/@diffusionstudio/piper-wasm/build',name);
    await copyFile(from,resolve(destination,name));
    files.push('/tts-runtime/'+name);
   }
   const directory=resolve('node_modules/onnxruntime-web/dist');
   const ortFiles=(await readdir(directory))
    .filter(name=>/^ort-wasm.*\.(?:wasm|mjs)$/.test(name));
   if(!ortFiles.some(name=>name.endsWith('.wasm')))
    throw Error('Offline ONNX runtime assets are missing.');
   for(const name of ortFiles){
    await copyFile(resolve(directory,name),resolve(destination,name));
    files.push('/tts-runtime/'+name);
   }
   await writeFile(resolve(destination,'manifest.json'),JSON.stringify({files},null,2));
  }
 };
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
   // Voice runtime files are loaded into a separate optional offline cache.
   // Do not make the PWA shell installation fail on low-storage devices.
   const allowed=entries.filter(f=>f.size<=18*1024*1024 &&
    !/^\/tts-runtime\/(?!manifest\.json)/.test(f.path));
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
 plugins:[react(),tailwindcss(),copyLocalTtsRuntimePlugin(),offlineManifestPlugin()],
 // Source maps stay unavailable in production; bundle identifiers and styles
 // are minified. Do not pretend client JavaScript can be encrypted or hidden.
 esbuild:{drop:['debugger']},
 build:{
  outDir:'dist',
  sourcemap:false,
  minify:'esbuild',
  cssMinify:'esbuild'
 }
});
