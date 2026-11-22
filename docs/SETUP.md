# KAADA Pro — Setup, roles, importing and natural voices

## Current deployment
- Production: https://kaada-pro.netlify.app/
- GitHub: `ha-z8/kaada-Project` / `main` (Netlify automatic deploy).
- Existing Supabase: **kaada Project**, ref `oaihjgmmoxvunuxtucin`.
- No other database should be created.
- Supabase URL and *publishable* key are public values in `src/lib/publicSupabaseConfig.js` (safe with RLS). Never place a service-role, secret key, or AI provider credential in browser code or GitHub.
- React: Vite + Tailwind CSS. Netlify builds with `npm run build` and serves `dist`.

## Supervisor and student accounts
The shared library is a **single curriculum**, read by every signed-in student. The supervisor alone can:
- Create/edit/delete subjects, chapters/lessons and section explanations.
- Import files (PDF, DOCX, TXT, MD), upload recordings and generate/edit AI curriculum explanations.

Students can:
- Read shared subjects, original text, translations and published explanations.
- Choose reading mode, speech engine, voice and playback speed, with separate private study progress.
- Not change or upload shared curriculum material.

Protection is enforced by PostgreSQL RLS, **not** merely by hiding controls:
- `public.app_roles(user_id, role)` can only be read by the corresponding user from the client. Its contents cannot be inserted or edited using an authenticated browser token.
- Admin-managed tables: `subjects`, `lessons`, `sections`.
- Every logged-in user can SELECT shared coursework; only a user with role `admin` can INSERT/UPDATE/DELETE it.
- `study_progress` is always scoped to the signed-in user.
- Storage buckets `study-source` and `study-audio` are private to unauthenticated callers; signed-in learners can read study assets, while only admins can upload or remove them.
- The AI curriculum generation endpoint checks `app_roles` server-side as well.

### تسجيل الدخول وإنشاء حساب دون بريد إلكتروني

- عنوان الموقع: https://kaada-pro.netlify.app/
- اضغط **إنشاء حساب**، ثم أدخل **اسم المستخدم** (3–24 من أحرف إنجليزية أو أرقام مع `.` و`_` و`-`)، الاسم الظاهر إن رغبت، وكلمة مرور لا تقل عن 8 أحرف.
- ينشئ Supabase Auth حسابًا باسم دخول داخلي غير ظاهر للمستخدم. لا يحتاج الطالب بريدًا إلكترونيًا ولا تصله رسالة تأكيد؛ يُنشئ الحساب خادم Supabase الموثوق باستخدام `auth.admin.createUser(...email_confirm:true)`.
- يتم **تسجيل الدخول باسم المستخدم وكلمة المرور** فقط. لا يعرف المستخدم البريد الداخلي.
- التسجيل الذاتي يُنتج صلاحية `user` حصريًا. لا توجد صلاحية مشرف افتراضية، ولا اختيار للدور في استمارة التسجيل العام.
- بما أنه لا يوجد بريد حقيقي لاستعادة كلمة المرور، يستطيع المشرف **تعيين كلمة مرور جديدة** من صفحة إدارة الحسابات. ويمكن للمستخدم المسجّل تغيير كلمة مروره من صفحة **حسابي**.
- مراقبة التسجيل الذاتي: حد طلبات تقريبي حسب عنوان IP، والتحقق من تنسيق الاسم، والتحقق من التعارض قبل حفظ الحساب نهائيًا.

### أول حساب مشرف — يلزم مرة واحدة فقط

قاعدة البيانات كانت فارغة من المستخدمين عندما جرى إعداد النظام؛ **لا نمنح صلاحية المشرف تلقائيًا لأول شخص يسجّل** لأن أي شخص قد يسبق المالك بالتسجيل.

1. افتح https://kaada-pro.netlify.app/ واختر **إنشاء حساب**. اختر اسم مستخدم وكلمة مرور خاصة بك.
2. افتح لوحة Supabase **kaada Project** وتحقق من الحساب المستهدف في SQL Editor:
   ```sql
   select user_id, username, display_name, created_at
   from public.user_profiles order by created_at desc;
   ```
3. **بعد التحقق من هوية الحساب**، نفّذ بصلاحية مالك قاعدة البيانات فقط، مع استبدال `YOUR_USERNAME` باسم المستخدم الصحيح:
   ```sql
   insert into public.app_roles (user_id,role)
   select user_id, 'admin'
   from public.user_profiles
   where username = 'YOUR_USERNAME'
   on conflict (user_id) do update set role = 'admin';
   ```
4. سجّل خروجك وادخل مجددًا. ستظهر لك صفحة **إدارة الحسابات** بالقائمة الجانبية.
5. من لوحة المشرف يمكنك إنشاء حسابات `user` أو `admin`، تعديل اسم المستخدم والاسم الظاهر والصلاحية، تعيين كلمة مرور جديدة، حذف الحسابات. لا يمكن عرض كلمة المرور القديمة.
6. يحمي النظام آخر مشرف من الحذف أو فقدان الصلاحية، ويمنع حذف الحساب الجاري. وعند حذف صاحب مادة مشتركة، تنقل الخدمة ملكية المواد إلى مشرف باقٍ قبل حذف Auth، حتى لا تُحذف المادة بفعل الربط بين الجداول.

### الملفات والحماية

- جداول `public.user_profiles` و`public.account_signup_attempts` أُنشئت في `supabase/username_accounts.sql`.
- وظيفة `supabase/functions/account-control/index.ts` منشورة في مشروع Supabase باسم `account-control` مع `verify_jwt=false` فقط للسماح ببدء التسجيل العام. **جميع إجراءات الإدارة** تتحقق بنفسها من جلسة Supabase الحقيقية ومن الدور `admin` داخل قاعدة البيانات.
- السر الخدمي `SUPABASE_SECRET_KEYS` يُقرأ من بيئة تنفيذ Supabase فقط، وليس داخل GitHub أو واجهة React أو Netlify. تُحفظ كلمات المرور في Supabase Auth ولا تُكشف في أي واجهة.
- بعد أي تعديل في الوظيفة، انشر النسخة الجديدة بواسطة موصل Supabase، ولا تتوقع أن Netlify سينشر Supabase Edge Functions من GitHub تلقائيًا.
- الاستدعاء الإداري يحتاج JWT صالحًا. منع عمليات إنشاء المستخدمين وتعديلهم وحذفهم من المستخدم العادي مفروض بالخادم، لا بمجرد إخفاء أزرار الواجهة.

## Improved import
1. As admin create a subject, then use **استيراد درس**.
2. Upload PDF/DOCX/TXT/MD or choose manual paste.
3. Review and edit the extracted original text **locally** before saving.
4. Optionally detect chapter, unit and lecture headings in English and Arabic. The preview shows each resulting lesson and first section.
5. Files are not sent to Supabase until you press **حفظ**. Course materials may be confidential; obtain authorization before uploading restricted files.
6. Scanned-image PDFs require OCR, which is not implemented. Multi-column PDF layouts, maths, tables and diagrams still require human review.
7. No text is silently discarded after 500 sections; very large imports are rejected with a clear message so you can split the source into smaller files.

## Academic explanations
Only the supervisor can press **توليد شرح تلقائي**. A Netlify Function `/api/study/generate` authenticates the supervisor, checks role `admin`, retrieves the selected stored section (not arbitrary user text), generates an academic Arabic translation and Arabic/English/mixed explanation drafts, then **returns an editable preview** without overwriting the current lesson. The supervisor manually reviews and saves.

**Current status:** academic text explanations are enabled using the separate connected Cloudflare Workers AI service `kaada-study-ai` (model `@cf/google/gemma-4-26b-a4b-it`). Netlify `/api/study/generate` checks Supabase session and admin role, then forwards the selected paragraph identifier to the Worker. The Worker independently checks the same user and role with Supabase, retrieves the authorized paragraph, and returns an editable academic translation and bilingual explanation. It requires explicit user approval for external processing, and no OpenAI key or Netlify plan change.

## Natural and bilingual narration
- The player offers **صوت الجهاز (مجاني)** and **صوت واقعي ذكي**.
- Natural mode offers several distinct voices (Coral, Nova, Onyx, Sage, Shimmer, Alloy).
- Supports original text reading or the *supervisor-approved* explanation in Arabic, English or mixed, and controllable playback speed.
- The Netlify Function `/api/study/voice` authenticates the learner, fetches only existing stored material, checks the voice allow-list, and synthesizes MP3 speech using server-side provider credentials.
- Requires a user's explicit checkbox acknowledging that the selected study text will be sent to an external voice provider. AI-produced speech is clearly disclosed as synthetic.
- Longer text is safely split into bounded sections and the audio chunks play in sequence. Audio responses are private and marked no-store.
- If the TTS provider has no credentials, the request returns a clear message and the user can switch to **صوت الجهاز (مجاني)**.
- Default server model is `gpt-4o-mini-tts` and can be overridden by the server-only `KAADA_TTS_MODEL` variable. Verify currently supported models and deprecation dates in provider documentation when deploying; an external voice provider can incur usage fees.
- Arabic pronunciation quality depends on the selected model and voice; no voice can guarantee perfect rendering of every mathematical symbol or acronym.

## Tests and security
```sh
npm install
npm test
npm run build
```
Every push to `main` runs the GitHub Actions workflow. Confirm the resulting Netlify deploy is **ready** before assuming the production site updated.

Security checks:
- Confirm that a normal user sees courses but not CRUD controls.
- Attempt direct Supabase write of course content with a normal user token: RLS must deny it.
- Verify the admin account can import/save/edit/delete shared lessons.
- Verify student progress only displays to the same student.
- Confirm the two Netlify Functions reject unauthenticated requests.
- Confirm restricted materials are not sent to external AI tools without the right to do so.
- Review Supabase security advisors regularly.

## Known constraints
- The first `admin` role must be assigned to a verified registered account by the database owner; no account was created automatically.
- The Netlify academic explanation function has a working Cloudflare AI fallback: real generic Arabic AI inference, live health and unauthorized-access checks, mock authenticated API tests and CI build have passed. End-to-end processing of actual user-uploaded restricted material still requires their authorized session/permission. Optional natural MP3 audio remains a separate provider-dependent feature; browser TTS works without any key.
- Imported content and AI explanations always require source verification. OCR and automatic extraction of formulas/images are not implemented.


## إصلاح استيراد PDF عربي والشرح التلقائي (22 نوفمبر 2026)

1. **مسارات التخزين الآمنة:** أصلحت `src/lib/api.js` و`src/lib/storagePaths.js` بحيث يُرفع `بحوث_عمليات.pdf` بمفتاح لاتيني مثل `USER_UUID/FILE_UUID/source.pdf`، ويحفظ `lessons.source_filename` الاسم العربي الأصلي. لم يعد اسم الملف جزءًا من مفتاح Supabase Storage. التخزين خاص، مع صلاحية الإضافة للمشرف فقط.
2. **الفحص قبل إرسال الملف:** يستخرج المستورد PDF/DOCX/TXT/MD في المتصفح، ويعرض معاينة نصية وفصولًا قبل الحفظ. قد تتطلب الملفات المصورة OCR خارجيًا؛ ويجب مراجعة النصوص والجداول الرياضية.
3. **قراءة صوتية فورية:** بعد نجاح حفظ الدرس يُفتح القارئ في وضع قراءة النص الأصلي بالصوت الذي يدعمه الجهاز، بلا طلب خارجي أو توليد يدوي. هذا **قراءة** للمصدر، وليس شرحًا جديدًا مترجمًا.
4. **شرح ذكي تلقائي بعد الحفظ:** يفحص الموقع جاهزية `GET /api/study/generate`. إذا كانت الخدمة مفعلة ويوافق المشرف صراحةً على إرسال المحتوى إلى طرف ثالث والرصيد المحتمل، يبدأ توليد ترجمة وشرح عربي وإنجليزي لكل فقرة دون الضغط على توليد كل مرة. يطلب الموقع بقاء التبويب مفتوحًا أثناء المعالجة؛ لا يوجد بعد عامل مهام دائم يواصل التوليد بعد إغلاق المتصفح. الحد المقترح للدفعة 60 فقرة.
5. **توليد للدروس الموجودة:** زر «شرح جميع فقرات الدرس» يولد الشرح للمحتوى المستورد سابقًا عند توفر الخدمة، ويتجاوز الفقرات التي تم إنشاؤها أو مراجعتها بالفعل. لا يُعاد الكتابة فوق التعديلات المعتمدة.
6. **المراجعة:** بعد التوليد `processed_at` يسجل وقت المسودة، وتبقى `reviewed_at` فارغة حتى يفتح المشرف «تعديل الشرح» ويتأكد من المعادلات والمصطلحات ويحفظ المراجعة. تظهر علامة صريحة على الشرح غير المُراجَع.
7. **تطابق الصوت مع آخر تعديل:** الصوت عبر المتصفح يقرأ نص `explanation_ar` أو `explanation_en` المحفوظ، والصوت الواقعي يستخرج المحتوى من قاعدة البيانات من جديد عند كل تشغيل (وقد يستهلك رصيدًا). التسجيلات اليدوية القديمة تُفصل عن النص إذا تغيّر شرحها، ويمكن اختيارها صراحةً عند توافقها، فلا يُقرأ تسجيل قديم على أنه شرح محدّث.
8. **حالة الخدمة:** أصبح التوليد الأكاديمي النصي يعمل تلقائيًا عبر Cloudflare Workers AI دون الحاجة لإضافة مفتاح OpenAI في Netlify. يفحص الموقع جاهزية الخدمة المنشورة، ولا يرسل أي فقرة إلا بعد موافقة المشرف. إذا نفد الحد اليومي أو تعطلت الخدمة، يظهر خطأ واضح ويمكن الاستماع إلى النص الموجود عبر أصوات الجهاز.
9. **خصوصية المواد:** الملفات التي تحمل علامات «Restricted» أو «مقيد» تتطلب التأكد من صلاحية رفعها إلى Supabase أولًا، وتصريحًا **منفصلًا** لمشاركتها مع أي مزود توليد نص أو صوت خارجي. خانة الموافقة على الذكاء الاصطناعي غير محددة افتراضيًا.
10. **اختبار الربط الفعلي:** فحص GitHub Actions وNetlify يؤكد صحة البناء والنشر. يجب تجربة ملف عربي حقيقي بحساب مشرف مخوّل، ثم مراجعة محتوى الدرس والشرح والقراءة والتعديل، قبل إعلان اكتمال اختبار دورة العمل بالكامل.

Migration: `supabase/ai_review_status.sql`. Unit tests: `tests/storagePaths.test.mjs` and `tests/explanationSync.test.mjs`.

## Voice selection simplification and AI setup — 2026-11-22
- The reader now has **up to three system voices in Arabic** (سَنا، أثير، مَزن) and **up to three in English** (Ava, Leo, Mia). These are UI aliases created for KAADA; they are not voice identities or a guarantee of speaker characteristics. Only voices actually available in the user's browser/OS are shown.
- Mixed-language reading may show both short lists; the system chooses the correct installed voice per language segment. User selections persist in local browser settings.
- The optional paid natural engine has **three voices per selected language**, with separate saved Arabic and English choices. Backend validates that the chosen voice belongs to the requested language's allowlist.
- If provider credentials are missing, the natural engine is disabled instead of leading to a failing audio request. Basic browser speech remains selectable and reads the current saved explanation.
- A check to `GET /api/study/generate` reports only a Boolean configured/unconfigured state, never secrets. The AI generation dialog clearly indicates whether automatic academic explanation is available and has a manual-edit alternative.
- **Current academic-text provider:** Cloudflare Workers AI on the user-owned account, not Netlify AI Gateway. Do not add an OpenAI key for academic text generation. Free allowance is 10,000 Neurons per day (usage beyond free allocation may be billable on Workers Paid; model inference can be rate-limited). Natural MP3 voice remains separate and still requires its own enabled provider.
- The academic-text provider uses a Workers AI binding with no client/server API key. A provider key is only needed if enabling the **separate** optional natural MP3 voices. Browser speech requires neither.
- Verify with an authorized small, non-confidential course section, approve external processing, inspect the generated draft, then edit and play it in Arabic and English. Do not presume system voices are universally available, or that the provider is operational until an actual test succeeds.

## Cloudflare-managed bilingual generation (deployed 2026-11-22)

- Worker name: `kaada-study-ai`, URL: `https://kaada-study-ai.kaada-p.workers.dev`; `GET /health` returns `ready:true` when the Workers AI binding is active.
- Versioned source: `cloudflare/kaada-study-ai/worker.js`; deployed with Cloudflare API module worker and binding `AI`, without secret keys. The stored public Supabase publishable key is not a privileged credential.
- Inference model: `@cf/google/gemma-4-26b-a4b-it`; tested with a synthetic mathematics sentence and produced valid six-field bilingual JSON. Treat generated explanations as drafts and verify technical terms before publishing.
- The Worker **rejects unauthorized calls** and separately validates the Supabase user, admin role, stored section, and explicit consent. Authentication is not delegated to the browser or Netlify alone.
- Netlify `/api/study/generate` uses the Cloudflare Worker when no `OPENAI_API_KEY` is configured. Both `GET` readiness and POST processing are tested in code; live readiness is verified by GitHub Actions.
- With the provider ready, a supervisor can choose **automatic explanation during import** and consent, and the website generates Arabic/English drafts per section without manually clicking Generate each time. The tab must remain open; this is not yet a durable background queue.
- Workers AI includes a limited free daily allocation; if the provider reaches a quota, generation may fail until the quota resets. Never promise unlimited AI usage.
- Audio: the browser can immediately read approved/edited Arabic or English explanations using installed voices. This is distinct from generating an MP3 using a premium provider, which is not included in the Cloudflare text model.


## Academic Arabic translation accuracy and automatic import (November 2026 update)

- Arabic translation **is no longer a byproduct of requesting six explanation fields from one model**. The Netlify endpoint `/api/study/generate` supports `mode:'translate'` and sends the authorized section ID to the separate Cloudflare Workers AI `/translate` endpoint. The Cloudflare Worker fetches the original from Supabase under the requesting admin's JWT, verifies the user and admin role, and requires explicit consent. No arbitrary document text is accepted directly from visitors.
- The translation prompt strictly distinguishes **translation vs explanation**, uses context-sensitive academic Operations Research terminology, and requires numerals, equations, symbols, qualifiers, negation and ordering to remain faithful. A second proofreader model call compares the Arabic draft with the English source. Deterministic checks reject changes to numeric tokens or mathematical comparison operators. A translation may still have semantic mistakes not detected automatically; **academic human review remains required**.
- Fresh imports set **ترجمة عربية تلقائية** to on by default. The supervisor opts in once during import to send the document text for processing. After saving, the browser automatically translates each English section and optionally generates bilingual explanations. There is no need to manually click Generate on each paragraph. The browser tab must remain open during processing; failed sections are reported without erasing successful sections.
- Cloudflare Workers AI currently has a **10,000 Neurons/day free allowance**. Translation and optional explanation can consume credits and may stop at daily quota. Maximum 60 sections per processing batch, with pacing to avoid function rate limits. These are not unlimited services.
- Existing lessons: in the reader, the admin selects **ترجمة الدرس كاملًا**, consents once, and missing sections are translated in one pass. An explicit option can improve unreviewed older translations; previously **human-reviewed** translations are protected from automatic overwrite. To improve just one paragraph, choose **تحسين ترجمة الفقرة** and review the preview before saving.
- The schema adds `translated_at` for AI-produced translation and `translation_reviewed_at` for **explicit** supervisor approval; initial and historical translations are never automatically labeled human-verified. Migration file: `supabase/academic_arabic_translation.sql`.
- Editing the scientific source without updating its Arabic translation triggers a warning and clears the stale translation before saving, rather than silently leaving incorrect corresponding text. Changing only Arabic translation does not incorrectly mark unrelated English/Arabic explanations as reviewed.
- `src/lib/import.js` no longer splits long paragraphs at the decimal period of numbers such as `0.05`. Complex PDF scans, tables and broken text extraction still require human correction in the pre-import preview; AI does not reconstruct missing figures or formulas.
- The API and Cloudflare worker tests include translated scientific inequalities, missing/changed numbers, anonymous access rejection, independent admin access and successful editable drafts. The live service is independently health-checked from GitHub Actions. An authenticated end-to-end workflow with the user's real uploaded documents must still be verified from the authorized account. Never send restricted material to an external AI provider unless the necessary permission exists.

## Fix for 422/502 translation failures — 2026-11-22

The Netlify edge logs for `2026-11-22T15:27-15:29Z` showed one `422` taking about 26.7s, a `502` taking about 30.1s, and a `504` at about 30.2s on `/api/study/generate`. The original client was sending each two-pass AI operation through the Netlify function, which can reach its request duration limit. The Cloudflare backend now receives the authenticated browser request directly over HTTPS at `https://kaada-study-ai.kaada-p.workers.dev/translate` (or `/generate`) and independently validates Supabase JWT, current admin role, RLS-readable source section and explicit consent. No service-role credential is exposed. Browser CORS preflight and anonymous denial are checked by CI, and the frontend uses a longer explicit timeout with comprehensible error handling.

A failed deterministic math comparison no longer returns a fatal HTTP 422. Instead, it returns an editable `translation` with `auto_save:false` and reasons such as `numbers-changed` or `math-operators-changed`. The importer **does not save** such a draft automatically; it leaves the section for manual comparison and approval. A supervisor who requests a single-paragraph translation sees the draft and a prominent numerical review warning, and cannot save it without explicitly acknowledging and verifying the translation. Already-reviewed translations are not overwritten. Large source paragraphs may still need splitting, and finite model usage remains a limitation.

The explanation worker retries malformed/truncated six-field JSON once with a concise output prompt, preventing a common source of generic `502` when the model returns incomplete JSON. The separate Netlify endpoint remains for compatibility but the newly deployed frontend no longer depends on its 30-second timeout for academic AI content.

The PDF.js warning `TT: undefined function: 32` indicates a problematic embedded TrueType font and is separate from the translation HTTP errors; it can sometimes affect glyph decoding, so verify extracted equations in the import preview. The `404` printed without a URL could not be attributed to the site; Netlify's site request logs showed no 404s during the checked window. No original course file has been sent by these tests. Automated tests and smoke checks cannot replace a permissioned end-to-end run using a representative course upload.


## Paragraph-aligned bilingual listening (November 22, 2026)

The new `StudyAudioPanel` combines four straightforward decisions: (1) read the original text or listen to explanations, (2) English only, Arabic only, or bilingual, (3) select a voice for each required language, and (4) play/pause/stop, auto-next, and speed. There are no AI-generated "realistic voice" options. The old optional natural-voice Netlify function and client code have been retired; academic text generation on Cloudflare is unaffected.

**Bilingual playback:** for section 1: English source paragraph 1, its corresponding saved Arabic translation 1; then English source paragraph 2, Arabic translation 2; and so forth. Explanation listening instead uses approved/current `explanation_en` followed by `explanation_ar` within that same section; the alternative `explanation_mixed` remains an optional textual study aid and is NOT used instead of the paired scripts. The browser plays a bounded utterance queue and advances the visible paragraph/progress cursor automatically when each language pair finishes. A missing translation or explanation halts playback with a clear indication of the paragraph requiring attention — it does not read mismatched texts. Automatic next is enabled by default and can be disabled per user. Manual navigation, changing voices/speed, leaving the reader, or pressing Stop cancels the queue.

**Voice catalog:** the Web Speech API has no standardized speaker gender field. The UI can display **up to 3 identifiable male and 3 identifiable female installed voices per Arabic and English language**, using explicit voice metadata (where present) or a curated list of known named voices. The labels are short KAADA aliases rather than actual voice/provider identities. Unavailable options are disabled (rather than pretending a voice exists). Unknown-gender voices are placed separately under "صوت الجهاز (غير مصنف)" rather than being mislabelled. Playback quality, number of installed voices, and offline support depend on the operating system/browser; the site cannot install missing voice packages or guarantee six of each category.

The lesson outline displays numbered paragraphs, a short readable preview and whether an Arabic text exists. The bilingual explanation view displays the English explanation followed by the Arabic one. Saved supervisor-uploaded recordings are still available in a collapsed, separate control and are **not** part of automatically paired browser speech. This prevents mixing stale manually recorded audio with newly edited explanations.

Tests: `tests/lessonPlayback.test.mjs`, `tests/systemVoices.test.mjs`, `tests/speech.test.mjs`. CI verifies complete tests and production Vite build. Manual browser testing remains important across Windows/macOS, Chrome/Edge/Safari and different installed voice inventories.
