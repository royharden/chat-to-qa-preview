export function rate(numerator: number, denominator: number): number | 'NA' {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || denominator < 0 || numerator > denominator) throw new Error('invalid_counts');
  return denominator === 0 ? 'NA' : numerator / denominator;
}
export interface ArtifactTrace {
  readonly id: string;
  readonly blocked: number; readonly abstained: number; readonly downloadable: number; readonly decoy_false_redactions: number;
  readonly anchor_retained_count?: number; readonly anchor_coverage_count?: number; readonly anchor_total?: number;
  readonly valid_span_count?: number; readonly span_total?: number; readonly gold_source_hits?: number; readonly gold_source_total?: number;
}
/** Tuple keys keep session/slot and session/target identities distinct even when ids contain separators. */
export function unitKey(session: string, slot: string): string { return JSON.stringify([session,slot]); }
export function artifactTrace(id: string, values: Partial<Omit<ArtifactTrace,'id'>>): ArtifactTrace {
  return {id,blocked:0,abstained:0,downloadable:0,decoy_false_redactions:0,...values};
}
export type RunKind = 'dev_diagnostic' | 'heldout_first_run' | 'known_set_diagnostic';
export interface ResultRow {
  run_kind?: RunKind; first_run_reference?: string;
  artifact_traces?: readonly ArtifactTrace[];
  session_ids?: readonly string[]; target_ids?: readonly string[]; planted_unit_ids?: readonly string[];
  eligible_unit_ids?: readonly string[]; leaked_unit_ids?: readonly string[]; residual_unit_ids?: readonly string[]; eligible_session_ids?: readonly string[];
  anchor_retained_count?: number; anchor_coverage_count?: number; anchor_total?: number; valid_span_count?: number; span_total?: number; gold_source_hits?: number; gold_source_total?: number;
  edition: string; code_sha: string; prereg_sha: string; split: 'dev' | 'heldout'; track: string;
  redaction_arm: string; selector: string; mode: 'mock' | 'simulated' | 'live'; format: 'md' | 'json';
  family: string; class: string; mutator: string; sessions: number; targets: number; planted_ids: number;
  residual_before_gate: number; gate_eligible_sessions: number; eligible_ids: number; leaked_ids: number;
  artifact_leak_rate: number | 'NA'; blocked: number; abstained: number; downloadable: number;
  decoy_false_redactions: number; anchor_retention: number | 'NA'; anchor_coverage: number | 'NA';
  span_validity: number | 'NA'; mutations_caught: number; mutations_total: number;
  gold_source_turn_hit?: number | 'NA';
  provider: string; model: string; tokens: number | 'unknown'; usd: number | 'unknown'; status: 'ok' | 'not_run' | 'NA';
}
export function emptyRow(values: Partial<ResultRow> = {}): ResultRow {
  return { run_kind:'dev_diagnostic',edition: 'dev-builder-v1', code_sha: '', prereg_sha: '', split: 'dev', track: 'controlled', redaction_arm: 'R2', selector: 'gold-target', mode: 'mock', format: 'md',
    family: 'all', class: 'all', mutator: '', sessions: 0, targets: 0, planted_ids: 0, residual_before_gate: 0, gate_eligible_sessions: 0, eligible_ids: 0, leaked_ids: 0,
    artifact_leak_rate: 'NA', blocked: 0, abstained: 0, downloadable: 0, decoy_false_redactions: 0, anchor_retention: 'NA', anchor_coverage: 'NA', span_validity: 'NA',
    mutations_caught: 0, mutations_total: 0, provider: 'mock', model: 'none', tokens: 0, usd: 0, status: 'not_run', ...values };
}
