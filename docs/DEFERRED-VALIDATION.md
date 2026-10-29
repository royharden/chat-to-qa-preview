# Deferred validation

This repository is being built in **Dirty Mode** (Roy, 2026-10-27, S47 only): static checks only. Nothing listed
here has run. Each item says what is deferred, why, and the exact command to run once installs and test execution
are authorised. Append-only; newest milestone last.

## Plan-level items (recorded at M1)

| What | Why deferred | Later command / action |
|---|---|---|
| Vendoring S37 `factledger` as an alternative to the fresh `spanground` extractor (K1) | Its gate requires running the vendored tests | Only if chosen later: vendor, then `npx vitest run tests/spanground` |
| CI workflow (K15) | Dirty Mode forbids CI scaffolding as completion work | Add a workflow running `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run scan-tracked` |
| Licence-header check at a pinned revision before any literal port of gitleaks / pi-share-redacted-gist rule text (D9) | Needs network | Fetch the pinned revision, record the licence header in `docs/RULES.md` (M3) |

## M1 — scaffold, schema, adapters, frozen baselines

| What | Why deferred | Later command |
|---|---|---|
| Install declared dependencies and create the lockfile. Versions in `package.json` were written from memory and are unverified. | No installs in Dirty Mode; no lockfile until installs are authorised | `npm view <package>@<range> version` for each entry, then `npm install` |
| Type check of `src/`, `tests/`, `vite.config.ts` (strict, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax`) | Needs `typescript` installed | `npm run typecheck` |
| Adapter tests: every D10 step, K19 rule, refusal fixture and recipe, schema caps, JSON adapter, routing, views | Test execution forbidden | `npx vitest run tests/adapters` |
| Baseline tests: K20 rule list and detections, R0 identity, FREEZE.json hashes, static import-graph reachability | Test execution forbidden | `npx vitest run tests/baselines` |
| Production build of the placeholder entry | Builds forbidden | `npm run build` |
| Placeholder page renders | No dev server or browser | `npm run dev`, open `http://127.0.0.1:5173`, expect the M1 placeholder text |
| ESLint configuration and a `lint` script (eslint is declared, no config yet) | Config not in M1 scope; nothing can run | Add `eslint.config.js` (typescript-eslint strict), add `"lint": "eslint ."`, run `npm run lint` |
| `\p{Extended_Pictographic}` and regex lookbehind support in the target browsers and Deno | Runtime check | Covered by `npx vitest run tests/adapters`; browser smoke test at M5 |
| Worst-case adapter time on 5 MiB inputs (bounded-work claim) | Runtime measurement | `npx vitest run tests/adapters/refusals.test.ts` (the recipes expand to the caps); add a timing assertion if slow |
| Pinned documentation section hashes still match (drift check) | Static, re-run when the profile is reviewed | `tr -d '\r' < "<PJ-OD>/C2M/C2M-XExport/README.md" \| awk 'NR>=84 && NR<=175' \| sha256sum` and `tr -d '\r' < "<PJ-OD>/skills/skills-bts/xexport-read/SKILL.md" \| awk 'NR>=214 && NR<=225' \| sha256sum` (adjust line numbers by the boundary rule in `docs/FORMAT.md` if headings moved), compare with `docs/FORMAT.md` |
| `package.json` scripts that name files from later milestones (`scan-tracked`, `admit-data` in M2; `sync-function-lib` in M6; `eval`, `freeze`, `demo` in M7) | Files do not exist yet | Each runs as `node scripts/<name>.ts` once its milestone lands |
| Content-Security-Policy for `index.html` (no remote images, no inline script outside Vite's dev preamble) | Needs a dev-server check so the policy does not break Vite; decided with the UI | M5: add the meta policy, verify with `npm run dev` and `npm run build && npm run preview` |

## M2–M7 source construction — all execution deferred

| Component / assumption | Why deferred | Later command or activation check |
|---|---|---|
| Fixture determinism, recipes/JSON twins, label offsets, admission floors and working/index/untracked scan | Dirty Mode forbids tests/product script execution | `npx vitest run tests/fixtures`; `node scripts/scan-tracked.ts .`; `node scripts/admit-data.ts --dev-manifest fixtures/dev/MANIFEST.json --tracked-root . --builders <complete-builder-lineage>` (expected NO_GO without independent appointment) |
| Redaction rules, same-length forged-placeholder escapes, JSON escape offset mapping, entropy/manual spans, private brands | Runtime tests forbidden | `npx vitest run tests/redactkit` including every placement trap/property case |
| UTF-16 spans, sentence/code split, lexical tokens, K6 ties and caps, expected semantic misses | Tests forbidden | `npx vitest run tests/spans tests/spanground tests/select tests/mutators` |
| Exact allowlist bytes, full decoded-field rescans, 8,000-unit excerpts, stale operations, durable approval and download | Test/browser execution forbidden | `npx vitest run tests/artifact tests/state tests/rulings`; browser role/name-confirmation→redaction→edit→both-previews→approval→download walkthrough; deny IndexedDB and confirm fail-closed behavior; compare SHA-256 of both downloaded files |
| JSX/React rendering, CSP, responsive layout and no active image/link/HTML content | No browser or server | After agent-ports allocation, `npm run dev -- --host 127.0.0.1 --port <claimed-port>`; later `npm run build`; exercise malformed imports/list HTML and inspect console/network |
| Provider body caps, private request brand, prices/upper-bound reservation, timeout/unknown-usage handling and cumulative locked CLI ledger | No tests or live calls | `npx vitest run tests/providers tests/callledger tests/function`; verify prices from official source and pin provider/model only after Roy supplies access; no retry and no spend above total USD 40 |
| Deno copies/import map, verified JWT/operator gate, request bounds, no-text ledger | No Deno execution/backend | `node scripts/sync-function-lib.ts .`; compare mirrors; `deno check --config supabase/functions/propose-qa/deno.json supabase/functions/propose-qa/index.ts`; isolated unauthenticated/non-operator/verified-operator scenarios |
| SQL migration/RLS and concurrent budget reservation | No DB/Docker | On an authorized isolated target apply 0001→0002→0003; prove anonymous/browser mutation denied, concurrent cap cannot overspend, duplicate IDs refuse, timeout retains reservation, settle cannot exceed reservation; never start Docker merely for this record |
| Leak oracle, partial windows, controlled/end-to-end/model/simulated tracks, per-unit aggregation, fail-closed admission and freeze | No test/eval execution | `npx vitest run tests/leakeval tests/evalkit`; `npm run eval -- --mock --out results/run-dev-001`; inspect every named miss/NA; `npm run freeze` creates source snapshot only, no tag |
| Live diagnostic CLI evidence and price gates | Dirty Mode + Roy key/model gates | After all offline checks pass, create human-reviewed pinned execution evidence; invoke `node scripts/live-eval.ts` with documented explicit paths/identity, notice confirmation and cumulative ledger outside repo; no credentials are supplied/read during construction |
| Independent admission, oracle examples and first held-out edition | Roy-R2/R6 unresolved; builder lineage prohibited | Roy appoints independent custodian; follow CUSTODIAN-PACKET and EVALUATION, bind all LF-normalized hashes, keep original run immutable; no held-out numbers or eval-freeze-v1 tag before admission/offline gates |
| Publication / infrastructure | Roy-R5 and Dirty Mode | Review BOLT-HANDOFF; no remote, push, import, deployment or provider setup performed |

No dependency version has been verified, lockfile installed, typecheck run, test executed, build made, browser opened or backend provisioned.
Static source acceptance is not product/runtime acceptance.
