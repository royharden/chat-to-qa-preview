# Redaction rules — construction only

Version `s47.redact.v1`. Runtime and property checks are unexecuted while Dirty Mode is active. This is not a privacy guarantee.

Fresh rules implement the plan's rule ideas; gitleaks and pi-share-redacted-gist (MIT) are conceptual references only. No source was
ported. Upstream revision and licence-header inspection is deferred before any literal port; no AGPL/GPL implementation is used.

| Family / tier | Rule ids | Source tests |
| --- | --- | --- |
| Secrets / high | S_AWS_ID, S_PROVIDER (GitHub, OpenAI-shaped, Slack variants), S_JWT, S_PEM, S_PEM_HEADER, S_AUTH (Bearer and Basic), S_CONNECTION, S_USERINFO, S_QUERY, S_ASSIGNMENT (including AWS secret), S_ENTROPY | rules.test.ts; engine.test.ts placement cases |
| Contact / medium | C_EMAIL, C_PHONE | rules.test.ts |
| Network / medium | N_IPV4, N_IPV6, N_INTERNAL, N_SINGLE_HOST | rules.test.ts |
| People and places / medium | P_HOME (Windows and Unix), P_HANDLE, P_DENY, P_SIGNATURE, P_HEADER, P_EMAIL_NAME, P_GIT_NAME | rules.test.ts |
| Ids / low | I_UUID | rules.test.ts |
| Explicit manual / high | M_MANUAL; M_INVALID_SPAN refuses | engine.test.ts |
| Verification / blocking | V_VERSION_OR_SHAPE, V_TURN, V_EMPTY, V_UNITS, V_TEXT, V_PLACEHOLDER_ESCAPE, V_PLACEHOLDER_KIND | engine.test.ts |

All definite findings are replaced irrespective of tier. Entropy uses a candidate of 20–4096 ASCII token characters, Shannon
entropy at least 4 bits/character, a letter and a digit or token punctuation. An otherwise uncovered candidate blocks; only an
explicit manual span covering it entirely resolves it. No mark-safe operation exists. Empty deny-list review belongs to the state
machine, not an implicit detector exemption. Deny-list matching is literal, ASCII-case-insensitive and accepts no regex.

Overlaps sort by high → medium → low, longer span first, earliest offset then rule id. Greedy disjoint selections are emitted in
source order. Manual ranges union with overlapping selected ranges so none of an explicit manual selection survives. Input spans
use UTF-16 half-open offsets into unchanged pass text; manual spans must not cut a surrogate pair.

Decoy rules D_VERSION_IP, D_DOTTED_VERSION, D_GIT_SHA, D_SEMVER, D_LINE_COL and D_BASE64_CONTEXT are local context checks only.
Version/build prefixes and >4 dotted parts suppress IPv4 interpretation; explicitly labelled commit/git/sha hex suppresses entropy.
Semver and line:column are non-secret contexts. Explicit base64/data context suppresses entropy only when decoded text consists of
printable natural-language letters and spaces and contains a space. Paths and URL queries receive no decoy exemption. Reserved
fixture ranges have no detector exemption.

Web Crypto supplies a fresh 96-bit namespace per redaction. Input namespaced placeholders and literal bracketed placeholders are
escaped with same-length Unicode brackets before replacement. Generated namespaced forms exist only during the engine pass;
returned text is rendered `[KIND_n]`. The per-session `placeholders` array tracks generated labels, separately from escaped input.
No restoration map, raw text or raw hash is retained by redactkit. Escaped/forged forms are visible but block artifact scanning.

`redactSession` and `manualRedact` return either a frozen branded session or `{ok:false, findings}` with no text payload. A residual
post-replacement detector finding blocks sealing. `isRedactedSession` checks engine WeakSet identity; cloned objects fail. Brand
symbols are private and cannot be imported. Successful turns contain only included user/assistant turns.

`source_revision` is the first 16 hex characters of Web Crypto SHA-256 over canonical JSON with keys `rules_version`, then `turns`,
whose rows have `id`, `role`, `text`. Text is the rendered form. Consequently random namespaces do not affect revision. A content
change changes revision; identical rendered sources intentionally keep the same revision. Every downstream span indexes exactly
this rendered text (N10).

`verifyRedacted(turns, rulesVersion)` checks version, caps, roles, ids, text, escaped/namespaced forms and generated kind vocabulary,
re-runs detectors without re-escaping rendered labels, then recomputes the rendered revision (N11). A rendered label contains no
restorable value. A remote text-only verifier cannot prove the provenance of an identical literal label; local engine provenance
uses WeakSet identity and input literals are escaped. Verification does not bypass role/import/deny-list confirmation: those are
state preconditions. Artifact scanning must call `detect(text, {denyList})` for every public field, decoded string and full bytes,
and `scanPlaceholderEscapes(text)`; both expose findings arrays. All findings block public bytes, including non-ambiguous ones.

Expected misses remain: prose names outside patterns/deny-list, mid-token splits, novel unprefixed tokens below threshold,
unauthenticated speaker headings and unwrapped tool output. No NER is claimed. Rules scan code, stack traces and textual details
when supplied; adapters independently exclude details from model/candidate views.

Deferred commands after Dirty Mode closes: `npx vitest run tests/redactkit`; `npx tsc --noEmit`. No tests or product code executed
for this construction milestone.

Detectors also decode exactly one JSON-escape layer with a per-code-unit origin map; findings and replacements retain original UTF-16 offsets. Embedded Unicode-escaped identifiers cannot evade the literal scan merely by escaping their provider prefix. Source tests cover that mapped replacement.
