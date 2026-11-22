import test from 'node:test';
import assert from 'node:assert/strict';
import {assessArabicTranslation,numericTokens,normalizeScientificSymbols,OPERATIONS_RESEARCH_TERMS} from '../cloudflare/kaada-study-ai/quality.js';
test('checks scientific digits across Latin and Eastern Arabic numeral systems',()=>{
 assert.deepEqual(numericTokens('Z = ٠٫٥ x1 + ۳ x2'),['0.5','1','2','3'].sort());
 assert.equal(normalizeScientificSymbols('x ≥ ٠، y \\leq 10'),'x ≥ 0، y ≤ 10');
});
test('accepts faithful math and known negative wording; preserves symbols',()=>{
 const source='A feasible solution is not necessarily optimal. Z = 5x1 + 3x2; x1 ≤ 10.';
 const ar='الحل الممكن ليس بالضرورة حلاً أمثل. Z = 5x1 + 3x2؛ x1 ≤ 10.';
 assert.deepEqual(assessArabicTranslation(source,ar).warnings,[]);
});
test('rejects silently missing or modified equations, missing numbers and pure English',()=>{
 const source='Minimize Z = 5x1 + 3x2 where x1 ≤ 10.';
 assert.ok(assessArabicTranslation(source,'قلّل Z = 6x1 + 3x2 حيث x1 ≤ 10.').warnings.includes('numbers-changed'));
 assert.ok(assessArabicTranslation(source,'قلّل Z = 5x1 + 3x2 حيث x1 ≥ 10.').warnings.includes('math-operators-changed'));
 assert.ok(assessArabicTranslation(source,source).warnings.includes('no-arabic'));
});
test('academic term glossary includes the domain-specific equivalents',()=>{
 assert.ok(OPERATIONS_RESEARCH_TERMS.some(([en,ar])=>en==='feasible solution'&&ar==='حل ممكن'));
 assert.ok(OPERATIONS_RESEARCH_TERMS.some(([en,ar])=>en==='minimize'&&ar.includes('تقليل')));
});
