# HSA 4 Study — 12 independent online voices (Google Cloud Chirp 3 HD)

## Voice design (real independent Google speaker identities)
Arabic aliases are familiar Saudi **display names**, not assertions of Saudi-born human actors or **Saudi-accent speech**. Google `ar-XA` is generic Modern Standard Arabic. `en-US` is US English.

| Group | Interface display | Provider voice |
|---|---|---|
| Arabic male | فهد | ar-XA-Chirp3-HD-Achird |
| Arabic male | عبدالله | ar-XA-Chirp3-HD-Charon |
| Arabic male | سعود | ar-XA-Chirp3-HD-Fenrir |
| Arabic female | نورة | ar-XA-Chirp3-HD-Achernar |
| Arabic female | ريم | ar-XA-Chirp3-HD-Aoede |
| Arabic female | سارة | ar-XA-Chirp3-HD-Leda |
| English male | James | en-US-Chirp3-HD-Algenib |
| English male | Liam | en-US-Chirp3-HD-Orus |
| English male | Noah | en-US-Chirp3-HD-Schedar |
| English female | Emma | en-US-Chirp3-HD-Autonoe |
| English female | Olivia | en-US-Chirp3-HD-Kore |
| English female | Sophia | en-US-Chirp3-HD-Zephyr |

Source: [Google Cloud supported voices](https://cloud.google.com/text-to-speech/docs/voices) and [Chirp 3 HD](https://cloud.google.com/text-to-speech/docs/chirp3-hd).
There are **12 different speaker names**, not pitch/rate variants of one voice.

## Required activation — cannot be bypassed

The account holder must enable Google Cloud Text-to-Speech API and billing/quota and create a server API credential. In Netlify project `13f657c7-6409-43de-b4c5-2e110b069f4b`, use Site configuration → Environment variables:

- **Key:** `GOOGLE_CLOUD_TTS_API_KEY`
- **Scope:** Functions (or All)
- **Context:** Production (and deploy previews when testing)
- **Value:** your own Google Cloud API key (mark secret; never use `VITE_`).
- Restrict the key to **Cloud Text-to-Speech API**. Appropriate server-side credential/IP restrictions should be chosen with Netlify's egress model in mind, and Google Cloud API quotas and budget alerts set to avoid unexpected costs.

Redeploy after setting the secret. Test GET `/.netlify/functions/cloud-tts` returns `{"ready":true,...}`. This **only** proves a key is present; verify audio actually plays by clicking **تجربة** on every voice. Invalid keys, disabled billing, quotas, regional limitations or service failures are reported as errors and never silently use another voice.

**Present deployment status:** Netlify environment variables were empty when the feature was implemented. There is therefore **no production credential**; the new 12-speaker studio remains visible but disabled until activated, while existing explicitly remote browser voices remain accessible as a temporary fallback. Do not claim the twelve are playing in production until real requests and listening are validated.

## Browser and privacy behavior
- The server receives a small text chunk and a whitelisted `cloud:...` speaker ID; the provider API key stays on Netlify.
- Returns MP3 audio to the browser; supports pause, resume and stop via HTML audio. It does not use OS voices or download ONNX/Piper voice models.
- On first play some browsers may block audio auto-start. Click Play again if required.
- Text is processed by the third-party cloud speech service (Google Cloud), so the site should disclose this in its privacy information.
- The server validates the voice ID and input length, checks browser Origin, applies per-IP/domain rate limiting and uses no-store responses. Public web APIs still need account-level Google budget and quotas.
- Do not promise that Internet or Cloud TTS APIs will be available 100% of the time. The 12 speaker identities are deterministic across devices when the provider service is available.
- A test checks the correct provider payload and MP3 response for every catalog entry **using a mocked upstream**. It does not replace live audio synthesis and acoustic inspection.
