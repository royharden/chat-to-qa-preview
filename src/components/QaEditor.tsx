import type { QaCandidate } from '../lib/select/types.ts';
import type { RedactedSession } from '../lib/redactkit/index.ts';
import { checkCandidate } from '../lib/spanground/index.ts';
export function QaEditor({ candidate, session, changed }: { candidate: QaCandidate; session: RedactedSession; changed(value: QaCandidate): void }) {
  const check = checkCandidate(session, candidate);
  return <section><h2>4. Edit the Q&amp;A</h2><p>Grounding label: lexical-only. Negation, relations and paraphrases can pass this check; review them yourself.</p>
    <label>Question<textarea value={candidate.question.text} onChange={e => changed({ ...candidate, question: { ...candidate.question, text: e.target.value } })} /></label>
    {[candidate.question, ...candidate.answer].map((b, i) => <article key={i}>{i > 0 && <label>Answer block {i}<textarea value={b.text} onChange={e => changed({ ...candidate, answer: candidate.answer.map((old, n) => n === i - 1 ? { ...old, text: e.target.value } : old) })} /></label>}
      <label>Citations (JSON span array)<textarea aria-label={`Citations ${i}`} value={JSON.stringify(b.spans)} onChange={e => {
        try { const spans: unknown = JSON.parse(e.target.value); if (!Array.isArray(spans) || !spans.every(s => s && typeof s === 'object' && typeof s.turn_id === 'string'
          && typeof s.source_revision === 'string' && Number.isInteger(s.start) && Number.isInteger(s.end))) return;
          // Fields are validated by the grounding gate before serialization. Editing never grants approval.
          const next = { ...b, spans: spans as typeof b.spans };
          changed(i === 0 ? { ...candidate, question: next } : { ...candidate, answer: candidate.answer.map((old, n) => n === i - 1 ? next : old) });
        } catch { /* Keep the last valid JSON. */ }
      }} /></label></article>)}
    <p role="status">{check.ok ? 'Lexical checks passed; human review still required.' : `Export blocked: ${check.reasons.join(', ')}`}</p></section>;
}
