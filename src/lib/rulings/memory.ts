import type { ApprovalRow, RulingsStore } from './store.ts';
export function memoryStore(): RulingsStore {
  const rows: ApprovalRow[] = [];
  return { durable: false, async append(row) { rows.push(Object.freeze({ ...row })); }, async list() { return [...rows]; } };
}
