import type { ResultRow } from './counts.ts';
export function markdownResults(rows: readonly ResultRow[]): string {
  const columns = ['run_kind','split','track','redaction_arm','format','family','class','planted_ids','eligible_ids','leaked_ids','artifact_leak_rate','blocked','abstained','status'] as const;
  return '# Evaluation results\n\nSynthetic diagnostic only; not a privacy guarantee. Builder-dev data is never a headline claim. Cells with fewer than 10 eligible ids are counts only.\n\n'
    + `|${columns.join('|')}|\n|${columns.map(()=>'---').join('|')}|\n`
    + rows.map(row=>'|'+columns.map(column=>column==='artifact_leak_rate' && row.eligible_ids<10 ? 'counts only' : String(row[column])).join('|')+'|').join('\n')+'\n';
}
