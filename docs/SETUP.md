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

To enable this paid/credit-based feature, configure a server-side `OPENAI_API_KEY` in the **Functions** scope of the Netlify project, or use an eligible activated Netlify AI Gateway that provides runtime credentials. Production deploy once after setting credentials. The connected Netlify API currently returns HTTP 403 on environment-variable writes, so this step must be performed from the Netlify project settings by its owner.

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
- The Netlify Functions code is deployed, but realistic AI speech and generated explanations are **not proven operational** until AI Gateway eligibility or a valid private provider key is configured and an authenticated end-to-end test succeeds.
- Imported content and AI explanations always require source verification. OCR and automatic extraction of formulas/images are not implemented.
