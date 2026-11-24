import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('file selection and publication controls are admin-only, academic review is staff-only',()=>{
 const reader=read('src/components/OriginalDocumentReader.jsx'),app=read('src/App.jsx'),sql=read('supabase/lesson_visibility_and_academic_review.sql');
 assert.match(reader,/const chooseLocal=async e=>\{if\(!isAdmin\)return/);
 assert.match(reader,/\{isAdmin&&<label[^>]*><Upload size=\{16\}\/> معاينة PDF من جهازي/);
 assert.match(app,/if\(!isAdmin\|\|visibilityBusy\)return/);
 assert.match(app,/documentMode==='review'&&canReview\?<AcademicReviewCenter/);
 assert.match(sql,/alter column is_published set default false/);
 assert.match(sql,/lesson_public_read on public.lessons for select to anon using\(is_published\)/);
 assert.match(sql,/english_reviewed_at/);
 assert.match(sql,/role in \('admin','teacher'\)/);
});
