# Synthetic development fixtures

Status: source constructed; runtime unverified. Admission is PENDING. Roy-R7 confirmation of builder-dev labels remains pending.
The fixtures are synthetic recipes, never real transcripts. Builder-dev results cannot establish independent evaluation.
There are ten authored templates with two deterministic seeds each: twenty sessions, not forty observations when both formats are emitted.
Every template has twelve turns, a dead end, an expressly superseded answer and an excluded tool-looking details block.

## API and storage

generate(template, seed) materialises typed slots in memory and returns markdown, json, session and slots.
The JSON twin uses schema_version s47.chat.v1, regenerated t1..tN ids and user/assistant roles.
Metadata is a Markdown preamble and never enters canonical JSON. Balanced details blocks are omitted from both canonical turns and the adapter's candidate view.
No function writes materialised values to disk. Never commit materialised Markdown/JSON or the returned slots array.
Tests must materialise in memory. No Math.random or external dependency is used for generation.

Slots use double-brace KIND:id syntax. An id starts with a lowercase letter and contains lowercase letters, digits, underscores or hyphens.
Repeated ids reuse a value; reuse with a different kind is refused. Unknown or malformed slots are refused.
Kinds: EMAIL, PHONE, GH_PAT, AWS_KEY_ID, AWS_SECRET, OPENAI_KEY, SLACK_TOKEN, JWT, PEM_BLOCK, BEARER,
BASIC_AUTH_URL, TOKEN_QUERY_URL, CONN_STRING, INTERNAL_HOST, IPV4, IPV6, WIN_HOME, UNIX_HOME, HANDLE,
SIG_NAME, PROSE_NAME, UUID, HIGH_ENTROPY. Decoys: GIT_SHA, SEMVER, IP_LIKE_VERSION, LINE_COL, BASE64_DECOY.
These are test identifiers, never operational credentials. Generator secret-shaped values exist only at runtime.

Non-secret identities use synthetic Fixture names, invalid-domain URLs/email, documentation IPv4, documentation IPv6,
the reserved fictional phone block and synthetic home segments. Internal names use the declared internal, local or home.arpa cases.
Detector coverage for corp/lan cases belongs to runtime-built unit inputs, never real hostnames. Reserved ranges receive no detector exemption.

## Labels and manifest

MANIFEST.json has edition, author, provenance, lineage, roy_r7 and entries. Each entry has id, template, labels and seeds;
paths are relative to the manifest parent. Admission rejects traversal, absolute entries, duplicate ids and duplicate seeds.
Template header Author must match manifest and label author; Provenance must say synthetic and the declared lineage.
Labels contain author, provenance, lineage, gold_question, controlled_targets, decoys, abstain_ok and traps.
gold_question is a turn_id plus exact template text. Each of exactly two controlled_targets contains an id, spans (turn_id/text),
slot_ids and three to six distinct literal anchors. Every non-decoy slot must belong to a target; decoys name the remaining ids.
No label stores a materialised value. materialiseLabels replaces template slots in memory, resolves unique exact spans to UTF-16
half-open offsets and refuses missing/ambiguous spans, unlabelled ids, missing anchors or a target not containing its claimed slot.
Target text and question spans refer only to user/assistant turns after details exclusion.

The required hard-trap vocabulary is superseded_answer, dead_end, excluded_tool_details and target_inline.
Additional trap names may be supplied by the custodian; they need explicit preregistration before a claim.

## Hashing and admission

manifestHash entries are sorted by relative path's UTF-8 bytes, with slash separators. Each LF-normalised UTF-8 file is hashed,
then contributes its digest, two spaces, relative path and LF. The SHA-256 of that manifest text is the set digest.
normaliseLf replaces CRLF and lone CR with LF and rejects invalid UTF-8. Empty sets, duplicate/unsafe paths and symlinks are refused.
The same src/lib/fixtures/manifestHash.ts implementation must be used by admission and evaluation.

scripts/admit-data.ts is a read-only preflight, not a custodian. It accepts explicit paths, reports hashes/checks without raw text,
and always emits NO_GO while the required human provenance review is pending. It never writes data/admission-receipt.json.
Only the independent custodian appointed by Roy can write that receipt after all automated checks and human attestations pass.
Missing independent data yields an explicit pending check, never inferred GO.
Automated checks include provenance, counts, slot/anchor/span completeness, reserved generator ranges, working/index SCAN,
class/family/trap floors and exact template/literal disjointness. Exact hashes cannot detect copied/paraphrased template fragments:
the custodian must review that independently. A different model family is required for an agent custodian.
Materialised-set hashes bind the exact supplied set; a hash alone is not proof that its contents match recipes or labels.
Custodian must verify set equality and label positions against the materialised bytes before GO.

## Deferred commands

After Dirty Mode closes and dependencies are authorised:
- npm test -- tests/fixtures
- node scripts/scan-tracked.ts .
- node scripts/admit-data.ts --dev-manifest fixtures/dev/MANIFEST.json --tracked-root . --builders <comma-separated-builder-lineage>
- Independent operator adds --heldout-manifest, --custodian, --custodian-model-family, --builder-model-family,
  --templates, --materialised, --labels and --oracle-examples explicit arguments when appointed.

The last command is a report, never the receipt. Never run it on private data from builder lineage.
No check listed here has executed during construction.
