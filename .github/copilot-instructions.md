# Repository contributor instructions

## Project boundaries

- This is a static multi-page learning site plus one Vercel Node.js function at `api/assistant.js`. Keep page entry points at the repository root for static hosting; browser assets belong in `assets/`, authored curriculum/example data in `data/knowledge/`, source materials/docs in `docs/`, and executable tests in `tests/`.
- Read `README.md` for setup and deployment, and read `docs/KNOWLEDGE_BASE.md` before changing curriculum data or its loader.
- Do not introduce a framework, database, build pipeline, or large AI SDK without a specific requirement and a measured benefit.

## AI providers and student privacy

- Keep deterministic classification, calculations, retrieval, answer verification, response formatting, KaTeX rendering, conversation history, and tutoring modes provider-independent in `assets/js/assistant.js`.
- Gemini is a server-side provider: call same-origin `/api/assistant`; read its key only from `process.env.GEMINI_API_KEY` in the Vercel Function. Never place a key in browser bundles, HTML, docs containing real credentials, or commit history.
- Do not add key pools/rotation to bypass quotas. Respect provider policies and free quotas. Treat serverless in-memory throttling as a best-effort burst guard only; before a public launch, configure a tested Vercel WAF/rate limit or a shared durable limiter and monitor usage/costs.
- Keep Ollama as an explicitly selectable local provider. Never send browser requests through Gemini when the selected provider is Ollama.
- Minimize retention and transmission of student data. Preserve private chat storage behavior, add a clear-history control and retention notice before collecting accounts or analytics, and never log full student prompts by default.
- Use a low-latency Flash-Lite model by default for short Grade 11 tutoring. Keep supported exact arithmetic in the deterministic calculator; test model quality before considering larger, higher-cost models.

## Code review priorities and planned hardening

Review these issues before expanding public use, in priority order:

1. **Public API cost controls (P1):** `api/assistant.js` is an unauthenticated public endpoint. Its in-memory IP bucket is not shared across Vercel instances and does not provide a global quota. Configure a deployment-level limit/authentication strategy, confirm trusted Vercel client-IP header behavior for the deployed topology, set usage/billing alerts, and test abuse/rate-limit responses. Do not claim the in-memory limiter alone prevents abuse.
2. **Knowledge schema safety (P2):** `scripts/build-knowledge-index.js` checks module structure but should validate nested definition/formula/variable shapes and non-empty retrieval fields. Invalid nested content currently risks breaking runtime retrieval/rendering. Add fixtures for malformed formulas, keywords, variable lists, and duplicate IDs/questions; fail during authoring rather than report an AI network error.
3. **Provider failure coverage (P2):** Test Gemini `400`, `403`, `429`, `5xx`, timeout, missing candidate, malformed response, oversized body, invalid schema, and cross-origin rejection. Keep provider errors safe and useful to students without revealing API keys, upstream bodies, or stack traces.
4. **Request sequencing and resilience (P2):** Bound chat/context payloads, handle provider response truncation/empty structured JSON, avoid duplicate submissions, and provide a clear retry message. Preserve deterministic answer enforcement for supported problems.
5. **Student controls (P3):** Add a visible clear-chat action and explain that conversation history is stored in local browser storage and that hosted Gemini sends the current conversation to Google. Implement explicit retention controls before adding remote user accounts/analytics.
6. **Operational maintenance (P3):** Pin/test the selected Gemini model against the supported API version, document model/terms review cadence, and expose aggregate counts/status without recording student prompt contents.
7. **Design quality (P3):** Use Impeccable only when installed; start with `/impeccable document` and `/impeccable critique`, then perform targeted `/impeccable polish` work. Preserve mathematical clarity, current information architecture, keyboard access, responsive layout, reduced-motion support, and AI/data behavior. Follow `.github/prompts/unsloppify-with-impeccable.prompt.md`.

## Change and pull-request workflow

- For new knowledge, follow `.github/instructions/knowledge-authoring.instructions.md`, edit only the relevant topic/example pair, run `npm run knowledge:build`, and include the generated manifest.
- Add/update tests for behavior and security boundaries. Run `npm test`; run `npm run test:ollama` only when a local Ollama model/service is intentionally available. Do not claim a test passed if it was not run.
- Verify root page links and CSS URL assets after moves. Run `git diff --check` and inspect the final diff for unrelated changes or secrets.
- PR descriptions should state scope, design/data/API behavior, tests actually run (including missing runtime prerequisites), deployment configuration needed, limitations, and known follow-up work. Do not deploy a public Gemini endpoint until the P1 cost-control review is addressed.
