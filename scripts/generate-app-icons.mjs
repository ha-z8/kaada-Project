import {deflateSync} from 'node:zlib';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),body=Buffer.concat([name,data]),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);body.copy(out,4);out.writeUInt32BE(crc32(body),out.length-4);return out;}
function png(n,rgba){const h=Buffer.alloc(13);h.writeUInt32BE(n,0);h.writeUInt32BE(n,4);h[8]=8;h[9]=6;const scan=Buffer.alloc(n*(n*4+1));for(let y=0;y<n;y++)rgba.copy(scan,y*(n*4+1)+1,y*n*4,(y+1)*n*4);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);}
export async function generateAppIcons(destination){
 const svg=await readFile(resolve('public/favicon.svg'),'utf8');
 const layers=[...svg.matchAll(/<path fill="(#\w{6})" fill-rule="evenodd" d="([^"]+)"/g)].map(([,color,d])=>({rgb:Buffer.from(color.slice(1),'hex'),polys:[...d.matchAll(/M([^Z]+)Z/g)].map(([,p])=>p.trim().split(/\s+/).map(q=>q.split(',').map(Number)))}));
 if(layers.length!==3||layers.some(l=>l.polys.some(p=>p.some(q=>q.length!==2||q.some(v=>!Number.isFinite(v))))))throw Error('Unexpected HSA icon geometry');
 for(const [file,scale] of [['hsa-icon-512.png',1],['hsa-maskable-512.png',.76]]){
  const n=512,ss=2,w=n*ss,raw=Buffer.alloc(w*w*4,255),factor=w/775*scale;
  for(const {rgb,polys} of layers){
   const projected=polys.map(p=>p.map(([x,y])=>[(x-469.5)*factor+w/2,(y-332.5)*factor+w/2]));
   for(let y=0;y<w;y++){
    const yy=y+.5,edges=[];
    for(const p of projected)for(let i=0;i<p.length;i++){const [ax,ay]=p[i],[bx,by]=p[(i+1)%p.length];if((ay>yy)!==(by>yy))edges.push(ax+(yy-ay)*(bx-ax)/(by-ay));}
    edges.sort((a,b)=>a-b);
    for(let i=0;i+1<edges.length;i+=2)for(let x=Math.max(0,Math.ceil(edges[i]-.5));x<Math.min(w,Math.ceil(edges[i+1]-.5));x++){const o=(y*w+x)*4;raw[o]=rgb[0];raw[o+1]=rgb[1];raw[o+2]=rgb[2];}
   }
  }
  const rgba=Buffer.alloc(n*n*4,255);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)for(let c=0;c<3;c++){let v=0;for(let dy=0;dy<ss;dy++)for(let dx=0;dx<ss;dx++)v+=raw[((y*ss+dy)*w+x*ss+dx)*4+c];rgba[(y*n+x)*4+c]=Math.round(v/(ss*ss));}
  await writeFile(resolve(destination,file),png(n,rgba));
 }
}
