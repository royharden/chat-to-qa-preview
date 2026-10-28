# Validation log

Dirty Mode: only static checks are performed (reading, grep, `git` read commands, `sha256sum`, JSON parse via
`node -e`, and the outer shell's static gate, which type-strips and parse-checks `.ts` files without running any
product code). Nothing here is a test result. Runtime checks are listed in `DEFERRED-VALIDATION.md`.
Append-only; newest milestone last.

## M1 — scaffold, schema, adapters, frozen baselines (2026-10-27, 0814_Claude_Opus55_Sub_S47CodeM1)

Static gate: `bash ../agentops/static-gate.sh` → **GATE: CLEAN (exit 0)**, gate script sha256
`837a78c4b1091ff1e0d4b25b1cd762fbf4241c351b765e129dd614caaed40dea` (v2.1). Covered: TS-PARSE of every `.ts`
(20 files, all parsed), JSON-PARSE of every `.json`, SCAN (9 patterns, working tree + untracked + index: no hits),
CUSTODY-GREP (no hits), NET-GREP (no hits), INERT-RENDER (no hits), BASELINE-REACH (no hits), FREEZE-HASH (both
baselines match FREEZE.json; nothing committed yet, so the working files were compared). `.gate-allowlist`: none.

Other static checks performed:

| Check | How | Result |
|---|---|---|
| `src/main.tsx` (the only `.tsx`) | Read in full | Placeholder only; no baseline, network or HTML-injection use |
| Each of the 14 refusal codes is a string constant exactly once in `src/` | `grep -rhoE "['\"]<code>['\"]" src` per code | 1 each, all in `src/lib/adapters/refusals.ts` |
| Each refusal code has exactly one fixture and no stray file exists | `ls fixtures/refusals` | 14 files, one per code |
| Size refusals are recipes, not large files | Read the four `*.recipe.json` (≤ 0.6 KB each); arithmetic: oversize 84,000 × 64 B > 5,242,880 B; 1,001 × 2 = 2,002 turns; 10,001 × 10 = 100,010 units; 45 × 90,000 + 1 = 4,050,001 units in about 4.05 MB | As intended |
| `.gitattributes` effect (system `core.autocrlf=true`) | `git check-attr text eol` on fixtures and a baseline | Refusal fixtures, `basic.crlf.md`, `bom.json.txt`: `text: unset`; other files `text: auto`, `eol: lf` |
| Line endings of written files | Byte scan for CR in every untracked file | Only `fixtures/accept/basic.crlf.md` (40 CRLF line ends, intended) |
| Baseline hashes | `sha256sum src/lib/baselines/{regexOnly,noRedaction}.ts` over the final LF bytes, written to `FREEZE.json` | `regexOnly.ts` `47138ac166ea56e52044eaf99520f93bc5fafb03981841e33b6cb06c08a4f0dc`, `noRedaction.ts` `068a55903044208692676046b7af28e7707d602668dfac8cc39af4d870bd087e`; gate FREEZE-HASH ok |
| R1 contents match K20 exactly | Read `regexOnly.ts` | Seven rules: email, `AKIA`/`ASIA`, `sk-`, `ghp_`/`github_pat_`, `xoxb-`/`xoxp-`, token after `Bearer `, PEM private-key header line |
| No `src/lib/redactkit/` exists | `ls` | Absent (baselines precede any redactkit file) |
| Baselines not imported by the app | `grep` for imports of `baselines`, `leakeval`, `scripts/` in `src/` | None (the only importers will be `src/lib/leakeval/` and `scripts/eval.ts`, later milestones) |
| Pinned documentation sections | Read only the two N14 sections; `tr -d '\r' \| awk` line range `\| sha256sum`, cross-checked with `sed` and with the README's committed blob | Hashes in `docs/FORMAT.md` §1.1; both methods agree |
| Secret-shaped literals | Gate SCAN; test inputs written as concatenated parts | No hits |

## M2 — fixture recipes and admission preflight (Codex succession, 2026-10-27)

Source construction accepted after separate reviews: 0880 Medium changes requested; 0906 High changes requested;
0926 Extra High PASS. Corrections enforce exactly two seeds per dev template, preserve the distinct UUID coverage policy,
and scan nonignored untracked working files plus tracked working files and independent index blobs. Deleted working copies retain
index evidence; symlink/nonregular working paths fail closed. Custodian packet is specification only; no hidden data or receipt exists.

Root whole-tree static gate: **CLEAN, exit 0**, 157 TypeScript files parsed; JSON, SCAN working/untracked/index,
protected-data code-boundary grep, network/render/baseline import checks and frozen baseline hashes passed. Gate SHA-256:
`837a78c4b1091ff1e0d4b25b1cd762fbf4241c351b765e129dd614caaed40dea`. This shared source snapshot also covers the unchanged
reviewed M3–M6 source packaged in the next local commits. No application or test code executed; no allowlist was needed.
Fixture determinism, twin parity, labels, scanner/CLI behavior and admission tests are written but unexecuted.

## M3 — redactkit (2026-10-27)

Separate Medium source review 0902 PASS; private symbols and runtime identity, typed rendered placeholders,
revision hashing, deterministic overlap, entropy blocking, manual source spans and mapped one-pass JSON escape detection inspected.
Accepted for Dirty Mode construction — runtime unverified. Covered by the same unchanged-source whole-tree gate CLEAN
157-file snapshot recorded at M2 (same gate SHA-256); baseline hashes and pre-redactkit commit order preserved.
Rule/trap/property/type-boundary regression sources exist; none ran. No credential, raw chat or hidden fixture was used.

## M4 — spans, lexical grounding and selection (2026-10-27)

Separate Medium source review 0902 PASS. UTF-16/surrogate/revision checks, technical token boundaries,
sentence/code equality, K6 pairing/ties/complete-block caps, shared evaluator selector core and all ten mutators inspected.
Accepted for Dirty Mode construction — runtime unverified. Same unchanged-source whole-tree gate CLEAN at M2 applies
(157 files, gate SHA-256 above). Span, splitter, selection, mutator and expected-semantic-miss test sources remain unexecuted.
The label is lexical-only; no semantic verification or measured performance is claimed.

## M5 — public bytes, review, approval and download (2026-10-27)

Separate Medium review 0879 requested fixes; High correction 0895 and High review 0906 PASS.
Manual selections now accumulate across blocking results, and re-redaction invalidates prior bytes/approval before awaiting work.
Role/exclusion and explicit names confirmation, private brand, all-field/byte rescan, exact spans/excerpt cap, deterministic
allowlisted bytes, inert JSX, durable storage and both-hash approval/download checks inspected. Accepted for Dirty Mode
construction — runtime unverified; same unchanged-source gate CLEAN 157-file snapshot applies (gate SHA-256 above).
Supplemental High test-source review PASS with bounded coverage notes; source covers actual surrogate/cap, escaped-answer and
metadata rescans, storage denial and async lifecycle. No complete browser/field matrix or executed test pass is claimed.

## M6 — mock-first providers, budgets and backend source (2026-10-27)

Separate Medium review 0902 requested two corrections; High correction 0895 and High review 0906 PASS.
Outside-repo ledger guards now check real path segments, and model answer limits count block separators.
Private bounded model inputs, reservation-before-transport, unverified/empty prices, cumulative locked CLI ledger,
verified-user/operator handler, atomic zero-cap SQL and browser-denied RLS inspected. Accepted for Dirty Mode construction —
runtime unverified; unchanged-source gate CLEAN snapshot applies. Root refreshed the corrected schema mirror and compared
all 34 shared modules byte-for-byte (no mismatch). BOLT-HANDOFF is specification only, not provisioned.
Supplemental provider/ledger behavior test sources passed High source review; no transport fake, timeout, SQL, Auth, Deno or
live scenario ran. Default price/budget controls refuse live transport; USD 40 is a ceiling only, not supplied access.

## M7 — evaluation source, freeze and honest handoff (2026-10-27)

Separate Medium review 0902 requested four fixes; High correction 0895 resolved artifact-unit counting, boundary STOP,
explicit live names review and frozen-data binding. High review 0906 found a source-freeze binary fixture issue;
Extra High correction 0909 and separate Extra High review 0926 PASS. Byte-exact fixtures now use explicit indexed Git
attributes in a versioned raw/text source snapshot; no fixture is excluded and the N13 held-out text manifest is unchanged.
Known-set diagnostic labels preserve the original output reference; no first-run independence is inferred from an edition name.

Final root whole-tree static gate **CLEAN, exit 0**, 158 TypeScript files parsed, JSON/SCAN/boundary/import/frozen-baseline
checks passed; unchanged gate SHA-256 `837a78c4b1091ff1e0d4b25b1cd762fbf4241c351b765e129dd614caaed40dea`.
Source reviews and static syntax are the acceptance basis only. Oracle/evaluation/freeze/live-evidence regression sources exist
but have not run. Results remain not_run; no hidden data, oracle examples, admission receipt, evaluation tag, provider call or
measured result was created. Accepted for Dirty Mode construction — runtime unverified. See DEFERRED-VALIDATION.md for activation.

## REPO-S preservation (2026-10-28)

Static gate CLEAN, exit 0; gate SHA-256 `837a78c4b1091ff1e0d4b25b1cd762fbf4241c351b765e129dd614caaed40dea`. This check does not verify runtime behavior; the deferred checks and owner gates remain open.
