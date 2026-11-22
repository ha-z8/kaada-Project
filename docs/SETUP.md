# KAADA Study — Installation and security

## Stack
React 19, Vite 7, Tailwind CSS 4, Supabase Auth/Postgres/Storage/Functions, PDF.js, Mammoth.js, native browser SpeechSynthesis.

## Run
1. Install Node 20.19+.
2. `npm install` then `npm run dev`.
3. Without Supabase environment variables the app opens a **local demo**; data stays in memory and is lost on refresh.
4. Create a **new Supabase project**. Never re-use another app's production database.
5. In its SQL Editor execute `supabase/schema.sql` after reviewing the migration.
6. Copy `.env.example` to `.env.local`, fill `VITE_SUPABASE_URL` and the **publishable** key from the new project. Do not use a service_role key.
7. Enable Email Auth in Supabase and configure any email verification / SMTP requirements for your organization.
8. For automatic academic translation, deploy `supabase/functions/process-section` and configure `OPENAI_API_KEY` **only** as a server-side secret. Example with installed Supabase CLI: `supabase functions deploy process-section --project-ref YOUR_PROJECT_REF`. Never expose it in Vite variables.
9. On Netlify or Cloudflare Pages: build command `npm run build`, publish directory `dist`; configure both Vite environment variables in the host.

## Flow
- Sign up / sign in -> create a subject -> choose it -> import PDF/DOCX/TXT -> review extracted paragraphs -> save in the account.
- Select any lesson, switch English/Arabic/paired reading, continue progress, and listen to English/Arabic/mixed tracks.
- Native speech works **without a TTS API**, but the available voices and quality depend on the browser/OS. Recorded audio can be uploaded manually for each section; private signed URLs are used to play recordings.
- AI translation requires separate Edge Function deployment and a paid/eligible third-party provider credential. No background generation occurs automatically.
- Text extraction is best-effort: complex page layouts, charts, scanned PDFs, images, formulas and tables require manual checking; OCR is not implemented.
- Content begins in English and is never silently replaced by generated summaries.

## Privacy
- The two Storage buckets are PRIVATE and all tables enable RLS. Users can access only their own content.
- Never include course PDFs or user-uploaded files in the public GitHub repository.
- Confidential/restricted materials should only be stored or sent to outside AI providers if institutional authorization explicitly allows it.
- AI processing transmits the selected paragraph to an external model provider ONLY after the user explicitly clicks the processing action and confirms consent.
- Review all AI output before trusting it; scientific translations and formulas can be wrong.
- Keep all API keys, service role tokens, and AI keys outside the frontend and Git.
- After deploying, test separation between two real test accounts and run Supabase security advisors.

## Known gaps
- New Supabase project, production environment variables, hosted deployment, and AI secret are not provisioned automatically.
- Audio is synthesized on demand by the browser unless audio files are explicitly uploaded; server-side MP3 generation is not implemented.
- Browser extraction is not a certified conversion of diagrams, charts or complex mathematical content.
