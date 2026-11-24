import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const template=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
const source=template.replace('__HSA_BUILD_VERSION__','"test-build"')
 .replace('__HSA_PRECACHE_LIST__','["/","/index.html","/assets/app.js","/assets/app.css","/manifest.webmanifest"]');
function workerRuntime(){
 const handlers=new Map();
 const databases=new Map();
 const requests=[];
 let connected=true;
 const key=req=>{
  const text=typeof req==='string'?req:req.url;
  return new URL(text,'https://hsa.test').pathname;
 };
 const open=async name=>{
  if(!databases.has(name))databases.set(name,new Map());
  const data=databases.get(name);
  return {
   async addAll(paths){for(const p of paths)data.set(key(p),new Response('cached:'+p))},
   async match(req){return data.get(key(req))?.clone()},
   async put(req,response){data.set(key(req),response.clone())},
   async keys(){return [...data.keys()]},
   async delete(req){return data.delete(key(req))}
  };
 };
 const caches={
  open,async keys(){return [...databases.keys()]},
  async delete(name){return databases.delete(name)},
  async match(req){for(const name of databases.keys()){
   const found=await (await open(name)).match(req);
   if(found)return found;
  }return undefined}
 };
 const self={
  location:{origin:'https://hsa.test'},clients:{claim:async()=>{}},
  skipWaiting:async()=>{},
  addEventListener(name,callback){handlers.set(name,callback)}
 };
 const fetch=async req=>{
  requests.push(key(req));
  if(!connected)throw new TypeError('Failed to fetch');
  return new Response('network:'+key(req),{status:200});
 };
 runInNewContext(source,{self,caches,URL,Response,fetch,Promise,setTimeout,clearTimeout});
 async function dispatch(name,request){
  let promise;
  const event={
   request,
   waitUntil(p){promise=p},
   respondWith(p){promise=p}
  };
  handlers.get(name)(event);
  return promise?await promise:undefined;
 }
 return {dispatch,caches,databases,requests,disconnect:()=>{connected=false}};
}
test('service worker precaches all application files before going offline',async()=>{
 const sw=workerRuntime();
 await sw.dispatch('install');
 assert.ok(sw.databases.has('hsa-shell-test-build'));
 const cache=await sw.caches.open('hsa-shell-test-build');
 assert.equal(await (await cache.match('/assets/app.js')).text(),'cached:/assets/app.js');
 assert.equal(await (await cache.match('/assets/app.css')).text(),'cached:/assets/app.css');
});
test('reopening cached site and requesting code succeeds with absolutely no network',async()=>{
 const sw=workerRuntime();
 await sw.dispatch('install');
 sw.disconnect();
 const home=await sw.dispatch('fetch',{url:'https://hsa.test/reader',method:'GET',mode:'navigate'});
 assert.equal(await home.text(),'cached:/');
 const js=await sw.dispatch('fetch',{url:'https://hsa.test/assets/app.js',method:'GET',mode:'no-cors'});
 assert.equal(await js.text(),'cached:/assets/app.js');
});
test('signed/private Supabase API operations are never serviced from offline shell cache',async()=>{
 const sw=workerRuntime();
 await sw.dispatch('install');
 const noApi=await sw.dispatch('fetch',{
  url:'https://oaihjgmmoxvunuxtucin.supabase.co/rest/v1/sections',method:'GET',mode:'cors'
 });
 assert.equal(noApi,undefined);
 const noAuth=await sw.dispatch('fetch',{
  url:'https://oaihjgmmoxvunuxtucin.supabase.co/auth/v1/user',method:'GET',mode:'cors'
 });
 assert.equal(noAuth,undefined);
 const noWrite=await sw.dispatch('fetch',{
  url:'https://hsa.test/api/write',method:'POST',mode:'cors'
 });
 assert.equal(noWrite,undefined);
});
test('worker activation removes old shell versions but retains offline public image storage',async()=>{
 const sw=workerRuntime();
 await sw.caches.open('hsa-shell-older');
 await sw.caches.open('hsa-public-images-v1');
 await sw.dispatch('install');
 await sw.dispatch('activate');
 assert.ok(sw.databases.has('hsa-shell-test-build'));
 assert.ok(!sw.databases.has('hsa-shell-older'));
 assert.ok(sw.databases.has('hsa-public-images-v1'));
});

test('installed shell navigation does not mix network HTML with cached scripts',async()=>{const sw=workerRuntime();await sw.dispatch('install');const home=await sw.dispatch('fetch',{url:'https://hsa.test/reader',method:'GET',mode:'navigate'});assert.equal(await home.text(),'cached:/');assert.equal(sw.requests.length,0);});
