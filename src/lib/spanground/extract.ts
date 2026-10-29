/** Narrow lexical evidence only. Ordinary prose words carry no semantic truth signal. */
export function normaliseToken(token: string): string {
  return token.normalize('NFKC');
}

// Specific compound forms precede shorter forms; Unicode boundaries prevent prefix-only matches.
const CHECKABLE = /\[[A-Z][A-Z0-9_]*_[0-9]+\]|https?:\/\/[^\s<>`]+|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|--[A-Za-z0-9][A-Za-z0-9-]*(?:=[^\s`]+)?|(?:\.?\.?\/|[A-Za-z]:[\\/]|\/)[A-Za-z0-9_.~@%+\\/-]+|[A-Za-z0-9_]+(?:\.[A-Za-z0-9_-]+)+|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)+|[A-Fa-f0-9]{7,}|[A-Za-z]+[0-9][A-Za-z0-9]*|[0-9]+(?:\.[0-9]+)*(?:%|[A-Za-z]+)?/gu;
const TOKEN_EDGE = /[\p{L}\p{N}_]/u;

function trimPunctuation(token: string): string {
  return token.replace(/[.,;:!?]+$/u, '');
}

export function hasTokenBoundary(text: string, start: number, end: number, token: string): boolean {
  const first = token[0] ?? '';
  const last = token[token.length - 1] ?? '';
  const before = text.slice(0, start).at(-1) ?? '';
  const after = text.slice(end, end + 1);
  if (TOKEN_EDGE.test(first) && TOKEN_EDGE.test(before)) return false;
  if (TOKEN_EDGE.test(last) && TOKEN_EDGE.test(after)) return false;
  // A flag or path suffix is not evidence for a different compound token.
  if ((TOKEN_EDGE.test(first) || ['-', '_', '/', '.', '[', ']'].includes(first)) && /[\p{L}\p{N}_/.-]/u.test(before)) return false;
  if (last === ']' && TOKEN_EDGE.test(after)) return false;
  if (/[\p{L}\p{N}_]/u.test(last) && /^(?:[-_/\[\]]|\.[\p{L}\p{N}_])/u.test(text.slice(end))) return false;
  return true;
}

export function containsToken(text: string, token: string): boolean {
  const normal = normaliseToken(text);
  const needle = normaliseToken(token);
  let offset = normal.indexOf(needle);
  while (offset !== -1) {
    if (hasTokenBoundary(normal, offset, offset + needle.length, needle)) return true;
    offset = normal.indexOf(needle, offset + 1);
  }
  return false;
}

/** Distinct normalised technical tokens, including whole inline-code payloads. */
export function extractCheckable(text: string): readonly string[] {
  const out = new Set<string>();
  for (const inline of text.matchAll(/`([^`\n]+)`/gu)) {
    if (inline[1]?.trim()) out.add(normaliseToken(inline[1].trim()));
  }
  for (const match of text.matchAll(CHECKABLE)) {
    const token = trimPunctuation(match[0]);
    if (token && hasTokenBoundary(text, match.index, match.index + token.length, token)) out.add(normaliseToken(token));
  }
  return Object.freeze([...out]);
}
