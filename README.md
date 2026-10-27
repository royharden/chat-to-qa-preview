# chat-to-qa-preview

**This is not a privacy guarantee. Nothing in this repository has been run yet.**

A local preview that will turn one exported AI chat (an xexport Markdown export, or S47's own JSON format) into one
redacted, grounded question-and-answer pair, shown byte-for-byte for a person to approve before any download.

## Status (milestone M1 of 7)

Built under Dirty Mode (static construction only, 2026-10-27): no dependency has been installed, no test, build,
type check, dev server or browser has run, and no measurement exists. Every behaviour described in `docs/` is the
intended behaviour of code that has only been read and parse-checked. What has and has not been checked is in
`docs/VALIDATION.md` and `docs/DEFERRED-VALIDATION.md`.

What exists after M1:

- `ChatSessionV1` schema (`src/lib/schema/chatSession.ts`): roles user, assistant, tool, thinking; caps of 5 MiB,
  2,000 turns, 100,000 UTF-16 units per turn, 4,000,000 in total.
- Two import adapters with fixed refusal codes (`src/lib/adapters/`, rules in `docs/FORMAT.md`).
- `candidateTurns()` / `modelViewTurns()` (`src/lib/session/views.ts`): only included user and assistant turns.
- Two frozen evaluation baselines, pinned by SHA-256 in `src/lib/baselines/FREEZE.json` and used only by the
  evaluator:
  - **R0 no-redaction**: returns text unchanged (a control).
  - **R1 regex-only**, exactly these rules: email addresses; AWS access key ids with an `AKIA` or `ASIA` prefix;
    `sk-` keys; GitHub tokens with a `ghp_` or `github_pat_` prefix; Slack tokens with an `xoxb-` or `xoxp-`
    prefix; the token after `Bearer `; the PEM private-key header line (the key body is not redacted by R1).
- Synthetic fixtures under `fixtures/` and test sources under `tests/` (written, not run).

Not built yet: the redaction engine, span grounding, Q&A selection, the review UI, approval and download, model
providers, the evaluation harness. No live model call, deployment or publication is approved, and spend is $0.

## The claim this project is built to test

A seeded identifier-leak rate in the final publishable bytes, per identifier family with every miss named, for the
full pipeline versus R1 versus R0, on independently authored synthetic held-out sessions. **No number exists.** Any
future number will come only from `results/results.md`.

## Rules for contributors

See `AGENTS.md`. Synthetic data only; never commit a real export or a key.
