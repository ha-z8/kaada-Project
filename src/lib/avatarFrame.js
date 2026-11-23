// Team portrait frame settings are presentation-only; the uploaded photo is never modified.
// A responsive, centred crop is calculated from the original image's preserved aspect ratio.
export const AVATAR_FRAME_LIMITS=Object.freeze({
 width:{min:52,max:112,default:68},
 height:{min:52,max:144,default:68},
 zoom:{min:1,max:3,default:1},
 position:{min:0,max:100,default:50},
});
const bounded=(input,{min,max,default:defaultValue})=>{
 const n=Number(input);
 return Number.isFinite(n)?Math.min(max,Math.max(min,n)):defaultValue;
};
export function getAvatarFrame(member={}){
 return {
  width:Math.round(bounded(member.avatarWidth,AVATAR_FRAME_LIMITS.width)),
  height:Math.round(bounded(member.avatarHeight,AVATAR_FRAME_LIMITS.height)),
  zoom:Math.round(bounded(member.avatarZoom,AVATAR_FRAME_LIMITS.zoom)*100)/100,
  x:Math.round(bounded(member.avatarX,AVATAR_FRAME_LIMITS.position)),
  y:Math.round(bounded(member.avatarY,AVATAR_FRAME_LIMITS.position)),
 };
}
export function avatarFrameProperties(frame){
 const fixed=getAvatarFrame({
  avatarWidth:frame?.width,avatarHeight:frame?.height,avatarZoom:frame?.zoom,
  avatarX:frame?.x,avatarY:frame?.y,
 });
 return {
  avatarWidth:fixed.width,avatarHeight:fixed.height,avatarZoom:fixed.zoom,
  avatarX:fixed.x,avatarY:fixed.y,
 };
}
export function avatarImageGeometry(member,naturalWidth,naturalHeight,previewScale=1){
 const frame=getAvatarFrame(member);
 const scale=Number.isFinite(previewScale)&&previewScale>0?previewScale:1;
 const width=frame.width*scale,height=frame.height*scale;
 if(!(naturalWidth>0&&naturalHeight>0))return null;
 const cover=Math.max(width/naturalWidth,height/naturalHeight)*frame.zoom;
 const imageWidth=naturalWidth*cover,imageHeight=naturalHeight*cover;
 const overflowX=Math.max(0,imageWidth-width),overflowY=Math.max(0,imageHeight-height);
 return {
  width:imageWidth,height:imageHeight,
  left:-overflowX*frame.x/100,top:-overflowY*frame.y/100,
  overflowX,overflowY,
 };
}
export function panAvatarFrame(member,deltaX,deltaY,naturalWidth,naturalHeight,previewScale=1){
 const frame=getAvatarFrame(member);
 const geometry=avatarImageGeometry(member,naturalWidth,naturalHeight,previewScale);
 if(!geometry)return avatarFrameProperties(frame);
 const next={
  ...frame,
  x:geometry.overflowX>0.01?frame.x-100*deltaX/geometry.overflowX:frame.x,
  y:geometry.overflowY>0.01?frame.y-100*deltaY/geometry.overflowY:frame.y,
 };
 return avatarFrameProperties(next);
}
export function resizeAvatarFrame(member,deltaX,deltaY,previewScale=1){
 const current=getAvatarFrame(member);
 const factor=Number.isFinite(previewScale)&&previewScale>0?previewScale:1;
 return avatarFrameProperties({
  ...current,width:current.width-deltaX/factor,height:current.height+deltaY/factor,
 });
}
