/* HSA 4 Study service worker.
 * Only first-party static assets and explicitly public team pictures are cached.
 * Supabase API, authentication, RPC and private Storage requests are never cached.
 * The production build replaces the placeholder tokens with the exact asset manifest.
 */
const VERSION=__HSA_BUILD_VERSION__;
const SHELL_CACHE='hsa-shell-'+VERSION;
const PUBLIC_IMAGES_CACHE='hsa-public-images-v1';
const PRECACHE=__HSA_PRECACHE_LIST__;
const MAX_PUBLIC_IMAGES=100;
const isPublicImage=url=>url.hostname==='oaihjgmmoxvunuxtucin.supabase.co'
 && /^\/storage\/v1\/object\/public\/team-avatars\/(?:team|staff)\//.test(url.pathname);

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(SHELL_CACHE);
  await cache.addAll(PRECACHE);
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('hsa-shell-')&&key!==SHELL_CACHE)
   .map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
async function trimPublicPictures(cache){
 const keys=await cache.keys();
 if(keys.length<=MAX_PUBLIC_IMAGES)return;
 await Promise.all(keys.slice(0,keys.length-MAX_PUBLIC_IMAGES).map(key=>cache.delete(key)));
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin===self.location.origin){
  if(url.pathname.startsWith('/.netlify/')||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
   event.respondWith((async()=>{
    try{
     const controller=new AbortController();
     const timeout=setTimeout(()=>controller.abort(),3500);
     try{
      const response=await fetch(request,{signal:controller.signal});
      if(response.ok){
       const cache=await caches.open(SHELL_CACHE);
       await cache.put('/',response.clone());
      }
      return response;
     }finally{clearTimeout(timeout)}
    }catch{
     return await caches.match('/')||await caches.match('/index.html')
      ||new Response('الموقع غير محفوظ بعد. افتحه مرة مع الاتصال بالإنترنت.',{
       status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    }
   })());
   return;
  }
  event.respondWith((async()=>{
   const cached=await caches.match(request,{ignoreSearch:true});
   if(cached)return cached;
   try{
    const response=await fetch(request);
    if(response.ok&&PRECACHE.includes(url.pathname)){
     const cache=await caches.open(SHELL_CACHE);
     await cache.put(request,response.clone());
    }
    return response;
   }catch{
    return Response.error();
   }
  })());
  return;
 }
 // Public pictures are deliberately reusable and non-sensitive; private assets are not.
 if(isPublicImage(url)){
  event.respondWith((async()=>{
   const cache=await caches.open(PUBLIC_IMAGES_CACHE);
   const cached=await cache.match(request);
   if(cached)return cached;
   try{
    const response=await fetch(request);
    if(response.ok||response.type==='opaque'){
     await cache.put(request,response.clone()).catch(()=>{});
     await trimPublicPictures(cache).catch(()=>{});
    }
    return response;
   }catch{return Response.error()}
  })());
 }
});
self.addEventListener('message',event=>{
 if(event.data?.type==='HSA_OFFLINE_VERSION'){
  event.source?.postMessage({type:'HSA_OFFLINE_VERSION',version:VERSION,precache:PRECACHE.length});
 }
});
