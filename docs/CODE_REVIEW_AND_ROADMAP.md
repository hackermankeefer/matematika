# Code review and improvement roadmap

This is a static, student-facing Grade 11 mathematics site with an optional model-backed assistant. This review covers the current Vercel/Gemini proxy, local Ollama path, curriculum data pipeline, and the project organization. Priorities describe follow-up work; they are not claims that those features are already implemented.

## Review summary

### P1 — Protect the public AI endpoint against quota abuse before launch

`api/assistant.js` is unauthenticated and forwards accepted requests to a metered Google API. The in-memory per-IP counter is best-effort only: Vercel function instances have separate memory, reset during scaling/cold starts, and do not share counters. Vercel documents that it overwrites `X-Forwarded-For` to prevent client IP spoofing for standard deployments, but deployments behind a different proxy must verify which trusted IP header is preserved. The handler's same-origin check is useful browser protection; it is **not authentication** and does not stop scripts/curl clients from calling the function.

Before a public launch:

1. Set and test a Vercel WAF/rate-limit rule for `/api/assistant`; use authentication or a shared durable limiter if stronger per-user quotas are required.
2. Verify the actual production client IP/header behavior in the deployment topology. Trust only platform-controlled headers; do not accept an arbitrary first `X-Forwarded-For` value from a caller.
3. Set Google AI Studio quota/billing alerts and provider usage monitoring. A free API quota can be exhausted and should not be represented as guaranteed/free for every student.
4. Add deployment integration checks that prove the configured limit is active before production release.

The in-memory bucket remains a helpful warm-instance burst guard, not the production quota mechanism.

### P2 — Expand knowledge schema validation

`scripts/build-knowledge-index.js` discovers pairs and validates their high-level shape, supported example difficulty, duplicate questions, and IDs. It does not yet fully validate nested definition/formula/variable fields, keyword types, or every value that runtime retrieval expects. A malformed nested formula can pass the build then cause `assistant.js` retrieval to throw while processing a question.

Improve it with explicit validation helpers for topic metadata, subtopics, definitions, formulas, variables, and example fields. Include test fixtures for invalid nested objects, blank keywords, invalid KaTeX text policy if adopted, duplicated IDs/questions, and missing topic/example partners. Keep validation deterministic and run it before deployment.

### P2 — Cover Gemini proxy failure and security boundaries

The unit tests cover the successful translation path, non-POST method, and missing credentials. Add mocked tests for:

- same-origin policy rejection and allowed preview/production host behavior;
- body size, message count/length, malformed request, invalid model name, and missing final user turn;
- upstream 429, 5xx, network rejection, timeout, empty candidates, blocked prompt/finish reason, and malformed JSON output;
- distributed/platform rate-limiting configuration in a deployment test or documented release checklist.

Return student-safe errors and never echo upstream bodies, keys, raw prompts, or stack traces. Keep the Gemini response translator tested against the exact selected stable model and API schema.

### P2 — Improve request resilience and test the provider boundary

The browser retains a provider-independent tutor formatter and deterministic calculation verification, which is the right division of responsibility. Preserve that boundary. Follow-up tests should cover provider switching, history trimming, recent-history role ordering, request cancellation/timeout feedback, duplicate-submit behavior, and malformed structured responses. Do not let a provider change bypass `Grade11MathCalculator` answer enforcement.

### P3 — Improve learner privacy controls

Conversation history currently lives in browser local storage. Add a clear-history control and a short notice explaining local persistence. When Gemini is selected, tell learners that the current conversation is sent to the configured provider and link its relevant privacy/terms information. Do not add analytics or server-side prompt logging without a privacy review, disclosure, and retention policy.

### P3 — Add operational model/usage maintenance

Make the default model configurable only server-side for hosted Gemini, but validate it against a maintained allowlist if operators should not enter arbitrary model names. Keep the small Flash-Lite default for short Grade 11 tutoring; measure answer quality with the existing live cases before increasing model size, context, output tokens, or cost. Monitor model deprecations, free-tier quotas, pricing, and terms; do not rotate multiple keys to get around quotas.

### P3 — Establish a visual design record

Use the supplied Impeccable prompt after installing its skill. Run `/impeccable document` to capture the real design system, `/impeccable critique` to identify usability issues, then targeted `/impeccable polish` or `/impeccable typeset` work. Verify math rendering, contrast, mobile behavior, keyboard interaction, reduced motion, and all existing page/assistant behavior. Treat the product-specific instructions as guidance; Impeccable is an optional authoring-time tool, not a runtime dependency.

## Already in place

- Folder separation for root HTML entry pages, browser assets, topic/example data, templates, references, tests, and Vercel API function.
- Manifest-driven topic/example discovery and generated sorted index.
- Same-origin Gemini proxy that stores its key in a Vercel server environment variable, limits request dimensions, checks basic request shape, and returns a response compatible with the existing tutor formatter.
- Local Ollama request path and deterministic calculator/answer verification are retained.
- Offline tests exercise core tutor behavior, manifest loading, folder references, and a mocked Gemini success/missing-key path.

These controls reduce accidental mistakes but do not constitute production authentication, distributed quotas, or comprehensive nested schema validation.

## Suggested next milestones

1. **Before public launch:** configure and verify Vercel WAF/rate limits; add integration/abuse tests; set provider quota alerts.
2. **Content reliability:** complete recursive knowledge-schema validation and add invalid-fixture tests.
3. **Tutor reliability:** test upstream failures, timeout, structured-output edge cases, recent-history boundaries, and clear retry behavior.
4. **Student privacy:** add local clear-history and provider disclosure UI.
5. **Design quality:** run Impeccable critique/polish, then manually check real pages at mobile and desktop sizes.

See `.github/copilot-instructions.md` for repository-wide AI coding and PR rules.
