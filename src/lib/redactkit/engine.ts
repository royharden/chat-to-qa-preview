import type { SessionLike, TurnLike } from '../session/views.ts';
import { candidateTurns } from '../session/views.ts';
import type { RedactedSession, RedactedText, RedactedTurn } from './brand.ts';
import type { Finding, Findings } from './tiers.ts';
import { resolveOverlaps } from './tiers.ts';
import { detect, RULES_VERSION } from './rules.ts';
import { escapePlaceholders, newNamespace, renderInternal, RENDERED_PLACEHOLDER, scanPlaceholderEscapes } from './placeholders.ts';
import { sourceRevision } from './revision.ts';
const authentic = new WeakSet<object>();
export interface ManualSpan { readonly turn_id: string; readonly start: number; readonly end: number }
export interface RedactOptions {
  readonly excludedTurnIds?: ReadonlySet<string>;
  readonly denyList?: readonly string[];
  /** Offsets refer to the original included turn, not an already redacted draft. */
  readonly manualSpans?: readonly ManualSpan[];
}
function fail(findings: readonly Finding[]): Findings { return Object.freeze({ ok: false, findings: Object.freeze([...findings]) }); }
function problem(rule_id: string, turn_id = ''): Finding {
  return { rule_id, kind: 'INVALID', tier: 'high', start: 0, end: 0, blocking: true, turn_id };
}
function safeBoundary(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return true;
  const left = text.charCodeAt(offset - 1); const right = text.charCodeAt(offset);
  return !(left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff);
}
async function seal(turns: readonly RedactedTurn[], placeholders: readonly string[]): Promise<RedactedSession> {
  const frozen = Object.freeze(turns.map((t) => Object.freeze({ ...t })));
  const result = Object.freeze({ ok: true, turns: frozen, source_revision: await sourceRevision(frozen, RULES_VERSION),
    rules_version: RULES_VERSION, placeholders: Object.freeze([...new Set(placeholders)].sort()) }) as RedactedSession;
  authentic.add(result); return result;
}
export function isRedactedSession(value: unknown): value is RedactedSession {
  return typeof value === 'object' && value !== null && authentic.has(value);
}
export async function redactSession(session: SessionLike<TurnLike>, options: RedactOptions = {}): Promise<RedactedSession | Findings> {
  const included = candidateTurns(session, options.excludedTurnIds ?? new Set());
  const manual = options.manualSpans ?? []; const invalid: Finding[] = [];
  for (const span of manual) {
    const turn = included.find((t) => t.id === span.turn_id);
    if (!turn || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end > turn.text.length ||
      span.start >= span.end || !safeBoundary(turn.text, span.start) || !safeBoundary(turn.text, span.end)) invalid.push(problem('M_INVALID_SPAN', span.turn_id));
  }
  if (invalid.length) return fail(invalid);
  if (!included.length) return fail([problem('V_EMPTY')]);
  const namespace = newNamespace(); const counts = new Map<string, number>(); const labels: string[] = []; const turns: RedactedTurn[] = [];
  const pending: Finding[] = [];
  for (const turn of included) {
    const text = escapePlaceholders(turn.text);
    const manualFindings: Finding[] = manual.filter((s) => s.turn_id === turn.id).map((s) => ({ ...s,
      rule_id: 'M_MANUAL', kind: 'MANUAL', tier: 'high', blocking: false }));
    const findings = detect(text, { denyList: options.denyList });
    // Explicit manual redaction resolves entropy only when it covers the entire ambiguous candidate.
    const unresolved = findings.filter((f) => f.blocking && !manualFindings.some((m) => m.start <= f.start && m.end >= f.end));
    pending.push(...unresolved.map((f) => ({ ...f, turn_id: turn.id })));
    const definite = findings.filter((f) => !f.blocking);
    // Merge manual ranges with any overlapping definite spans, so partial overlap cannot leave manual text behind.
    let selected = [...resolveOverlaps([...definite, ...manualFindings])];
    for (const m of manualFindings) {
      const touching = selected.filter((f) => m.start < f.end && f.start < m.end);
      selected = selected.filter((f) => !touching.includes(f));
      selected.push({ ...m, start: Math.min(m.start, ...touching.map((f) => f.start)), end: Math.max(m.end, ...touching.map((f) => f.end)) });
    }
    selected.sort((a, b) => a.start - b.start);
    let cursor = 0; let output = '';
    for (const f of selected) {
      const n = (counts.get(f.kind) ?? 0) + 1; counts.set(f.kind, n);
      const label = `${f.kind}_${n}`; labels.push(`[${label}]`);
      output += text.slice(cursor, f.start) + `\u27e6${namespace}:${label}\u27e7`; cursor = f.end;
    }
    output += text.slice(cursor);
    turns.push({ id: turn.id, role: turn.role, text: renderInternal(output, namespace) as RedactedText });
  }
  if (pending.length) return fail(pending);
  // Fail closed if a replacement exposed another identifier at a boundary.
  for (const turn of turns) pending.push(...detect(turn.text, { denyList: options.denyList }).map((f) => ({ ...f, blocking: true, turn_id: turn.id })));
  if (pending.length) return fail(pending);
  return seal(turns, labels);
}
/** Server boundary: no re-escaping of rendered placeholders; detect again and hash the exact received text.
 * Rendered labels carry no restoration capability. Never accepts an existing session brand as proof.
 */
export async function verifyRedacted(turns: readonly { readonly id: string; readonly role: string; readonly text: string }[],
  rulesVersion: string): Promise<RedactedSession | Findings> {
  if (rulesVersion !== RULES_VERSION || !Array.isArray(turns) || turns.length < 1 || turns.length > 2000) return fail([problem('V_VERSION_OR_SHAPE')]);
  const findings: Finding[] = []; const ids = new Set<string>(); const labels: string[] = []; let units = 0;
  for (const turn of turns) {
    if (!turn || typeof turn.id !== 'string' || !/^t[1-9][0-9]{0,3}$/.test(turn.id) || ids.has(turn.id) ||
      (turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.text !== 'string' || turn.text.length > 100_000) {
      findings.push(problem('V_TURN')); continue;
    }
    ids.add(turn.id); units += turn.text.length;
    if (scanPlaceholderEscapes(turn.text).length) findings.push(problem('V_PLACEHOLDER_ESCAPE', turn.id));
    if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/.test(turn.text) ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(turn.text)) findings.push(problem('V_TEXT', turn.id));
    findings.push(...detect(turn.text).map((f) => ({ ...f, blocking: true, turn_id: turn.id })));
    for (const m of turn.text.matchAll(RENDERED_PLACEHOLDER)) {
      if (!/^\[(?:AWS|TOKEN|JWT|PEM|AUTH|CONNECTION|URL|SECRET|EMAIL|PHONE|IPV4|IPV6|HOST|HOME|HANDLE|UUID|NAME|MANUAL)_\d{1,6}\]$/.test(m[0])) findings.push(problem('V_PLACEHOLDER_KIND', turn.id));
      labels.push(m[0]);
    }
  }
  if (units > 4_000_000) findings.push(problem('V_UNITS'));
  if (findings.length) return fail(findings);
  return seal(turns.map((t) => ({ id: t.id, role: t.role as 'user' | 'assistant', text: t.text as RedactedText })), labels);
}
/** Re-run from the raw in-memory source with the additional explicit span; raw text is never retained by redactkit. */
export function manualRedact(session: SessionLike<TurnLike>, options: RedactOptions, span: ManualSpan): Promise<RedactedSession | Findings> {
  return redactSession(session, { ...options, manualSpans: [...(options.manualSpans ?? []), span] });
}
