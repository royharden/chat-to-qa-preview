import type { Finding } from './tiers.ts';
export function denyListFindings(text: string, terms: readonly string[]): Finding[] {
  const findings: Finding[] = [];
  for (const raw of terms) {
    const term = raw.trim();
    if (!term) continue;
    // Literal matching only: no user regex. ASCII case folding preserves UTF-16 offsets.
    const folded = (s: string): string => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
    const haystack = folded(text); const needle = folded(term);
    let start = haystack.indexOf(needle);
    while (start !== -1) {
      findings.push({ rule_id: 'P_DENY', kind: 'NAME', tier: 'medium', start, end: start + term.length, blocking: false });
      start = haystack.indexOf(needle, start + Math.max(1, term.length));
    }
  }
  return findings;
}
