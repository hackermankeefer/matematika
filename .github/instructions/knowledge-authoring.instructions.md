---
name: knowledge-authoring
description: Add or update Grade 11 mathematics knowledge modules, worked examples, or generated knowledge manifest entries. Use for curriculum JSON authoring and knowledge-base maintenance.
applyTo: "data/knowledge/**/*.json"
---

# Knowledge-base authoring rules

- Follow `docs/KNOWLEDGE_BASE.md`; it is the source of truth for the knowledge schema and contributor workflow.
- To author an addition, inspect the relevant topic/example pair and `data/templates/` only. Do not read the full knowledge base unless cross-topic validation requires it.
- Add topic content only under `data/knowledge/topics/<lowercase-kebab-slug>.json` and worked examples under `data/knowledge/examples/<same-slug>.json`.
- Keep `topicName` identical in the paired files. Each subtopic should have precise retrieval keywords, definitions, formula notation, constraints, common mistakes, prerequisites, and useful question types. Examples must have unique stable IDs, worked calculations, a final answer, and a likely common mistake.
- Preserve unrelated entries and existing IDs. Verify calculations, units, conditions, and curriculum scope; never present generated content as officially sourced unless it is verified against the references.
- Do not manually edit `manifest.json`. After adding/renaming a pair, run `npm run knowledge:build`; it validates the files and regenerates the sorted manifest automatically.
- Run `npm test` after the index build and report if runtime tests cannot be executed.
