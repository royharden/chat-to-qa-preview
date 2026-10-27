# Import formats

Status: written in milestone M1 under Dirty Mode. The parser described here has **not been run**; every
behaviour below is the intended behaviour of `src/lib/adapters/`, checked only by reading and by the static gate.
Tests that exercise it exist under `tests/adapters/` and are deferred (see `DEFERRED-VALIDATION.md`).

Two input formats are accepted. Both produce the same canonical in-memory `ChatSessionV1`
(`src/lib/schema/chatSession.ts`): `{schema_version: "s47.chat.v1", turns: [{id, role, text}]}`, strict keys,
`role` in `user | assistant | tool | thinking`, ids regenerated `t1…tN` in document order. No title, file name,
assistant label, preamble or `<details>` text is ever part of a session.

## 1. Markdown profile `xexport-md/doc-2026-10`

### 1.1 Sources and pins

The profile is derived only from two local documentation sections. It is not derived from xexport's renderer or
template source, and no real export was read to build it.

| Source | Section | Lines at pin time | SHA-256 (LF-normalised section bytes) |
|---|---|---|---|
| `PJ-OD\C2M\C2M-XExport\README.md` | `## HTML layout` | 84–175 | `cf4dc0e8a01a19bd2e8b17df768d4cf9fc388c5b23137c3db90433660049fb72` |
| `PJ-OD\skills\skills-bts\xexport-read\SKILL.md` | `## Reading a Markdown export` | 214–225 | `8162af613a870bf4a78ad23b7c050a6d7eb9ebaba8875ade17950370dabaeed7` |

Pinned 2026-10-27 by 0814_Claude_Opus55_Sub_S47CodeM1. The README section hash is identical for the working-tree
file and for the committed blob at C2M-XExport commit `6c55d40` (the README had unrelated uncommitted edits
elsewhere at pin time). The SKILL.md file was clean at skills commit `e5c8fe1`.

**Section boundary rule.** Convert the whole file's CRLF line endings to LF. A section is the run of bytes that
starts at the first byte of its ATX heading line (`## HTML layout`, `## Reading a Markdown export`) and ends
immediately before the first later line that is an ATX heading (outside fenced code blocks) of the same or higher
level, that is, a line starting with one or two `#` followed by a space; or at end of file if there is none. The
section therefore includes its heading line, every line up to that next heading, and the LF that ends its last
line (including trailing blank lines). The hash is lowercase hex SHA-256 of those UTF-8 bytes, as printed by
`sha256sum`. Equivalent command used (Git Bash):

    tr -d '\r' < README.md | awk 'NR>=84 && NR<=175' | sha256sum
    tr -d '\r' < SKILL.md  | awk 'NR>=214 && NR<=225' | sha256sum

(No line between those heading pairs is a heading of any level, so the fence rule did not affect either cut.)
**Drift rule:** if either recomputed hash differs, the profile is stale. A changed layout means a new profile id
with new fixtures, never a guess. The re-check is listed in `DEFERRED-VALIDATION.md`.

What the profile takes from these sections: each message starts at a heading such as `## 👤 User` or
`## 🤖 Claude`; a bare `^## ` also matches headings inside answers; the last line is an HTML comment beginning
`<!-- xexport-cursor`, which is xexport's record, not conversation; long tool output may be truncated in the
Markdown form. An HTML export is a folder of `index.html`, `page-NNN.html`, `full.html` and `pages.json`, which this
app refuses (`html_export`, export with `--format md` instead).

### 1.2 Parse order

Implemented in `src/lib/adapters/xexportMd.ts`, in this order; the first failing check refuses the whole file.

| Step | Rule | Refusal |
|---|---|---|
| 0 | Raw byte length above 5 MiB (5,242,880 bytes), checked before decoding to bound all later work. | `oversize_file` |
| 1 | Strict UTF-8 decode (any invalid sequence refuses). One leading BOM is removed with warning `bom_removed`. CRLF becomes LF. Then any remaining CR (a lone CR) or any control character other than tab and LF (U+0000–U+0008, U+000B–U+001F, U+007F–U+009F) refuses. | `bad_encoding_or_control_chars` |
| 1b | Text that starts, after whitespace, with `<!doctype html` or `<html` is an HTML export. | `html_export` |
| 2 | The final non-blank line, if it begins `<!-- xexport-cursor`, is removed (with any blank lines after it). Absent: warning `missing_cursor_line`, not a refusal. | — |
| 3 | Fenced code blocks are marked over the whole document: a line with up to 3 spaces then 3+ backticks or 3+ tildes opens a fence (a backtick info string may not contain a backtick); it closes at a line with up to 3 spaces, the same character repeated at least as many times, and only spaces/tabs after. A fence never closed refuses. Fence content is never a heading, a details marker or an HTML block. | `unbalanced_fence` |
| 4 | Outside fences, `<details>` regions are marked. A region opens only at a line starting (up to 3 spaces) with `<details` followed by whitespace, `>` or end of line. Inside an open region, any further `<details` (anywhere on a line) is nesting; a `</details>` anywhere on a region line closes it; an opening line that also holds one closing tag is a one-line region. A `</details>` at a line start with no open region, two opening or two closing tags on one line, or a region still open at end of file refuses. Fence lines inside an open region belong to the region. Mid-line mentions outside a region are text. | `nested_or_unbalanced_details` |
| 5 | Outside fences and details: a line exactly `## 👤 User` (optional trailing spaces/tabs) starts a user turn; a line `## 🤖 ` followed by a 1–80 character label starts an assistant turn (label discarded). Exactly one space after `##` and after the emoji. The heading line is not part of the turn. More than 2,000 turns refuses. | `too_many_turns` |
| 5 / K19 | After the first accepted heading, outside fences and details: a line with up to 3 leading spaces, `##`, spaces/tabs, then an Extended_Pictographic character, that is not exactly an accepted heading, refuses. This covers `## 🔧 Tool`, `## 👤User`, `##  👤 User`, `## 👤 user`, `## 🤖` without a label and `## 🤖x`. A plain `## Heading` without an emoji is turn content. | `unknown_role_heading` |
| 5 / K19 | After the first accepted heading, outside fences and details: a line whose first non-space characters (at most 3 spaces) start a CommonMark HTML block refuses. Start conditions: (1) `<script`, `<pre`, `<style`, `<textarea`; (2) `<!--`; (3) `<?`; (4) `<!` plus a letter; (5) `<![CDATA[`; (6) `<` or `</` plus a block tag name (CommonMark 0.31.2 list plus `source`); (7) a complete open or closing tag followed only by whitespace. Mid-line tags remain text. | `raw_html_outside_details` |
| 6 | Lines before the first accepted heading are the preamble: kept only in `ImportReview.preamble` (to be shown escaped) and dropped from the session. Role-like headings and raw HTML in the preamble are not refused. | — |
| 7 | `<details>` regions inside turns are kept only in `ImportReview.turns[i].droppedDetails` (to be shown escaped) and dropped from the turn text. | — |
| after | No accepted heading at all. | `no_role_heading` |
| after | Turn text (leading and trailing blank lines removed) longer than 100,000 UTF-16 code units. | `turn_too_long` |
| after | Sum of all turn texts longer than 4,000,000 UTF-16 code units. | `total_too_long` |
| after | No user turn and assistant turn that both contain a non-whitespace character. | `no_user_or_assistant` |

Steps 5–7 run as one pass over lines already classified by steps 3–4; steps 6 and 7 only decide where an
already-classified line goes, so the single pass is equivalent to running them in order.

Conservative choices made in M1 (each refuses more, never less, than the plan's literal wording):

- The role-like heading check also covers lines indented 1–3 spaces (CommonMark still renders those as headings).
- A `<summary>` line outside any `<details>` region is a raw HTML block (condition 6) and refuses; `<summary>`
  lines inside a region are part of the region.
- Condition 7 also refuses a lone `</script>`-style closing tag line, and the block tag list keeps `source`.
- An unbalanced `<details>` in the preamble refuses, because details are marked over the whole document before the
  preamble boundary is known.

Named limits (not refusals): tool output that is not wrapped in `<details>` is assistant text (the import review
recommends exporting with `--brief`); speaker headings are unauthenticated, so a convincing forged heading in the
right shape is accepted as a turn boundary; the assistant label is never interpreted.

## 2. JSON format `s47.chat.v1`

S47's own canonical JSON (`ChatSessionV1Json`), not a native xexport format:

    {"schema_version": "s47.chat.v1", "title": "<optional, discarded>",
     "turns": [{"id": "<1-64 chars [A-Za-z0-9_.:-], first alphanumeric>", "role": "user|assistant|tool|thinking", "text": "..."}]}

Order in `src/lib/adapters/chatSessionJson.ts`: size (`oversize_file`) → strict UTF-8 and BOM warning
(`bad_encoding_or_control_chars`) → HTML document (`html_export`) → `JSON.parse` and the strict shape, including
unknown keys, unknown roles, wrong `schema_version` or unsafe ids (`unknown_json_shape`) → more than 2,000 turns
(`too_many_turns`) → repeated wire id (`duplicate_turn_id`) → per turn: CRLF to LF, then any control character,
lone CR or unpaired surrogate escape (`bad_encoding_or_control_chars`) → per-turn length (`turn_too_long`) → total
length (`total_too_long`) → a non-empty user and assistant turn (`no_user_or_assistant`). `title` and wire ids are
never copied. `<details>` has no special meaning in JSON: the explicit `tool` and `thinking` roles are the
supported exclusion route. Malformed or BOM-prefixed JSON fixtures use a non-`.json` extension (`.json.txt`).

## 3. Adapter routing

`importChatFile(bytes, fileName?)` in `src/lib/adapters/index.ts`: size cap first; `.html`/`.htm` →
`html_export`; `.json` → JSON adapter; no `.md`/`.markdown` extension and the first significant byte is `{` →
JSON adapter; otherwise the Markdown adapter. The file name is only used for this choice; it is never stored,
shown in an artefact or hashed.

## 4. Refusal table

Each code is defined once, in `src/lib/adapters/refusals.ts`, and has exactly one fixture.

| Code | Format | Fixture |
|---|---|---|
| `no_role_heading` | md | `fixtures/refusals/no_role_heading.md` |
| `html_export` | md, json, by name | `fixtures/refusals/html_export.html` |
| `unbalanced_fence` | md | `fixtures/refusals/unbalanced_fence.md` |
| `nested_or_unbalanced_details` | md | `fixtures/refusals/nested_or_unbalanced_details.md` |
| `oversize_file` | md, json | `fixtures/refusals/oversize_file.recipe.json` (expanded at test time, >5 MiB) |
| `too_many_turns` | md, json | `fixtures/refusals/too_many_turns.recipe.json` (2,002 turns) |
| `turn_too_long` | md, json | `fixtures/refusals/turn_too_long.recipe.json` (one 100,010-unit turn) |
| `total_too_long` | md, json | `fixtures/refusals/total_too_long.recipe.json` (45 × 90,000 units, under 5 MiB) |
| `unknown_role_heading` | md | `fixtures/refusals/unknown_role_heading.md` |
| `raw_html_outside_details` | md | `fixtures/refusals/raw_html_outside_details.md` |
| `bad_encoding_or_control_chars` | md, json | `fixtures/refusals/bad_encoding_or_control_chars.md` (invalid UTF-8 byte) |
| `unknown_json_shape` | json | `fixtures/refusals/unknown_json_shape.json` (extra top-level key) |
| `duplicate_turn_id` | json | `fixtures/refusals/duplicate_turn_id.json` |
| `no_user_or_assistant` | md, json | `fixtures/refusals/no_user_or_assistant.json` (user + tool + thinking only) |

Recipe format (`s47-fixture-recipe/1`): `{recipe, code, fileName, provenance, parts}` where each part is
`{text, times?}` or `{parts, times?}`; parts are concatenated in order (`tests/adapters/recipes.ts`). Refusal and
CRLF fixtures are byte-exact: `.gitattributes` marks them `-text` so `core.autocrlf` cannot change them.
