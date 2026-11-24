import test from 'node:test';
import assert from 'node:assert/strict';
import {translateDocumentSelection,findSavedSelection} from '../src/lib/selectionTranslation.js';
import {lookupAcademicTerm,glossarySize} from '../src/lib/academicGlossary.js';
import {resolveSelectionTranslations,wordPlaybackPlan} from '../src/lib/documentReader.js';
const unit=source=>({source,native:'en',sectionId:'s',ranges:[{index:0,start:0,end:source.length,text:source}]});
test('known terms translate without any Translator API or network',async()=>{
 assert.ok(glossarySize>200);
 assert.equal((await translateDocumentSelection(unit('SVG'),{translator:null,online:false})).translation,'رسومات متجهية قابلة للتحجيم');
 assert.equal((await translateDocumentSelection(unit('objective function'),{translator:null})).translation,'دالة الهدف');
 assert.equal(lookupAcademicTerm('alpha beta gamma'),'');
});
test('saved exact phrase is reusable but no whole paragraph substitution',async()=>{
 const sections=[{content_en:'Some specific phrase.',content_ar:'عبارة محددة'}];
 assert.equal(findSavedSelection(unit('specific'),sections),'');
 assert.equal((await translateDocumentSelection(unit('Some specific phrase'),{sections,translator:null})).translation,'عبارة محددة');
});
test('Chrome creation failures and unsupported browsers return safe Arabic messages',async()=>{
 const broken={availability:async()=>'available',create:async()=>{throw Error('Unable to create translator for the given source and target language.')}};
 await assert.rejects(translateDocumentSelection(unit('unlisted sentence for compatibility'),{translator:broken}),e=>/لا تتوفر ترجمة/.test(e.message)&&!e.message.includes('Unable'));
 await assert.rejects(translateDocumentSelection(unit('unlisted sentence for compatibility'),{translator:null}),/لا تتوفر ترجمة/);
});
test('native success, cleanup, and privileged service fallback',async()=>{
 let destroyed=false;
 const translator={availability:async()=>'available',create:async()=>({translate:async()=> 'ترجمة اختبار',destroy:()=>{destroyed=true}})};
 assert.equal((await translateDocumentSelection(unit('a new phrase'),{translator})).translation,'ترجمة اختبار');
 assert.ok(destroyed);
 const fallback=await translateDocumentSelection(unit('optimal'),{isAdmin:true,online:true,translator:null,translateAdmin:async()=>{throw Error('network')}});
 assert.equal(fallback.method,'glossary');
});
test('exact glossary output is used in Arabic-first and bilingual playback',async()=>{
 const units=await resolveSelectionTranslations([unit('optimal')],u=>translateDocumentSelection(u,{translator:null}));
 assert.equal(units[0].translationMethod,'glossary');
 assert.deepEqual(wordPlaybackPlan(units,'mixed').parts.map(x=>x.text),['optimal','أمثل']);
 assert.deepEqual(wordPlaybackPlan(units,'ar-first').parts.map(x=>x.text),['أمثل','optimal']);
});
