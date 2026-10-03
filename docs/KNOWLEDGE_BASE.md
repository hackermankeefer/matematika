# Knowledge-base architecture and authoring guide

The site's knowledge base is a small, versioned static data store. The browser loads one generated manifest and then fetches only the topic modules listed there. Topic definitions and practice examples are separate files, and the slug joins them. No database server, build framework, or hard-coded module list is needed.

## Data flow

```text
Contributor creates/edits JSON
        │
        ├── data/knowledge/topics/<slug>.json
        └── data/knowledge/examples/<slug>.json
                         │
                         ▼
       npm run knowledge:build
       (validates files and writes manifest.json)
                         │
                         ▼
 assets/js/curriculum-data.js fetches manifest + pairs
                         │
                         ├── window.GRADE_11_MATH_KNOWLEDGE
                         ├── window.GRADE_11_MATH_EXAMPLES
                         └── window.Grade11MathKnowledgeBase
                                  │
                                  ▼
              assistant retrieval selects relevant content
```

`assets/js/assistant.js` consumes these browser globals for keyword/subtopic retrieval and example matching. It does not need to import or read every knowledge file itself. The helper `Grade11MathKnowledgeBase.getTopic(idOrName)` and `getExamples(idOrName)` provide direct lookups for UI features that need one module.

## Add a topic without reading the whole knowledge base

1. Choose one lowercase kebab-case slug, for example `quadratic-functions`.
2. Copy `data/templates/topic.template.json` to `data/knowledge/topics/<slug>.json`.
3. Copy `data/templates/examples.template.json` to `data/knowledge/examples/<slug>.json`.
4. Replace the placeholders with verified Grade 11 content. Keep the exact same `topicName` in both files. Do not paste an entire source document into a module; add concise, independently useful subtopics and examples.
5. Run `npm run knowledge:build`. This scans the two content directories, checks the pairs and required fields, and regenerates `data/knowledge/manifest.json` in sorted order. Do not hand-edit the manifest.
6. Run `npm test`. The pretest step confirms the checked-in manifest is current, and structural tests validate the generated index and module content.

To add content to an existing topic, edit only the matching `topics/<slug>.json` or `examples/<slug>.json` file. The topic index does not change unless a slug is added, removed, or renamed.

## AI authoring instructions

When an AI agent is asked to add knowledge:

- Read this guide, the two templates, and only the topic/example module directly related to the requested addition. Read another module only if cross-topic accuracy requires it.
- Add content only under `data/knowledge/topics/` and `data/knowledge/examples/`; never put curriculum entries into application JavaScript, tests, or the generated manifest.
- Preserve unrelated content and stable example IDs. New example IDs must be unique across the entire example bank, such as `<topic-slug>-intermediate-03`.
- Keep student-facing material curriculum-aligned, mathematically checked, concise, and explicit about units, assumptions, domain restrictions, and method conditions.
- Store equations in the existing representation: KaTeX source in `formulas[].latex`; prose descriptions and worked examples in JSON strings. Escape JSON quotes and backslashes correctly.
- Pair the same topic name across the topic and examples files. Add useful retrieval keywords at the narrowest appropriate level.
- Run `npm run knowledge:build` followed by `npm test`. Include the generated manifest change in the same contribution.

## Topic module schema

A topic file contains:

- `topicName`: unique human-readable name, exactly matching its example file.
- `topicOverview`: concise summary used to frame retrieval.
- `keywords`: topic-level terms used by retrieval.
- `prerequisites`: assumed knowledge.
- `subtopics`: one or more self-contained entries. Each entry has a `name`, `keywords`, and arrays named `definitions`, `formulas`, `importantProperties`, `commonMistakes`, `prerequisites`, and `exampleProblemTypes`. Optional `conditions`, `derivations`, and `workedExamples` add important method constraints and teaching context; use arrays when included.

Formula entries use `{ "name", "latex", "variables" }`. A variable uses `{ "symbol", "meaning" }`. Keep LaTeX expressions compatible with KaTeX.

## Example module schema

An example file has a matching `topicName`, a `topicOverview`, and a non-empty `examples` array. Each example requires non-empty strings for `id`, `difficulty`, `question`, `given`, `expectedMethod`, `workedSolution`, `finalAnswer`, and `commonMistake`. `formula` is optional. The test suite checks unique IDs and duplicate questions.

Supported difficulty values are `beginner`, `intermediate`, `advanced`, `application`, `challenge`, and `analysis`.

## Folder map

- `data/knowledge/topics/`: concept definitions, formulas, constraints, retrieval keywords.
- `data/knowledge/examples/`: learner questions, worked solutions, and answer rubrics.
- `data/knowledge/manifest.json`: generated topic-to-example index used by the browser.
- `data/templates/`: starter JSON structures; templates are not loaded into the site.
- `docs/references/`: original source PDF and expanded reference notes; not fetched at runtime.
- `assets/js/curriculum-data.js`: manifest loader, pair validation, and browser API.
- `scripts/build-knowledge-index.js`: validation and manifest generation.

## Important constraints

The runtime requires a static HTTP server because browsers block JSON `fetch()` requests from `file://` pages. A successful JSON build validates structure, not mathematical correctness; the content author must verify calculations against trusted sources. Keep private student data, credentials, and personal information out of this public static repository.
