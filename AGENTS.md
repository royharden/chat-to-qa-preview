# Agent rules for this repository

Product repo for S47 chat-to-qa-preview (local git, no remote). The plan of record and run records live in the
outer shell folder (`..\PLAN.md`, `..\planning\`, `..\agentops\`), not here.

## Data

- Synthetic data only. Never commit a real chat export, a real transcript, an agent log, a materialised fixture
  session or any key, token or credential. Never read or copy from any `.chatexports` folder.
- Secret-shaped test inputs (provider tokens, JWTs, PEM blocks, bearer tokens) are built at runtime by
  concatenating parts or by the seeded generator. Fixtures use typed slots, never literal values.
- Never read, list or write the outer shell's `custody\` folder. Held-out data and labels are authored only by the
  custodian Roy appoints, never by the builder lineage. Tools that check held-out material take its paths as
  command-line arguments.

## Code

- TypeScript strict, erasable syntax only (no `enum`, `namespace`, parameter properties, `import x = require`,
  `export =`, `<T>x` assertions). `import type` for type-only imports. Every relative import uses an explicit
  `.ts`/`.tsx` extension.
- `src/lib/baselines/` (R0, R1) is evaluator-only: import it only from `src/lib/leakeval/` and `scripts/eval.ts`.
  Its files are frozen; `src/lib/baselines/FREEZE.json` holds their SHA-256 and must keep matching.
- Network APIs appear in `src/` only in `src/lib/providers/{anthropic,openaiCompatible}.ts` and
  `src/lib/live/client.ts`. No raw HTML injection in UI code. No secret ever gets a `VITE_` prefix.
- Text files are LF (`.gitattributes`); byte-exact fixtures are `-text`.

## Checks

- Before every commit run the static gate from the outer shell:
  `bash ../agentops/static-gate.sh` (exit 0 = clean). Record its printed sha256 in `docs/VALIDATION.md`.
- While Dirty Mode is active, nothing is installed, tested, built or run; record each deferred check with its exact
  later command in `docs/DEFERRED-VALIDATION.md`.
- Do not claim privacy, safety or measured results anywhere unless they come from `results/results.md`.
