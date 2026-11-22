# KAADA Study — Installation and security

## Stack
React 19, Vite 7, Tailwind CSS 4, Supabase Auth/Postgres/Storage + Netlify Functions (AI Gateway), PDF.js, Mammoth.js, native browser SpeechSynthesis.

## Run
1. Install Node 20.19+.
2. `npm install` then `npm run dev`.
3. Without Supabase environment variables the app opens a **local demo**; data stays in memory and is lost on refresh.
4. Create a **new Supabase project**. Never re-use another app's production database.
5. In its SQL Editor execute `supabase/schema.sql` after reviewing the migration.
6. Copy `.env.example` to `.env.local`, fill `VITE_SUPABASE_URL` and the **publishable** key from the new project. Do not use a service_role key.
7. Enable Email Auth in Supabase and configure any email verification / SMTP requirements for your organization.
8. Link the GitHub repo `ha-z8/kaada-Project` to Netlify `kaada-study` (branch `main`). Build: `npm run build`, publish `dist`. Deploy to production once.
9. In Netlify add the frontend **build** variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Give Functions access too, or set server-only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` in Netlify environment variables with `Functions` scope. Both URLs and publishable keys are non-secret, but never include a `service_role`/secret key.
10. Automatic explanations run at Netlify `/api/study/generate`, NOT from the old Supabase Edge Function. It authenticates the student with Supabase Auth, reads the selected RLS-owned paragraph and returns a **draft only**. The student edits it and explicitly saves.
11. A Netlify **credit-based** Free/Personal/Pro plan with enabled **AI Gateway** injects provider keys into Netlify Functions after the first production deploy. Legacy Netlify plans may require an explicit plan switch. This can consume account credits; review limits and fees first. Alternatively use a user-owned server-side `OPENAI_API_KEY` on Netlify. Never place provider keys in `VITE_*` or GitHub.
12. For controlled model selection, optionally set server-only `KAADA_AI_MODEL` to a currently available Netlify AI Gateway/OpenAI model. The default currently configured in code is `gpt-4.1-mini` (verify availability before production).

## Flow
- Sign up / sign in -> create a subject -> choose it -> import PDF/DOCX/TXT -> review extracted paragraphs -> save in the account.
- Select any lesson, switch English/Arabic/paired reading, continue progress, and listen to English/Arabic/mixed tracks.
- Native speech works **without a TTS API**, but the available voices and quality depend on the browser/OS. Recorded audio can be uploaded manually for each section; private signed URLs are used to play recordings.
- AI explanation uses a Netlify Function, Netlify AI Gateway (or a private provider key), and Supabase authentication. Nothing is transmitted until the student explicitly opts in for the selected paragraph.
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
- A new Supabase project, production environment variables, Netlify Git-based publication, and AI Gateway eligibility/credentials are not yet provisioned in this repository. A demo can edit locally but has no connected AI backend.
- Audio is synthesized on demand by the browser unless audio files are explicitly uploaded; server-side MP3 generation is not implemented.
- Browser extraction is not a certified conversion of diagrams, charts or complex mathematical content.


## Reading vs explanation — Arabic audio

- The reader shows the **original text and translation** first, then a separate **simplified explanation**. Choose Arabic, English or mixed language for the explanation without changing the original.
- The audio card has two explicit modes: **Read text** (reads original/translated course text as written) and **Explain** (reads a separate explanatory script; not a re-reading of the original).
- Imported **Arabic originals** are read using the original Arabic text, including previously uploaded sections whose `content_ar` field was empty. New Arabic imports also populate `content_ar` without silently translating anything.
- Imported **English originals** need Arabic translation before Arabic reading is available. They also need an explanation script before the explanation audio mode is available. Missing tracks are marked “غير جاهز” with a contextual action, not a nonfunctional Play control.
- Select **توليد شرح تلقائي** to request a draft through a protected Netlify Function; this requires Netlify AI Gateway/credentials, Supabase, and explicit student consent. The result opens in a simple editor with separate Arabic and English explanations and must be explicitly saved.
- The built-in audio uses the browser's SpeechSynthesis voices **on demand**; it does not generate MP3 files and is dependent on device/browser language voices. On Windows, if Arabic voice is missing, install an Arabic speech voice in system language settings, reopen the browser and retry. External voice-generation services are not part of this version.
- Long imported passages are split into short utterances to reduce browser silent failures. If there is still a voice problem, check that the operating system has Arabic voices installed and that the tab is not muted.
- If you need consistent audio everywhere, upload a reviewed recorded audio file for each explanation track; it is served from private Supabase Storage and requires a configured authenticated account.

## How to troubleshoot “التوليد التلقائي لا يعمل”

1. Confirm the project has a **production deploy** with the `generate-explanation` Netlify Function. Check the Deploy tab (not only the GitHub build check).
2. Confirm the user is **signed in**, not in demo mode. A valid Supabase session is mandatory to prevent unauthorized paid calls.
3. Confirm the Netlify project has database URL + publishable key in **Functions scope** and the React app has its `VITE_` build variables. The Supabase schema must already be installed.
4. Confirm the provider works: Netlify credit-based AI Gateway must be enabled (legacy `nf_team_dev` is not guaranteed to qualify), or use a private `OPENAI_API_KEY` in Netlify Functions scope.
5. When the generation succeeds it opens an **editable preview**. No database write occurs until the student explicitly selects “حفظ الشرح والترجمة”. The editable Arabic and English explanations are also the text read by the narration engine.
6. The function is authenticated, limited to one authorized user's paragraph, and configured with an IP-based rate limit (3 requests per minute). Verify enforcement in Netlify deployment logs and monitor AI credit usage.
