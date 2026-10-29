import type { RedactedSession } from '../lib/redactkit/index.ts';
export function RedactionReview({ session, enabled, busy, redact, manual }: { session: RedactedSession | null; enabled: boolean; busy: boolean; redact(): void; manual(turnId: string, start: number, end: number): void }) {
  return <section><h2>3. Redact and inspect</h2><button disabled={!enabled || busy} onClick={redact}>Redact included turns</button>
    <p>Review every remaining identifier. Redaction has known misses and is not a privacy guarantee.</p>
    {session?.turns.map(t => <article key={t.id}><h3>{t.id} · {t.role}</h3><pre>{t.text}</pre></article>)}
    {session && <p>To remove more text, update the names list and redact again. Manual source spans below use original UTF-16 offsets.</p>}
    {enabled && <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); manual(String(data.get('turn')), Number(data.get('start')), Number(data.get('end'))); }}>
      <label>Source turn <input name="turn" required pattern="t[1-9][0-9]*" /></label><label>Start <input name="start" type="number" min="0" required /></label><label>End <input name="end" type="number" min="1" required /></label><button disabled={busy}>Redact source span</button></form>}
  </section>;
}
