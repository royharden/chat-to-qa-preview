# chat-to-qa-preview

**This is not a privacy guarantee. Nothing in this repository has been run yet.**

A local preview that will turn one exported AI chat (an xexport Markdown export, or S47's own JSON format) into one
redacted, grounded question-and-answer pair, shown byte-for-byte for a person to approve before any download.

## Source construction

Built under Dirty Mode (static construction only, 2026-10-27): no dependency has been installed, no test, build,
type check, dev server or browser has run, and no measurement exists. Every behaviour described in `docs/` is the
intended behaviour of code that has only been read and parse-checked. What has and has not been checked is in
`docs/VALIDATION.md` and `docs/DEFERRED-VALIDATION.md`.

Implemented source (separate static milestone reviews are recorded in the outer workspace):

- `ChatSessionV1` schema (`src/lib/schema/chatSession.ts`): roles user, assistant, tool, thinking; caps of 5 MiB,
  2,000 turns, 100,000 UTF-16 units per turn, 4,000,000 in total.
- Two import adapters with fixed refusal codes (`src/lib/adapters/`, rules in `docs/FORMAT.md`).
- `candidateTurns()` / `modelViewTurns()` (`src/lib/session/views.ts`): only included user and assistant turns.
- Two frozen evaluation baselines, pinned by SHA-256 in `src/lib/baselines/FREEZE.json` and used only by the
  evaluator:
  - **R0 no-redaction**: returns text unchanged (a control).
  - **R1 regex-only**, exactly these rules: email addresses; AWS access key ids with an `AKIA` or `ASIA` prefix;
    `sk-` keys; GitHub tokens with a `ghp_` or `github_pat_` prefix; Slack tokens with an `xoxb-` or `xoxp-`
    prefix; a token after case-insensitive bearer with 1–8 spaces/tabs; the PEM private-key header line (the key body is not redacted by R1).
- Synthetic fixtures under `fixtures/` and test sources under `tests/` (written, not run).

- Seeded dev-only templates and label recipes, report-only admission tooling and an independent custodian specification.
- Typed redaction placeholders, signature/name rules, deny-list review, manual spans and a fail-closed entropy gate.
- Current-revision UTF-16 citations, lexical grounding, deterministic extractive selection and diagnostic mutators.
- A React review flow: confirm roles, confirm names, inspect redaction, edit one cited Q&A, inspect both exact byte streams,
  approve hashes in IndexedDB, and download only after fresh checks. Text-only rendering keeps HTML, images and links inert.
- Mock-first model adapters, bounded redacted requests, cumulative CLI ledger and zero-cap server budget/RLS source.
- A keyless diagnostic evaluation CLI, value-based oracle, preregistration and named failure rows. Results remain `not_run`.

No live model call, deployment or publication has occurred. Roy approved a USD 40 total ceiling only; access, provider/model,
independent held-out custodian and publication remain pending. Code defaults to zero spend. Prices are unverified and live calls refuse.
The local CLI cap is cumulative but is a local guard, not a server-enforced cap. The web function has a separate zero database cap.
The keyless UI needs no backend. Prepared backend source is described in `BOLT-HANDOFF.md` (not provisioned).

## The claim this project is built to test

A seeded identifier-leak rate in the final publishable bytes, per identifier family with every miss named, for the
full pipeline versus R1 versus R0, on independently authored synthetic held-out sessions. **No number exists.** Any
future number will come only from `results/results.md`.

## Later setup and validation

Dirty Mode forbids executing these steps now. After Roy closes it and authorizes setup, verify declared dependency versions,
then run `npm install`, `npm run typecheck`, `npm test`, `npm run build` and the detailed checks in `docs/DEFERRED-VALIDATION.md`.
No lockfile exists because dependencies have never been installed. Run the keyless UI with `npm run dev` only after allocating
an authorized local port. The CSP needs a browser check and keeps remote connections blocked in the default UI.

Run `npm run eval -- --mock --out results/run-dev-001` only after the offline checks pass. This uses builder-dev recipes,
not held-out data, and refuses overwriting a previous run. `npm run freeze` writes a source snapshot only and never creates a tag.
Held-out mode requires an independently authored GO receipt plus exact manifest hashes and explicit set/bundle paths;
see `docs/EVALUATION.md`. No receipt, hidden dataset or evaluation tag is included.

`docs/LIMITATIONS.md` lists known misses. Lexical grounding is never a semantic verification or a privacy certificate.

## Rules for contributors

See `AGENTS.md`. Synthetic data only; never commit a real export or a key.
