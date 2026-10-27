# specification only / not provisioned

Source construction only; no installs, builds, tests, SQL, function checks or deployment have run.
Target: Bolt Database, fresh project assumed, owner selection and actual baseline inspection pending.
Do not replace an existing connection. No project URL, project id, account binding or hosted resource exists in this handoff.

## Inventory and readiness

React/Vite frontend; optional lazy Supabase client; propose-qa function (verified user JWT, confirmed operator email allowlist).
SQL order: 0001_call_ledger.sql, 0002_budget.sql, 0003_rls.sql.
Only call_ledger and budget metadata persist. No text storage, upload bucket, Realtime, cron, worker or webhook.
Server budget cap is zero and status disabled. Browser roles cannot read/mutate tables or call budget RPCs.
Atomic row locks reserve and settle; duplicate request ids refuse; timeout/unknown usage consume the full reservation.
Price table is empty/unverified; model allowlist is a specification, not approved pricing or live authorization.
All live calls refuse before transport until reviewed prices and Roy grants exist. No retries.

Provider API keys/server role: server secrets only. Function names: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
ANTHROPIC_API_KEY, OPERATOR_EMAILS, ALLOWED_ORIGINS. Client config names: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
No secret values are included. Owner must configure actual Auth sign-in, email confirmation, Site URL and redirect allowlist.
The live client needs an explicitly supplied authenticated access token; it never stores a session.
ALLOWED_ORIGINS is an exact comma-separated browser-origin allowlist; CORS does not authenticate callers.
Gateway JWT checking stays enabled; function also verifies through Auth getUser and requires a confirmed allowlisted user.

CLI-only funded proposal requires S47_ANTHROPIC_API_KEY and S47_CLI_CAP_USD, plus explicit provider-send confirmation.
The CLI ledger must be outside the tracked repo; cumulative cap across invocations uses an exclusive lock.
It is a local guard, not a server-enforced cap. Server cap remains separately zero, so it cannot jointly spend a CLI grant.
Roy approved a USD 40 total ceiling only; access/provider/model remain pending. Cap absent/zero refuses and cap above forty refuses.

## Deferred validation

After Dirty Mode closes: authorised dependency install/lockfile; npm run typecheck; npm test; npm run build;
node scripts/sync-function-lib.ts .; deno check --config supabase/functions/propose-qa/deno.json supabase/functions/propose-qa/index.ts.
Then compare shared module bytes, apply SQL in an isolated authorised database, test anonymous/two-user isolation,
duplicate/concurrent reserve, zero-budget refusal, Auth verification, malformed/redaction/hash refusals and settlement timeout.
Only after Roy approves credentials, model/prices and spend: one explicitly confirmed bounded live check.
No readiness claim follows from these unexecuted commands.

## Inspection/preparation prompt

Inspect this app and BOLT-HANDOFF.md only. Preserve existing connections and first report the selected provider,
migration baseline, runtime/dependency compatibility and concrete deployment gaps. Do not provision, deploy, publish,
enter secrets, activate budget rows, edit verified prices or call any model. Explain owner steps and exact pending checks.
Source includes function and migrations, but deployment and all runtime behavior remain unverified.

