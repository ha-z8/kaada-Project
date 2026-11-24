import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {readdir,readFile,stat,writeFile,cp,copyFile,mkdir} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {generateAppIcons} from './scripts/generate-app-icons.mjs';

async function listFiles(directory){
 const result=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const absolute=resolve(directory,entry.name);
  if(entry.isDirectory())result.push(...await listFiles(absolute));
  else if(entry.isFile())result.push(absolute);
 }
 return result;
}
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
function copyTranslationRuntimePlugin(){
 return {name:'hsa-local-translation-runtime',apply:'build',async closeBundle(){
  const dest=resolve('dist/translation-runtime');await mkdir(dest,{recursive:true});
  const require=createRequire(import.meta.url);
  const packageEntry=require.resolve('@xenova/transformers/package.json');
  const directory=resolve(packageEntry,'../dist');
  let files=(await readdir(directory)).filter(name=>/^ort-wasm.*\.wasm$/.test(name));
  let source=directory;
  if(!files.length){
   const nested=createRequire(packageEntry).resolve('onnxruntime-web/package.json');
   source=resolve(nested,'../dist');files=(await readdir(source)).filter(name=>/^ort-wasm.*\.wasm$/.test(name));
  }
  if(!files.length)throw Error('Local translation WASM runtime missing.');
  for(const name of files)await copyFile(resolve(source,name),resolve(dest,name));
  await writeFile(resolve(dest,'manifest.json'),JSON.stringify({files:files.map(f=>'/translation-runtime/'+f)}));
 }};
}
function offlineManifestPlugin(){
 return {
  name:'hsa-offline-manifest',
  apply:'build',
  async closeBundle(){
   const dist=resolve('dist');
   await generateAppIcons(dist);
   // PDF fonts, CMaps and codecs are available even without internet.
   for(const name of ['cmaps','standard_fonts','wasm'])await cp(resolve('node_modules/pdfjs-dist',name),resolve(dist,'pdf-support',name),{recursive:true});
   const files=await listFiles(dist);
   // Cache production shell/assets/icons and local fonts, not private data or maps.
   const entries=await Promise.all(files.filter(f=>!/\/sw\.js$|\.map$/.test(f.replaceAll('\\','/')))
    .map(async f=>({path:'/'+relative(dist,f).split(sep).join('/'),size:(await stat(f)).size})));
   // Keep large optional files out of the mandatory PWA shell cache.
   const allowed=entries.filter(f=>f.size<=18*1024*1024 &&
    !/^\/(?:tts-runtime|translation-runtime)\/(?!manifest\.json)/.test(f.path));
   if(!allowed.some(f=>f.path==='/index.html'))throw Error('Offline build missing index.html');
   const paths=[...new Set(['/',...allowed.map(f=>f.path)])].sort();
   // Fingerprint actual bytes, not just filenames and sizes. Same-length edits must update the offline shell.
   const hash=createHash('sha256');
   for(const entry of allowed.sort((a,b)=>a.path.localeCompare(b.path))){hash.update(entry.path);hash.update(await readFile(resolve(dist,entry.path.slice(1))));}
   const version=hash.digest('hex').slice(0,14);
   const template=await readFile(resolve('public/sw.js'),'utf8');
   const worker=template.replace('__HSA_BUILD_VERSION__',JSON.stringify(version))
    .replace('__HSA_PRECACHE_LIST__',JSON.stringify(paths));
   await writeFile(resolve(dist,'sw.js'),worker);
  }
 };
}
export default defineConfig({
 plugins:[react(),tailwindcss(),copyLocalTtsRuntimePlugin(),copyTranslationRuntimePlugin(),offlineManifestPlugin()],
 worker:{format:'es'},
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
