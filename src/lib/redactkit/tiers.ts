export type Tier = 'high' | 'medium' | 'low';
export const TIER_RANK: Readonly<Record<Tier, number>> = Object.freeze({ high: 3, medium: 2, low: 1 });
export interface Finding {
  readonly rule_id: string;
  readonly kind: string;
  readonly tier: Tier;
  readonly start: number;
  readonly end: number;
  readonly blocking: boolean;
  readonly turn_id?: string;
}
export interface Findings { readonly ok: false; readonly findings: readonly Finding[] }
/** Higher tier, then longest span, then earliest offset, then rule id. Greedy non-overlap. */
export function resolveOverlaps(findings: readonly Finding[]): readonly Finding[] {
  const ordered = [...findings].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] ||
    (b.end - b.start) - (a.end - a.start) || a.start - b.start || a.rule_id.localeCompare(b.rule_id));
  const selected: Finding[] = [];
  for (const f of ordered) if (!selected.some((s) => f.start < s.end && s.start < f.end)) selected.push(f);
  return selected.sort((a, b) => a.start - b.start);
}
