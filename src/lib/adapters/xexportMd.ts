// Import profile `xexport-md/doc-2026-10` (PLAN-FINAL D10 + K19; caps K4). Full rules: docs/FORMAT.md.
//
// Order (each step runs on the result of the previous one; the first failing check refuses):
//   0. size cap on raw bytes (bounds all later work)                         -> oversize_file
//   1. strict UTF-8 decode; drop one leading BOM (warning); CRLF -> LF;
//      then any remaining CR or control character other than tab/LF          -> bad_encoding_or_control_chars
//      1b. an HTML document (doctype / <html>)                               -> html_export
//   2. strip a final line beginning `<!-- xexport-cursor` (absent -> warning)
//   3. mark fenced code blocks, ``` or ~~~ (never closed                       -> unbalanced_fence)
//   4. outside fences, mark <details>...</details> regions (nested / open / stray close -> nested_or_unbalanced_details)
//   5. outside fences and details: role headings start turns; after the first accepted heading K19 refuses
//      emoji-role look-alike headings (-> unknown_role_heading) and raw HTML block starts (-> raw_html_outside_details);
//      more than 2,000 turns                                                 -> too_many_turns
//   6. lines before the first accepted heading are preamble: kept only in ImportReview, dropped from the session
//   7. <details> regions are kept only in ImportReview, dropped from the session turn text
//   then: no accepted heading -> no_role_heading; per-turn / total caps -> turn_too_long / total_too_long;
//   no non-empty user and assistant turn -> no_user_or_assistant. Ids are regenerated t1..tN.
// Steps 5-7 run as one pass over lines already classified by steps 3-4; 6 and 7 only route those lines.
import { ChatSessionV1, LIMITS, SCHEMA_VERSION, findForbiddenControlChar, hasContent } from '../schema/chatSession.ts';
import type { Role } from '../schema/chatSession.ts';
import { REFUSAL } from './refusals.ts';
import { FORMAT, WARNING, refuse } from './types.ts';
import type { ImportOutcome, ImportReviewTurn, ImportWarning } from './types.ts';
import { decodeUtf8Strict, lineOfIndex, looksLikeHtmlDocument, normaliseCrlf, stripBom } from './text.ts';

export const XEXPORT_MD_PROFILE_ID = 'xexport-md/doc-2026-10';

const CURSOR_LINE_PREFIX = '<!-- xexport-cursor';

// Step 5 heading rules (D10 + K19). Accepted headings sit at column 0 with exactly one space after `##`.
const USER_HEADING = /^## 👤 User[ \t]*$/u;
const ASSISTANT_HEADING = /^## 🤖 .{1,80}$/u;
// Any `##` heading (up to 3 leading spaces, CommonMark ATX indentation) whose first character after the
// whitespace is Extended_Pictographic. If it is not exactly an accepted heading it refuses (after the preamble).
const EMOJI_ROLE_LIKE_HEADING = /^ {0,3}##[ \t]+\p{Extended_Pictographic}/u;

// Step 3 fences (CommonMark: up to 3 spaces, 3+ backticks or tildes; a backtick info string has no backtick).
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

// Step 4 details markers.
const DETAILS_OPEN_AT_START = /^ {0,3}<details(?=[\s>]|$)/i;
const DETAILS_CLOSE_AT_START = /^ {0,3}<\/details[ \t]*>/i;
const DETAILS_OPEN_ANY = /<details(?=[\s>]|$)/gi;
const DETAILS_CLOSE_ANY = /<\/details[ \t]*>/gi;

// K19 raw HTML: CommonMark HTML block start conditions 1-7 at up to 3 spaces of indentation.
const HTML_START_INDENT = /^ {0,3}</;
const HTML_COND_1 = /^<(?:script|pre|style|textarea)(?=[\s>]|$)/i;
const HTML_COND_4 = /^<![A-Za-z]/;
// CommonMark 0.31.2 block tag names, plus `source` from 0.30 (superset = more refusals, never fewer).
const HTML_COND_6 = new RegExp(
  '^</?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|' +
    'fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|' +
    'main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|source|summary|table|tbody|td|tfoot|th|' +
    'thead|title|tr|track|ul)(?=[\\s>]|/>|$)',
  'i',
);

interface FenceOpen {
  readonly char: '`' | '~';
  readonly length: number;
}

function lineAt(lines: readonly string[], index: number): string {
  return lines[index] ?? '';
}

function isBlank(line: string): boolean {
  return /^[ \t]*$/.test(line);
}

function fenceOpen(line: string): FenceOpen | null {
  const m = FENCE_OPEN.exec(line);
  if (m === null) return null;
  const run = m[1] ?? '';
  const info = m[2] ?? '';
  const char = run.startsWith('`') ? '`' : '~';
  if (char === '`' && info.includes('`')) return null;
  return { char, length: run.length };
}

function closesFence(line: string, open: FenceOpen): boolean {
  const m = FENCE_CLOSE.exec(line);
  if (m === null) return false;
  const run = m[1] ?? '';
  return run.startsWith(open.char) && run.length >= open.length;
}

function countMatches(pattern: RegExp, text: string): number {
  let n = 0;
  for (const _ of text.matchAll(pattern)) n++;
  return n;
}

type HeadingKind = 'user' | 'assistant' | 'role_like' | null;

function classifyHeading(line: string): HeadingKind {
  if (USER_HEADING.test(line)) return 'user';
  if (ASSISTANT_HEADING.test(line)) return 'assistant';
  if (EMOJI_ROLE_LIKE_HEADING.test(line)) return 'role_like';
  return null;
}

const isAsciiAlpha = (c: number): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const isDigit = (c: number): boolean => c >= 48 && c <= 57;
const isTagNameChar = (c: number): boolean => isAsciiAlpha(c) || isDigit(c) || c === 45; // -
const isAttrNameStart = (c: number): boolean => isAsciiAlpha(c) || c === 95 || c === 58; // _ :
const isAttrNameChar = (c: number): boolean => isAttrNameStart(c) || isDigit(c) || c === 46 || c === 45; // . -
const isTagSpace = (c: number): boolean => c === 32 || c === 9;
// Unquoted attribute value: no whitespace, ", ', =, <, >, backtick.
const isUnquotedValueChar = (c: number): boolean =>
  !Number.isNaN(c) && !isTagSpace(c) && c !== 34 && c !== 39 && c !== 61 && c !== 60 && c !== 62 && c !== 96;

function skipTagSpace(s: string, i: number): number {
  let j = i;
  while (j < s.length && isTagSpace(s.charCodeAt(j))) j++;
  return j;
}

function onlySpaceFrom(s: string, i: number): boolean {
  return skipTagSpace(s, i) === s.length;
}

/**
 * CommonMark HTML block start condition 7: a complete open tag or closing tag followed only by whitespace.
 * Hand-written linear scanner (no backtracking regex). `s` starts at the `<`.
 */
function isCompleteTagOnlyLine(s: string): boolean {
  let i = 1;
  const closing = s.charCodeAt(i) === 47; // /
  if (closing) i++;
  if (!isAsciiAlpha(s.charCodeAt(i))) return false;
  while (i < s.length && isTagNameChar(s.charCodeAt(i))) i++;
  if (closing) {
    i = skipTagSpace(s, i);
    return s.charCodeAt(i) === 62 && onlySpaceFrom(s, i + 1);
  }
  for (;;) {
    const ws = skipTagSpace(s, i);
    const c = s.charCodeAt(ws);
    if (c === 62) return onlySpaceFrom(s, ws + 1); // >
    if (c === 47 && s.charCodeAt(ws + 1) === 62) return onlySpaceFrom(s, ws + 2); // />
    if (ws === i || !isAttrNameStart(c)) return false; // attributes need leading whitespace
    i = ws + 1;
    while (i < s.length && isAttrNameChar(s.charCodeAt(i))) i++;
    const beforeEq = skipTagSpace(s, i);
    if (s.charCodeAt(beforeEq) === 61) {
      // =
      const v = skipTagSpace(s, beforeEq + 1);
      const q = s.charCodeAt(v);
      if (q === 34 || q === 39) {
        const end = s.indexOf(q === 34 ? '"' : "'", v + 1);
        if (end < 0) return false;
        i = end + 1;
      } else {
        let j = v;
        while (j < s.length && isUnquotedValueChar(s.charCodeAt(j))) j++;
        if (j === v) return false;
        i = j;
      }
    }
  }
}

/** K19: does this line start a CommonMark HTML block (conditions 1-7)? */
export function startsRawHtmlBlock(line: string): boolean {
  const m = HTML_START_INDENT.exec(line);
  if (m === null) return false;
  const s = line.slice(m[0].length - 1);
  if (HTML_COND_1.test(s)) return true;
  if (s.startsWith('<!--')) return true; // condition 2 (the final cursor line is already stripped in step 2)
  if (s.startsWith('<?')) return true; // condition 3
  if (HTML_COND_4.test(s)) return true; // condition 4
  if (s.startsWith('<![CDATA[')) return true; // condition 5
  if (HTML_COND_6.test(s)) return true; // condition 6
  return isCompleteTagOnlyLine(s); // condition 7
}

interface TurnDraft {
  readonly role: Role;
  readonly headingLine: number;
  readonly lines: string[];
  readonly details: Map<number, string[]>;
}

function trimBlankLines(lines: readonly string[]): string {
  let start = 0;
  let end = lines.length;
  while (start < end && isBlank(lineAt(lines, start))) start++;
  while (end > start && isBlank(lineAt(lines, end - 1))) end--;
  return lines.slice(start, end).join('\n');
}

/** Parse one xexport Markdown export (profile xexport-md/doc-2026-10). Pure; the input is never stored. */
export function parseXexportMd(bytes: Uint8Array): ImportOutcome {
  // Step 0: size cap before any decoding.
  if (bytes.byteLength > LIMITS.maxFileBytes) return refuse(REFUSAL.OVERSIZE_FILE);

  // Step 1: encoding, BOM, CRLF, control characters.
  const decoded = decodeUtf8Strict(bytes);
  if (decoded === null) return refuse(REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
  const warnings: ImportWarning[] = [];
  const bom = stripBom(decoded);
  if (bom.removed) warnings.push(WARNING.BOM_REMOVED);
  const text = normaliseCrlf(bom.text);
  const badAt = findForbiddenControlChar(text);
  if (badAt >= 0) return refuse(REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS, { line: lineOfIndex(text, badAt) });

  // Step 1b: an HTML export is refused, never parsed.
  if (looksLikeHtmlDocument(text)) return refuse(REFUSAL.HTML_EXPORT, { line: 1 });

  // Step 2: final cursor line. Trailing blank lines are ignored when locating the final line.
  const all = text.split('\n');
  let end = all.length;
  while (end > 0 && isBlank(lineAt(all, end - 1))) end--;
  let body: string[];
  if (end > 0 && lineAt(all, end - 1).startsWith(CURSOR_LINE_PREFIX)) {
    body = all.slice(0, end - 1);
  } else {
    body = all.slice(0, end);
    warnings.push(WARNING.MISSING_CURSOR_LINE);
  }
  const n = body.length;

  // Step 3: fenced code blocks, over the whole document (preamble included).
  const inFence: boolean[] = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; ) {
    const open = fenceOpen(lineAt(body, i));
    if (open === null) {
      i++;
      continue;
    }
    inFence[i] = true;
    let j = i + 1;
    let closed = false;
    while (j < n) {
      inFence[j] = true;
      if (closesFence(lineAt(body, j), open)) {
        closed = true;
        break;
      }
      j++;
    }
    if (!closed) return refuse(REFUSAL.UNBALANCED_FENCE, { line: i + 1 });
    i = j + 1;
  }

  // Step 4: <details> regions outside fences. A region opens only at a line start; inside a region any further
  // opening tag is nesting; a closing tag anywhere on a region line ends the region. A closing tag at a line start
  // with no open region is unbalanced. Fence lines inside an open region belong to the region.
  const region: number[] = new Array<number>(n).fill(-1);
  let regionCount = 0;
  let openAt = -1;
  for (let k = 0; k < n; k++) {
    const line = lineAt(body, k);
    if (inFence[k] === true) {
      if (openAt >= 0) region[k] = regionCount - 1;
      continue;
    }
    if (openAt < 0) {
      if (DETAILS_OPEN_AT_START.test(line)) {
        const opens = countMatches(DETAILS_OPEN_ANY, line);
        const closes = countMatches(DETAILS_CLOSE_ANY, line);
        if (opens > 1 || closes > 1) return refuse(REFUSAL.NESTED_OR_UNBALANCED_DETAILS, { line: k + 1 });
        region[k] = regionCount++;
        if (closes === 0) openAt = k;
      } else if (DETAILS_CLOSE_AT_START.test(line)) {
        return refuse(REFUSAL.NESTED_OR_UNBALANCED_DETAILS, { line: k + 1 });
      }
      continue;
    }
    region[k] = regionCount - 1;
    const opens = countMatches(DETAILS_OPEN_ANY, line);
    const closes = countMatches(DETAILS_CLOSE_ANY, line);
    if (opens > 0 || closes > 1) return refuse(REFUSAL.NESTED_OR_UNBALANCED_DETAILS, { line: k + 1 });
    if (closes === 1) openAt = -1;
  }
  if (openAt >= 0) return refuse(REFUSAL.NESTED_OR_UNBALANCED_DETAILS, { line: openAt + 1 });

  // Steps 5-7: one pass over classified lines.
  const preamble: string[] = [];
  const drafts: TurnDraft[] = [];
  for (let k = 0; k < n; k++) {
    const line = lineAt(body, k);
    const current = drafts[drafts.length - 1];
    const r = region[k] ?? -1;
    if (r >= 0) {
      // Step 7 (or step 6 when before the first heading): review only.
      if (current === undefined) {
        preamble.push(line);
      } else {
        const bucket = current.details.get(r);
        if (bucket === undefined) current.details.set(r, [line]);
        else bucket.push(line);
      }
      continue;
    }
    if (inFence[k] === true) {
      // Fenced content is never a heading or an HTML block (fences are parsed before headings).
      if (current === undefined) preamble.push(line);
      else current.lines.push(line);
      continue;
    }
    const heading = classifyHeading(line);
    if (heading === 'user' || heading === 'assistant') {
      drafts.push({ role: heading, headingLine: k + 1, lines: [], details: new Map() });
      if (drafts.length > LIMITS.maxTurns) return refuse(REFUSAL.TOO_MANY_TURNS, { line: k + 1 });
      continue;
    }
    if (current === undefined) {
      // Step 6: preamble. Role-like headings and raw HTML are not refused here; the preamble is dropped wholesale.
      preamble.push(line);
      continue;
    }
    if (heading === 'role_like') return refuse(REFUSAL.UNKNOWN_ROLE_HEADING, { line: k + 1 });
    if (startsRawHtmlBlock(line)) return refuse(REFUSAL.RAW_HTML_OUTSIDE_DETAILS, { line: k + 1 });
    // Any other line, including a plain `## Heading`, is turn content.
    current.lines.push(line);
  }

  if (drafts.length === 0) return refuse(REFUSAL.NO_ROLE_HEADING);

  const texts = drafts.map((d) => trimBlankLines(d.lines));
  let total = 0;
  for (let i = 0; i < texts.length; i++) {
    const len = (texts[i] ?? '').length;
    if (len > LIMITS.maxTurnUnits) return refuse(REFUSAL.TURN_TOO_LONG, { line: drafts[i]?.headingLine ?? 0 });
    total += len;
  }
  if (total > LIMITS.maxTotalUnits) return refuse(REFUSAL.TOTAL_TOO_LONG);

  const hasUser = drafts.some((d, i) => d.role === 'user' && hasContent(texts[i] ?? ''));
  const hasAssistant = drafts.some((d, i) => d.role === 'assistant' && hasContent(texts[i] ?? ''));
  if (!hasUser || !hasAssistant) return refuse(REFUSAL.NO_USER_OR_ASSISTANT);

  const candidate = {
    schema_version: SCHEMA_VERSION,
    turns: drafts.map((d, i) => ({ id: `t${i + 1}`, role: d.role, text: texts[i] ?? '' })),
  };
  const parsed = ChatSessionV1.safeParse(candidate);
  if (!parsed.success) {
    // Every schema rule is checked above; reaching this is a bug, not an input problem.
    throw new Error('xexportMd: canonical session failed ChatSessionV1 validation');
  }

  const reviewTurns: ImportReviewTurn[] = drafts.map((d, i) => ({
    id: `t${i + 1}`,
    role: d.role,
    headingLine: d.headingLine,
    droppedDetails: [...d.details.values()].map((ls) => ls.join('\n')),
  }));

  return {
    ok: true,
    session: parsed.data,
    review: {
      format: FORMAT.XEXPORT_MD,
      profileId: XEXPORT_MD_PROFILE_ID,
      preamble: preamble.join('\n'),
      turns: reviewTurns,
      warnings,
    },
  };
}
