import test from 'node:test';
import assert from 'node:assert/strict';
import {
 getAvatarFrame,avatarFrameProperties,avatarImageGeometry,
 panAvatarFrame,resizeAvatarFrame,AVATAR_FRAME_LIMITS
} from '../src/lib/avatarFrame.js';
import {normalizeSiteSettings} from '../src/lib/siteSettings.js';
import {avatarFullImageSize} from '../src/lib/teamAvatars.js';

const oldMember={id:'member1',name:'عضو',avatarPath:'team/123e4567-e89b-42d3-a456-426614174000.webp'};

test('existing members use the original compact 68 by 68 frame and centred picture',()=>{
 const frame=getAvatarFrame(oldMember);
 assert.deepEqual(frame,{width:68,height:68,zoom:1,x:50,y:50});
 const member=normalizeSiteSettings({team:[oldMember]}).team[0];
 assert.equal(member.avatarWidth,68);
 assert.equal(member.avatarHeight,68);
 assert.equal(member.avatarZoom,1);
 assert.equal(member.avatarX,50);
 assert.equal(member.avatarY,50);
});

test('frame width, height, zoom, and positioning persist per team member',()=>{
 const edited={...oldMember,avatarWidth:102,avatarHeight:130,avatarZoom:1.65,avatarX:13,avatarY:83};
 const saved=normalizeSiteSettings({team:[edited,oldMember]}).team;
 assert.equal(saved[0].avatarWidth,102);
 assert.equal(saved[0].avatarHeight,130);
 assert.equal(saved[0].avatarZoom,1.65);
 assert.equal(saved[0].avatarX,13);
 assert.equal(saved[0].avatarY,83);
 assert.equal(saved[1].avatarWidth,68);
 assert.equal(saved[1].avatarY,50);
});

test('malformed or extreme settings stay inside safe compact card limits',()=>{
 const adjusted=getAvatarFrame({avatarWidth:2000,avatarHeight:-10,avatarZoom:99,avatarX:-250,avatarY:500});
 assert.equal(adjusted.width,AVATAR_FRAME_LIMITS.width.max);
 assert.equal(adjusted.height,AVATAR_FRAME_LIMITS.height.min);
 assert.equal(adjusted.zoom,3);
 assert.equal(adjusted.x,0);
 assert.equal(adjusted.y,100);
 const fallback=getAvatarFrame({avatarWidth:'not valid',avatarHeight:NaN,avatarZoom:Infinity});
 assert.equal(fallback.width,68);
 assert.equal(fallback.height,68);
 assert.equal(fallback.zoom,1);
 const saved=normalizeSiteSettings({team:[{name:'عضو',avatarWidth:999,avatarZoom:-1}]}).team[0];
 assert.equal(saved.avatarWidth,112);
 assert.equal(saved.avatarZoom,1);
});

test('portrait geometry preserves edge-to-edge cover and pans vertically without blank areas',()=>{
 const source={...oldMember,avatarWidth:68,avatarHeight:68,avatarZoom:1,avatarY:50};
 const center=avatarImageGeometry(source,400,800);
 assert.equal(Math.round(center.width),68);
 assert.equal(Math.round(center.height),136);
 assert.equal(Math.round(center.top),-34);
 const moved=panAvatarFrame(source,0,20,400,800);
 // Horizontal overflow is zero, so dragging vertically keeps x centered.
 assert.equal(moved.avatarX,50);
 assert.ok(moved.avatarY<50);
 const geometry=avatarImageGeometry({...source,...moved},400,800);
 assert.ok(geometry.top>center.top);
 assert.ok(geometry.top<=0);
 assert.ok(geometry.top>=-geometry.overflowY);
});

test('zooming lets even square photos move inside the visible frame',()=>{
 const original={...oldMember,avatarZoom:1.8,avatarX:50,avatarY:50};
 const before=avatarImageGeometry(original,384,384,2.2);
 assert.ok(before.overflowX>0&&before.overflowY>0);
 const updated=panAvatarFrame(original,18,-12,384,384,2.2);
 assert.ok(updated.avatarX<50);
 assert.ok(updated.avatarY>50);
 const after=avatarImageGeometry({...original,...updated},384,384,2.2);
 assert.ok(after.left>before.left);
 assert.ok(after.top<before.top);
});

test('frame can be resized by dragging the bottom-left grip in RTL layout',()=>{
 const member={...oldMember,avatarWidth:68,avatarHeight:68};
 const larger=resizeAvatarFrame(member,-22,33,2.2);
 assert.equal(larger.avatarWidth,78);
 assert.equal(larger.avatarHeight,83);
 assert.equal(resizeAvatarFrame(member,-3000,3000,2.2).avatarWidth,112);
 assert.equal(resizeAvatarFrame(member,-3000,3000,2.2).avatarHeight,144);
 assert.deepEqual(avatarFrameProperties({width:68,height:68,zoom:1,x:50,y:50}),{
  avatarWidth:68,avatarHeight:68,avatarZoom:1,avatarX:50,avatarY:50
 });
});

test('new uploads preserve entire portrait proportions instead of pre-cropping to square',()=>{
 assert.deepEqual(avatarFullImageSize(2400,4000),{width:576,height:960});
 assert.deepEqual(avatarFullImageSize(4000,2400),{width:960,height:576});
 assert.deepEqual(avatarFullImageSize(300,750),{width:300,height:750});
 assert.throws(()=>avatarFullImageSize(0,500),/أبعاد/);
});
