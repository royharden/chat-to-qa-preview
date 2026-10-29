import type { ArtifactTrace, ResultRow } from './counts.ts';
import { rate } from './counts.ts';
export function aggregate(rows: readonly ResultRow[], familyOnly = false): readonly ResultRow[] {
  const groups = new Map<string, ResultRow[]>();
  for (const row of rows) { const key = JSON.stringify([row.edition,row.run_kind,row.first_run_reference,row.split,row.track,row.redaction_arm,row.selector,row.mode,row.format,row.family,familyOnly?'all':row.class,row.mutator]); groups.set(key,[...(groups.get(key) ?? []),row]); }
  return [...groups.values()].map(group => {
    const first = group[0]!;
    const sum = (key: keyof ResultRow) => group.reduce((n,r) => n + (typeof r[key] === 'number' ? r[key] as number : 0),0);
    const traceKeys=['session_ids','target_ids','planted_unit_ids','eligible_unit_ids','leaked_unit_ids','residual_unit_ids','eligible_session_ids'] as const;
    const unions:Pick<ResultRow,typeof traceKeys[number]>={};
    for(const key of traceKeys)unions[key]=group.every(r=>Array.isArray(r[key]))?[...new Set(group.flatMap(r=>r[key]??[]))].sort():undefined;
    const unique=(key:typeof traceKeys[number],fallback:keyof ResultRow)=>unions[key]?.length??sum(fallback);
    let artifacts:ArtifactTrace[]|undefined;
    if(group.every(r=>Array.isArray(r.artifact_traces))){
      const byId=new Map<string,ArtifactTrace>();
      for(const item of group.flatMap(r=>r.artifact_traces??[])){
        const old=byId.get(item.id);
        const metrics=['blocked','abstained','downloadable','decoy_false_redactions','anchor_retained_count','anchor_coverage_count','anchor_total','valid_span_count','span_total','gold_source_hits','gold_source_total'] as const;
        if(old&&metrics.some(key=>(old[key]??0)!==(item[key]??0)))throw new Error('inconsistent_artifact_trace');
        byId.set(item.id,item);
      }
      artifacts=[...byId.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    }
    const metric=(key:Exclude<keyof ArtifactTrace,'id'>)=>artifacts?artifacts.reduce((n,t)=>n+(t[key]??0),0):sum(key);
    const eligible_ids = unique('eligible_unit_ids','eligible_ids'), leaked_ids = unique('leaked_unit_ids','leaked_ids');
    const anchorTotal=metric('anchor_total'),spanTotal=metric('span_total'),goldTotal=metric('gold_source_total');
    return { ...first,...unions,artifact_traces:artifacts, class:familyOnly?'all':first.class, sessions: unique('session_ids','sessions'), targets: unique('target_ids','targets'), planted_ids: unique('planted_unit_ids','planted_ids'), residual_before_gate: unique('residual_unit_ids','residual_before_gate'),
      gate_eligible_sessions: unique('eligible_session_ids','gate_eligible_sessions'), eligible_ids, leaked_ids, artifact_leak_rate: rate(leaked_ids,eligible_ids),
      anchor_retained_count:metric('anchor_retained_count'),anchor_coverage_count:metric('anchor_coverage_count'),anchor_total:anchorTotal,valid_span_count:metric('valid_span_count'),span_total:spanTotal,gold_source_hits:metric('gold_source_hits'),gold_source_total:goldTotal,
      anchor_retention:rate(metric('anchor_retained_count'),anchorTotal),anchor_coverage:rate(metric('anchor_coverage_count'),anchorTotal),span_validity:rate(metric('valid_span_count'),spanTotal),gold_source_turn_hit:rate(metric('gold_source_hits'),goldTotal),
      blocked: metric('blocked'), abstained: metric('abstained'), downloadable: metric('downloadable'), decoy_false_redactions: metric('decoy_false_redactions'),
      mutations_caught: sum('mutations_caught'), mutations_total: sum('mutations_total'), status: group.every(r=>r.status==='not_run') ? 'not_run' : group.every(r=>r.status==='NA') ? 'NA' : 'ok' };
  });
}
