import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSearchRanges,searchSavedDocumentItems} from '../src/lib/documentSearch.js';
test('search PDF phrase across source spans maps original offsets',()=>{
 const spans=[{index:0,text:'The objective'},{index:1,text:'function is useful'}];
 assert.deepEqual(documentSearchRanges(spans,'objective function'),[[{index:0,start:4,end:13},{index:1,start:0,end:8}]]);
 assert.equal(documentSearchRanges(spans,'object','word').length,0);
});
test('search Arabic with diacritics and mark notes',()=>{
 assert.ok(documentSearchRanges([{index:0,text:'العِلْمُ مفيد'}],'العلم').length);
 const hits=searchSavedDocumentItems([{id:'a',page:2,spans:[{text:'objective'}],note:'مهم'}],[],'مهم','phrase','marks');
 assert.equal(hits[0].page,2);
});