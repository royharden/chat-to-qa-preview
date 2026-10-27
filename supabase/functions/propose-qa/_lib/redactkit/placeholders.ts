import type { Finding } from './tiers.ts';
export const RENDERED_PLACEHOLDER = /\[[A-Z][A-Z0-9_]{0,30}_\d{1,6}\]/g;
export function newNamespace(): string {
  const bytes = new Uint8Array(12); globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
/** Same-length escapes preserve original UTF-16 detector/manual offsets. No restoration API. */
export function escapePlaceholders(text: string): string {
  return text.replace(/\u27e6[^\n\u27e7]{0,100}\u27e7/g, (v) => `\u27ec${v.slice(1, -1)}\u27ed`)
    .replace(RENDERED_PLACEHOLDER, (v) => `\uff3b${v.slice(1, -1)}\uff3d`);
}
export function scanPlaceholderEscapes(text: string): readonly Finding[] {
  const out: Finding[] = [];
  for (const m of text.matchAll(/[\u27e6\u27e7\u27ec\u27ed]|\uff3b[A-Z][A-Z0-9_]{0,30}_\d{1,6}\uff3d/g)) {
    out.push({ rule_id: 'V_PLACEHOLDER_ESCAPE', kind: 'INVALID', tier: 'high', start: m.index, end: m.index + m[0].length, blocking: true });
  }
  return out;
}
export function renderInternal(text: string, namespace: string): string {
  return text.replace(new RegExp(`\u27e6${namespace}:([A-Z][A-Z0-9_]{0,30}_\\d{1,6})\u27e7`, 'g'), '[$1]');
}
