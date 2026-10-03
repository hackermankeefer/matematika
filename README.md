# The Mathematics Observatory

A static, multi-page Grade 11 General Mathematics learning site with curriculum notes, formula practice, worked examples, mathematical reasoning content, and an AI tutor that can use Gemini through Vercel or a local Ollama service.

## Features

- **Learn:** Grade 11 topic overview and suggested study path.
- **Explore:** searchable formulas, generated practice examples, worked solutions, and answer checking.
- **History:** mathematics timeline and mathematician profiles.
- **Why It Works:** intuitive explanations, derivations, and proofs.
- **Math Assistant:** curriculum retrieval, deterministic calculator/answer checks, KaTeX, Gemini API through a server-side Vercel Function, or local Ollama.
- **Curriculum library:** paired topic-reference and worked-example JSON modules.

The pages implemented in this repository are Home, Learn, Explore, History, and Why It Works. The front end is static; Gemini is provided by one small Vercel serverless API function, not a long-running application server.

## Architecture

```text
.
├── index.html, learn.html, explore.html, history.html, proofs.html
├── assets/
│   ├── css/                         # Shared and per-page stylesheets
│   ├── js/                          # Shared/page scripts, AI tutor, calculator, data loader
│   └── images/                      # Page illustrations
├── api/assistant.js                 # Vercel Gemini proxy (server-side secret)
├── data/
│   ├── knowledge/
│   │   ├── manifest.json            # Generated, sorted topic/example index
│   │   ├── topics/<slug>.json       # Curriculum definitions and formulas
│   │   └── examples/<slug>.json     # Worked examples paired by slug
│   └── templates/                   # Starter JSON schemas for contributors
├── docs/
│   ├── KNOWLEDGE_BASE.md            # Full architecture and authoring guide
│   ├── CODE_REVIEW_AND_ROADMAP.md   # Reviewed risks and prioritized follow-up work
│   └── references/                  # Curriculum source documents
├── scripts/build-knowledge-index.js # Validates modules and generates manifest
├── tests/                           # Offline, proxy, structure, and live Ollama tests
├── .github/instructions/            # AI contributor instructions for knowledge JSON
├── .github/copilot-instructions.md  # Repository-wide coding/review/PR guidance
├── .github/prompts/                 # Reusable Impeccable website-polish prompt
└── package.json                     # Knowledge commands, tests, and KaTeX dependency
```

HTML entry pages stay at the root so GitHub Pages and basic static servers can publish the site without a build framework. Scripts, styles, images, knowledge, docs, and tests are organized in dedicated folders.

### How data reaches the tutor

1. The contributor maintains one topic JSON and one example JSON for each lowercase kebab-case topic slug.
2. `npm run knowledge:build` validates all file pairs and generates `data/knowledge/manifest.json` in sorted order. Contributors do not edit the manifest by hand.
3. `assets/js/curriculum-data.js` fetches the manifest and each paired file over HTTP, validates the pair, and exposes the loaded data to the browser.
4. `assets/js/assistant.js` retrieves relevant subtopics and examples by keywords, then uses calculator results when a supported deterministic operation is detected.

An AI author can work on a topic by reading the authoring guide, the two templates, and only the relevant pair—not the whole knowledge library. The shared contributor instructions are in `.github/instructions/knowledge-authoring.instructions.md`.

## Add or update curriculum data

For a new topic, choose a slug such as `quadratic-functions` and create these two files:

- `data/knowledge/topics/quadratic-functions.json`
- `data/knowledge/examples/quadratic-functions.json`

Copy their structures from `data/templates/topic.template.json` and `data/templates/examples.template.json`. Use the same `topicName` in both modules. Then run:

```sh
npm run knowledge:build
npm test
```

The build discovers pairs from the filenames, validates their required schema and duplicate example IDs, and updates the manifest. Adding content to an existing topic only requires changing that topic's pair; the manifest is unchanged. See [docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md) for field definitions, AI-specific rules, quality checks, and the retrieval flow.

## Run locally

Use Node.js 18 or newer for package scripts and tests. Install project dependencies:

```sh
npm install
```

Serve the repository root over HTTP (do not open an HTML file using `file://`, because browser security blocks the knowledge JSON fetches):

```sh
python -m http.server 8000
```

Open <http://localhost:8000>.

Run the offline tests and verify the generated index:

```sh
npm test
```

Regenerate the knowledge index after adding/renaming topic pairs:

```sh
npm run knowledge:build
```

Check that the committed generated manifest is current without rewriting it:

```sh
npm run knowledge:check
```

## AI tutor providers

### Gemini on Vercel (recommended for hosted use)

The deployed site defaults to the same-origin `/api/assistant` Vercel Function. The function calls Gemini server-side, keeps the API key out of browser JavaScript, fixes the model on the server, limits request size, validates chat messages, rejects cross-origin browser calls, and applies a best-effort per-IP burst limit. It returns the same response shape as Ollama, so the tutoring, curriculum retrieval, and deterministic calculator/answer verification stay shared between providers.

The default model is `gemini-3.5-flash-lite`: a fast, lower-cost/free-tier Flash-Lite model suitable for short Grade 11 tutoring. The local deterministic calculator remains responsible for supported exact arithmetic; the model is used for explanations and unsupported conceptual reasoning. Do not switch to a Pro/reasoning-heavy model unless measured answer quality shows Flash-Lite is insufficient. Model availability, free quota, terms, and limits can change; review Google's current [model list](https://ai.google.dev/gemini-api/docs/models) and [pricing/free-tier details](https://ai.google.dev/gemini-api/docs/pricing). Google's free tier is limited and may use submitted content to improve products; do not send student names, grades, or other identifying information.

**Do not add or rotate ten Gemini API keys.** Keys are credentials, not extra free student seats; cycling keys to bypass rate limits or quotas is not supported. Use one API key owned by the deployment owner, protect it as a server secret, respect its quota, and request legitimate quota/billing increases if needed. Never place the key in HTML, browser JavaScript, Git, a prompt, or a public `.env` file.

#### Deploy on Vercel

1. Push this repository to GitHub and import it into Vercel, or install the Vercel CLI, run `npx vercel link` once, then run `npx vercel` from the repository root. No frontend build command or output directory is required; Vercel serves the root HTML and discovers `api/assistant.js` as a serverless function.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
3. In Vercel **Project → Settings → Environment Variables**, add `GEMINI_API_KEY` (secret) and optionally `GEMINI_MODEL` (default `gemini-3.5-flash-lite`). Add them to the Preview/Production environments you will use, then redeploy.
4. For local Vercel development, copy [.env.example](.env.example) to `.env.local`, add your own key there, and run `npx vercel dev`. `.env.local` is gitignored. Do not use a public static server alone to test the Gemini route; it cannot execute Vercel Functions.
5. Deploy from the Vercel dashboard or run `npx vercel --prod` after environment variables are set. Configure a Vercel Firewall/rate-limit rule for `/api/assistant` appropriate to your student audience. The function's in-memory throttle is only a best-effort burst guard: serverless instances do not share memory, so it is not a distributed quota system or a substitute for platform-level rate limiting/authentication.

The Gemini browser client sends only the current conversation and response schema to your same-origin function. The function uses `GEMINI_API_KEY` and `GEMINI_MODEL`; neither is exposed as a `NEXT_PUBLIC_` or frontend variable.

### Local Ollama (no cloud API key)

To use a local model, install Ollama, pull the default model, and start its service:

```sh
ollama pull qwen3:4b
ollama serve
```

Ollama is not sent through the Vercel Gemini proxy. To select it, set `window.MATHEMATICS_AI_PROVIDER = 'ollama'` before `assets/js/assistant.js` loads; optionally set `window.MATHEMATICS_AI_ENDPOINT` and `window.MATHEMATICS_AI_MODEL`. The browser calls Ollama directly, so it must be running and allow the local site's origin. Do not expose an unauthenticated Ollama endpoint to an untrusted network.

The optional live evaluation needs the service and model running:

```sh
npm run test:ollama
```

`MATHEMATICS_AI_ENDPOINT` and `MATHEMATICS_AI_MODEL` environment variables can override the live test defaults. The regular `npm test` suite tests the Gemini proxy with a mocked upstream and does not need a Gemini key, Ollama, or internet access.

## Visual design workflow (Impeccable)

The reusable agent prompt is [.github/prompts/unsloppify-with-impeccable.prompt.md](.github/prompts/unsloppify-with-impeccable.prompt.md). To use it, install Impeccable in the project with `npx impeccable install`, follow its setup prompts, and reload the coding agent so its commands/instructions are discovered. Then ask the agent to run `/impeccable document`, `/impeccable critique`, and `/impeccable polish` using that prompt. It directs the agent to preserve learning content, routes, assistant behavior, accessibility, and the existing design direction while refining the UI. Impeccable is a separate agent skill, not a runtime dependency of this website.

## Deployment and source material

The learning pages and deterministic calculator can be hosted as static files, for example with GitHub Pages. Gemini requires the Vercel Function (or an equivalent private server-side proxy); a plain GitHub Pages deployment cannot run `api/assistant.js`. Ollama requires a separately accessible local service.

See [docs/CODE_REVIEW_AND_ROADMAP.md](docs/CODE_REVIEW_AND_ROADMAP.md) for reviewed security/reliability limitations and the prioritized follow-up features. In particular, configure and verify Vercel-level rate limiting before exposing the Gemini route publicly.

Original curriculum source material is retained in `docs/references/`. The running app fetches structured JSON from `data/knowledge/`; it does not parse the PDF or text reference at runtime.
