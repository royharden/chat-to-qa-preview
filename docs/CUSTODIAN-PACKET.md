# Independent author packet — specification only

Admission status: PENDING; Roy-R2 appointment and Roy-R6 ordering decision unresolved.
No independent data, label or GO receipt is included. This packet contains no example session, identifier value or label.
Author from this specification alone; do not inspect src/ or builder templates before independent authorship is finished.

## Independence and exclusions

The custodian must be appointed by Roy, be outside S47-INT and all builder-subagent lineage, and use a different model family if an agent.
Do not derive data from QAConv, DevGPT, Slack corpora, real chat exports, agent logs or any .chatexports path.
No personal, secret or operational identifier may appear. All prose is newly authored synthetic material.
The builder lineage must neither author held-out material nor read/write custody/heldout.
After authoring, independently check no shared template text or literal value with development data; exact hash comparisons alone are insufficient.
Construction began before appointment under Dirty Mode. This ordering exception needs Roy-R6 confirmation; it does not establish independence.

## Session format

Use documented Markdown role headings only: exact User marker or Assistant marker, with the documented emoji and single spaces.
Twelve to sixty turns per template, including a dead end, a superseded answer and a tool-looking details block.
Only user/assistant turns may supply candidate text. Balanced details blocks are excluded.
A preamble must carry author and synthetic provenance with independent-heldout lineage.
Provide canonical JSON twins with schema_version s47.chat.v1 and t1..tN ids, no title or other metadata.
One session rendered in two formats remains one statistical unit. No HTML adapter.

## Slot inventory and reserved ranges

Use typed double-brace slots with a kind and lowercase unique id separated by a colon. Repeated ids denote the same identifier.
Kinds: EMAIL, PHONE, GH_PAT, AWS_KEY_ID, AWS_SECRET, OPENAI_KEY, SLACK_TOKEN, JWT, PEM_BLOCK, BEARER, BASIC_AUTH_URL,
TOKEN_QUERY_URL, CONN_STRING, INTERNAL_HOST, IPV4, IPV6, WIN_HOME, UNIX_HOME, HANDLE, SIG_NAME, PROSE_NAME, UUID, HIGH_ENTROPY.
Decoys: GIT_SHA, SEMVER, IP_LIKE_VERSION, LINE_COL, BASE64_DECOY.
Never materialise secret-shaped strings into a tracked file. Generate these only at runtime.
Non-secret literals must use RFC 2606 reserved domains, invalid/test/example domains, documentation or private IPv4,
RFC 3849 IPv6, the reserved fictional North American phone block, explicitly synthetic names and home-path usernames.
Internal hosts may use internal/local/home.arpa or single-label forms; corp/lan cases remain runtime-only unit inputs.
Decoy context is not an exemption from detectors.

## Labels and coverage

Each template and label file carries author, provenance and lineage.
Label object fields: author string; provenance synthetic; lineage independent-heldout; gold_question exact turn/text pointer;
controlled_targets array of exactly two objects; decoys array of slot ids; abstain_ok boolean; traps array of named placements.
Each target has unique id, one or more exact turn/text span specifications, slot_ids and three to six distinct anchors.
Reference slot ids rather than raw identifier values. Resolve exact text at materialisation to UTF-16 half-open offsets.
Every planted slot is labelled, every target's claimed identifiers and anchors occur in its spans, and no ambiguous span is accepted.
Question text must be an exact user-turn span; target spans must be user/assistant only.
Recommend eight independently authored templates with three seeds; final independent edition size is the custodian's decision.
For every high/medium class per split: at least twenty distinct planted ids across at least eight sessions,
with at least ten instances in controlled targets. UUID and every hard trap each require at least ten instances.
Every family has at least thirty planted instances inside controlled targets. Report cells below ten as counts only.
Hard-trap labels required by preflight: superseded_answer, dead_end, excluded_tool_details, target_inline.
Add preregistered additional placements and review their actual text rather than trusting labels.
Author tiny oracle examples separately; builder lineage must not supply them.

## Delivery and receipt

Keep templates, materialised sessions, labels and oracle examples separate. Supply their paths explicitly to admission/evaluation.
Do not place an admission receipt before the independent checks pass. Tool output is a preflight report, never approval.
Receipt path is data/admission-receipt.json, written only by the custodian.
Receipt fields: decision GO or NO_GO; custodian; custodian_model_family; builder; heldout_templates_sha256;
heldout_materialised_sha256; heldout_labels_sha256; oracle_examples_sha256; dev_templates_sha256; checked_at;
checks array with id, passed boolean and note.

GO requires every required check true: independent authorship, provenance on every file, reserved literals, no tracked or
custody file containing materialised SCAN matches, complete labels, coverage floors, disjoint templates and literals,
and no prohibited corpus derivation. Materialised untracked secret surfaces must remain outside tracked files.
Verify actual materialised set matches its recipes and exact label spans, and independently review oracle tiny examples.
The preflight deliberately keeps human authorship review false. Human attestation and receipt are the custodian's responsibility.
For each templates/materialised/labels set, digest is SHA-256 of UTF-8-bytewise sorted relative-path lines,
each line comprising SHA-256 of LF-normalised file bytes, two spaces, relative slash path and LF.
Use shared manifestHash.ts for both admission and held-out evaluation.
A mismatch or NO_GO skips evaluation; it must never be converted into a result. Record the first run as the run of record.
High-tier held-out leaks block a ready-for-self-owned-input release. Report unfavourable outcomes and each named miss.
No privacy guarantee and no performance number are established by construction.
