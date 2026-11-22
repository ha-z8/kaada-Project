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

### Safely create the first supervisor (required)
At the time of setup the Supabase database has **zero** registered users, so no supervisor account can be preassigned.

1. On the real site create your supervisor account and confirm its email.
2. Sign into Supabase Dashboard for **kaada Project** -> SQL Editor and inspect the intended account's ID:
   ```sql
   select id, email, created_at from auth.users order by created_at desc;
   ```
3. Only after you verify the right user, from the database owner's SQL Editor run:
   ```sql
   insert into public.app_roles (user_id, role)
   values ('REPLACE_WITH_VERIFIED_UUID'::uuid, 'admin')
   on conflict (user_id) do update set role = 'admin';
   ```
4. Sign out and sign back into the platform. The account becomes **مشرف**; other accounts remain **مستخدم**.
5. **Never** make the first person to register automatically become admin, never rely on client `user_metadata`, and never commit actual email addresses or UUIDs to GitHub.

The executed database changes are recorded in `supabase/shared_roles.sql`; the initial tables are in `supabase/schema.sql`. Do not re-run initial migrations blindly on a live database.

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
