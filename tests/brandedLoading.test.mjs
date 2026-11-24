import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('startup and all common loading states share the HSA logo spinner',()=>{
 assert.match(read('index.html'),/hsa-loader-v1\.css/);
 assert.match(read('index.html'),/hsa-loader-startup/);
 for(const file of ["src/App.jsx","src/components/AccountManager.jsx","src/components/AvatarPicker.jsx","src/components/MyAccountSettings.jsx","src/components/SiteSettingsPage.jsx","src/components/OfflineSyncCenter.jsx","src/components/IncidentCenter.jsx"]){
  const source=read(file);assert.match(source,/<HsaLoader/);assert.doesNotMatch(source,/<LoaderCircle/);
 }
 const css=read('public/hsa-loader-v1.css');
 assert.match(css,/hsa-loader-rotate/);assert.match(css,/hsa-loader-glow/);
 assert.match(css,/prefers-reduced-motion/);assert.match(read('src/components/HsaLoader.jsx'),/src="\/favicon\.svg"/);
});
test('determinate work progress keeps real accessible values',()=>{
 const source=read('src/components/HsaLoader.jsx');
 assert.match(source,/aria-valuenow/);assert.match(source,/Number\.isFinite\(progress\)/);
 assert.match(read('src/App.jsx'),/progress=\{autoProgress\.total\?100\*autoProgress\.done\/autoProgress\.total:undefined\}/);
});
