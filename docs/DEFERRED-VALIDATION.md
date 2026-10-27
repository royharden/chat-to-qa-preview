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
