import type { RedactedSession } from '../redactkit/index.ts';
import type { PublicSpan } from './core.ts';
export const EXCERPT_TOTAL_CAP = 8000;
export function buildExcerpts(session: RedactedSession, spans: readonly PublicSpan[]) {
  const seen = new Set<string>();
  const excerpts: { span: PublicSpan; text: string }[] = [];
  let total = 0;
  for (const span of spans) {
    const turn = session.turns.find(t => t.id === span.turn_id);
    if (!turn || span.source_revision !== session.source_revision || !Number.isInteger(span.start) || !Number.isInteger(span.end)
      || span.start < 0 || span.end <= span.start || span.end > turn.text.length) throw new Error('invalid_span');
    const boundary = (offset: number) => offset > 0 && offset < turn.text.length && /[\uD800-\uDBFF]/.test(turn.text[offset - 1] ?? '') && /[\uDC00-\uDFFF]/.test(turn.text[offset] ?? '');
    if (boundary(span.start) || boundary(span.end)) throw new Error('surrogate_boundary');
    const key = `${span.turn_id}:${span.start}:${span.end}:${span.source_revision}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const text = turn.text.slice(span.start, span.end);
    total += text.length;
    if (total > EXCERPT_TOTAL_CAP) throw new Error('excerpt_cap_exceeded');
    excerpts.push({ span, text });
  }
  return excerpts;
}
