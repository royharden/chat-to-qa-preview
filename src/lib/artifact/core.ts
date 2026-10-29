// Unbranded evaluator seam. Product consumers use serialize.ts exclusively (N12).
export interface PublicSpan { readonly turn_id: string; readonly start: number; readonly end: number; readonly source_revision: string }
export interface PublicBlock { readonly text: string; readonly spans: readonly PublicSpan[] }
export interface ArtifactContent {
  readonly question: PublicBlock;
  readonly answer: readonly PublicBlock[];
  readonly excerpts: readonly { readonly span: PublicSpan; readonly text: string }[];
  readonly rules_version: string;
  readonly profile_id: string;
  readonly source_revision: string;
}
export const PUBLIC_KEYS = ['question', 'answer', 'excerpts', 'rules_version', 'profile_id', 'source_revision'] as const;
const clean = (s: string) => s.replace(/\r\n?/g, '\n');
const span = (s: PublicSpan) => ({ turn_id: s.turn_id, start: s.start, end: s.end, source_revision: s.source_revision });
const block = (b: PublicBlock) => ({ text: clean(b.text), spans: b.spans.map(span) });
export function serializeCore(content: ArtifactContent): { md: Uint8Array; json: Uint8Array } {
  const object = {
    question: block(content.question), answer: content.answer.map(block),
    excerpts: content.excerpts.map(e => ({ span: span(e.span), text: clean(e.text) })),
    rules_version: content.rules_version, profile_id: content.profile_id, source_revision: content.source_revision,
  };
  // User text remains literal. No metadata, raw-input hashes, titles, filenames or timestamps.
  const citation = (s: PublicSpan) => `${s.turn_id}:${s.start}-${s.end}@${s.source_revision}`;
  const md = ['# Question', object.question.text, `Citations: ${content.question.spans.map(citation).join(', ')}`,
    '# Answer', ...object.answer.flatMap((b, i) => [b.text, `Citations: ${content.answer[i]?.spans.map(citation).join(', ') ?? ''}`]),
    '# Source excerpts', ...object.excerpts.flatMap(e => [citation(e.span), e.text]),
    `Rules: ${object.rules_version}`, `Profile: ${object.profile_id}`, `Revision: ${object.source_revision}`, ''].join('\n\n');
  const encoder = new TextEncoder();
  return { md: encoder.encode(md), json: encoder.encode(JSON.stringify(object, null, 2) + '\n') };
}
