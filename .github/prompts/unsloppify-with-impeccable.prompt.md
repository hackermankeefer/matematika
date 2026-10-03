---
name: unsloppify-with-impeccable
description: Use the Impeccable design skill to audit and refine the Mathematics Observatory UI while preserving behavior, curriculum, accessibility, and the established visual identity.
agent: agent
---

# Refine the Mathematics Observatory with Impeccable

Use this prompt after installing Impeccable in the repository with `npx impeccable install` and enabling its instructions/commands in your coding agent. Impeccable is an external design skill; do not assume it is installed just because this prompt exists. If its slash commands are unavailable, stop and tell the user to complete installation and restart/reload the agent first.

Use the Impeccable commands and design guidance from https://impeccable.style/ rather than inventing a new design system.

## Product and users

This is a Grade 11 General Mathematics learning site. Its primary users are high-school students exploring curriculum topics, reading concise worked explanations, practicing formulas, and asking the optional AI tutor for help. The design should make mathematical content legible and calm, keep controls obvious, work on mobile, and support keyboard and assistive technology users.

## Workflow

1. Inspect the live/local pages and existing CSS before changing anything. Read `README.md` for the project layout and run the static site through HTTP. Do not redesign from screenshots alone.
2. Run `/impeccable document` to record the current design rules in `DESIGN.md`. Review them for accuracy and preserve useful palette, typography, spacing, and component decisions. If PRODUCT.md is supported, document the student audience, their learning goals, and accessibility needs there.
3. Run `/impeccable critique` on the current site, focusing on readability, hierarchy, page consistency, responsive behavior, and accessibility. Prioritize actual usability problems over decorative novelty.
4. Run `/impeccable polish` for the agreed pages/components. Ask it to retain all existing curriculum text, route destinations, assistant controls, formula interactions, and deterministic answer checks. Do not remove a feature to make the layout easier.
5. Use targeted commands such as `/impeccable typeset`, `/impeccable layout`, `/impeccable colorize`, `/impeccable adapt`, or `/impeccable distill` only where critique identifies a specific need. Avoid applying every command or adding motion merely for decoration.
6. Review the diff and manually verify links, mobile layouts, keyboard focus, contrast, reduced-motion behavior, and that the tutor and formula practice still work. Run `npm test` and the Impeccable detector/hook if installed. Fix findings caused by the changes before finishing.

## Guardrails

- Keep this a static multi-page site with its existing root HTML entries and organized `assets/` structure; do not migrate to a framework or alter AI deployment/security configuration as part of visual polish.
- Preserve Grade 11 learning scope and mathematical accuracy. Do not fabricate counts, lessons, destinations, testimonials, or unavailable pages.
- Keep API keys, student data, and server environment variables out of browser assets and design documentation.
- Avoid generic AI-style gradients, excessive pill cards, arbitrary animation, fake social links, and tiny low-contrast labels. Prefer a few intentional, reusable decisions and clear mathematical typesetting.
- State which pages were changed, the user-facing improvements, checks performed, and any outstanding design findings.
