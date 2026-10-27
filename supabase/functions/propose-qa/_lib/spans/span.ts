/** UTF-16 half-open offsets in rendered-placeholder text, never raw input. */
export interface Span {
  readonly turn_id: string;
  readonly start: number;
  readonly end: number;
  readonly source_revision: string;
}

export function spanKey(span: Span): string {
  return JSON.stringify([span.source_revision, span.turn_id, span.start, span.end]);
}
