import type { PreviewState } from '../lib/state/session.ts';
export function ImportReview({ state, toggle, confirm }: { state: PreviewState; toggle(id: string): void; confirm(): void }) {
  const imported = state.imported;
  if (!imported) return null;
  return <section><h2>1. Confirm the imported roles</h2><p>Speaker provenance is unauthenticated. Unwrapped tool text may look like an assistant reply. Prefer a brief export.</p>
    <details><summary>Dropped metadata and details (review only)</summary><pre>{imported.review.preamble}</pre>{imported.review.turns.flatMap(t => t.droppedDetails).map((s, i) => <pre key={i}>{s}</pre>)}</details>
    {imported.session.turns.map(t => <article key={t.id}><label><input type="checkbox" checked={!state.excluded.has(t.id)} onChange={() => toggle(t.id)} />Include {t.id} · {t.role}</label><pre>{t.text}</pre></article>)}
    <button onClick={confirm} disabled={state.importConfirmed}>Confirm these roles and exclusions</button></section>;
}
