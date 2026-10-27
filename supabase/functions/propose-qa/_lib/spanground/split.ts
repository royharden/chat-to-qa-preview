export const SPLITTER_VERSION = 's47.conservative-en.v1';

export interface SourceBlock {
  readonly kind: 'sentence' | 'code';
  readonly text: string;
  readonly start: number;
  readonly end: number;
}
export type SplitResult = { readonly ok: true; readonly blocks: readonly SourceBlock[] } |
  { readonly ok: false; readonly reason: 'unbalanced_fence' | 'empty_block' };

function addProse(text: string, base: number, out: SourceBlock[]): void {
  let start = 0;
  let inline = false;
  const push = (end: number): void => {
    const part = text.slice(start, end);
    const leading = part.length - part.trimStart().length;
    const trailing = part.trimEnd().length;
    if (trailing > leading) {
      out.push({ kind: 'sentence', text: part.slice(leading, trailing), start: base + start + leading, end: base + start + trailing });
    }
    start = end;
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '`') inline = !inline;
    if (inline) continue;
    if (char === '\n' && text[i + 1] === '\n') {
      push(i);
      start = i + 1;
      continue;
    }
    if (char !== '.' && char !== '?' && char !== '!') continue;
    // An internal dot in v5.4.2, a path or a URL is never a sentence boundary.
    let end = i + 1;
    while (end < text.length && /[.!?"'\u2019\u201d)\]]/.test(text[end]!)) end += 1;
    if (end < text.length && !/\s/u.test(text[end]!)) continue;
    // Ambiguous English abbreviations stay together; false negatives are a documented splitter limit.
    if (char === '.' && /(?:\b(?:e\.g|i\.e|Mr|Mrs|Ms|Dr|Prof|vs|etc)|\b[A-Z])$/u.test(text.slice(start, i))) continue;
    push(end);
    i = end - 1;
  }
  push(text.length);
}

/** Versioned conservative English segmentation; fenced code stays atomic with original offsets. */
export function splitBlocks(text: string): SplitResult {
  const out: SourceBlock[] = [];
  const lines = [...text.matchAll(/[^\n]*(?:\n|$)/gu)].filter((match) => match[0].length > 0);
  let proseStart = 0;
  let fence: { marker: string; length: number; start: number } | undefined;
  for (const line of lines) {
    const lineStart = line.index;
    const marker = /^ {0,3}(`{3,}|~{3,})([^\n]*)/u.exec(line[0]);
    if (!fence && marker) {
      addProse(text.slice(proseStart, lineStart), proseStart, out);
      fence = { marker: marker[1]![0]!, length: marker[1]!.length, start: lineStart };
    } else if (fence && marker && marker[1]![0] === fence.marker && marker[1]!.length >= fence.length && marker[2]!.trim() === '') {
      const end = lineStart + line[0].replace(/\n$/u, '').length;
      out.push({ kind: 'code', text: text.slice(fence.start, end), start: fence.start, end });
      proseStart = lineStart + line[0].length;
      fence = undefined;
    }
  }
  if (fence) return { ok: false, reason: 'unbalanced_fence' };
  addProse(text.slice(proseStart), proseStart, out);
  if (out.length === 0) return { ok: false, reason: 'empty_block' };
  return { ok: true, blocks: Object.freeze(out) };
}

export function normaliseCode(text: string): string {
  return text.replace(/\r\n?/gu, '\n').split('\n').map((line) => line.replace(/[ \t]+$/u, '')).join('\n').replace(/\n+$/u, '');
}
