export const DECOY_RULE_IDS = ['D_VERSION_IP', 'D_DOTTED_VERSION', 'D_GIT_SHA', 'D_SEMVER', 'D_LINE_COL', 'D_BASE64_CONTEXT'] as const;
/** Context is local to the candidate; never exempts a containing URL, assignment or path. */
export function decoyRule(text: string, start: number, end: number, kind: string): string | undefined {
  const value = text.slice(start, end);
  const before = text.slice(Math.max(0, start - 32), start);
  const tokenPrefix = text.slice(0, start).split(/\s/).at(-1) ?? '';
  if (/[\/\\?]/.test(tokenPrefix) && !/^data:/i.test(tokenPrefix)) return undefined;
  if (kind === 'IPV4' && /(?:\bv|\bversion\s+|\bbuild\s+)$/i.test(before)) return 'D_VERSION_IP';
  if (kind === 'IPV4' && (text[start - 1] === '.' || /^\.\d/.test(text.slice(end)))) return 'D_DOTTED_VERSION';
  if (kind !== 'ENTROPY') return undefined;
  if (/\b(?:commit|git|sha)\s+$/i.test(before) && /^[a-f\d]{7,64}$/i.test(value)) return 'D_GIT_SHA';
  if (/^v?\d+\.\d+\.\d+(?:-[a-z\d.-]{1,30})?$/i.test(value)) return 'D_SEMVER';
  if (/^\d+:\d+$/.test(value)) return 'D_LINE_COL';
  if (/\b(?:base64\s*[:=]?\s*|data:[^,\s]{0,50},)$/i.test(before)) {
    try {
      const decoded = atob(value);
      // Only printable natural-language words, never a blanket exemption for encoded identifiers.
      if (/^[a-z ]{1,200}$/i.test(decoded) && decoded.includes(' ')) return 'D_BASE64_CONTEXT';
    } catch { /* not base64 */ }
  }
  return undefined;
}
