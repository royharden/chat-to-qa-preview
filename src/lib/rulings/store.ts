export interface ApprovalRow {
  readonly md_sha256: string; readonly json_sha256: string; readonly source_revision: string;
  readonly rules_version: string; readonly scan_digest: string; readonly decision: 'approve'; readonly at: string;
}
export interface RulingsStore { readonly durable: boolean; append(row: ApprovalRow): Promise<void>; list(): Promise<readonly ApprovalRow[]> }
