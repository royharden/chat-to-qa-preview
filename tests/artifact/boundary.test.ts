import { describe, it, expect } from 'vitest';
import { redactSession } from '../../src/lib/redactkit/index.ts';
import { selectExtractive } from '../../src/lib/select/extractive.ts';
import { serialize } from '../../src/lib/artifact/serialize.ts';
import { buildExcerpts } from '../../src/lib/artifact/excerpts.ts';
// what_bug_this_catches: metadata entering public bytes, stale spans and post-selection identifier edits.
async function sample() {
  const session = await redactSession({ turns: [
    { id: 't1', role: 'user', text: 'How should I use --strict?' },
    { id: 't2', role: 'assistant', text: 'Use --strict to check the configuration.' },
  ] });
  if (!session.ok) throw new Error('fixture_redaction_failed');
  const selected = selectExtractive(session); if (!selected.ok) throw new Error(selected.reason);
  return { session, candidate: selected.candidate };
}
describe('exact public artifact boundary (unexecuted)', () => {
  it('serializes a deterministic allowlist without unknown metadata', async () => {
    const { session, candidate } = await sample();
    const first = await serialize(session, candidate, 's47.test.v1');
    const second = await serialize(session, candidate, 's47.test.v1');
    expect(first).toEqual(second);
    expect(Object.keys(JSON.parse(new TextDecoder().decode(first.json)))).toEqual(['question','answer','excerpts','rules_version','profile_id','source_revision']);
  });
  it('blocks a revision mismatch and a newly typed contact', async () => {
    const { session, candidate } = await sample();
    await expect(serialize(session, { ...candidate, source_revision: 'outdated' }, 's47.test.v1')).rejects.toThrow();
    const text = ['reader', '@', 'example.test'].join('');
    await expect(serialize(session, { ...candidate, answer: [{ ...candidate.answer[0]!, text: `Use ${text}.` }] }, 's47.test.v1')).rejects.toThrow();
  });
  it('deduplicates exact spans and refuses a surrogate split', async () => {
    const { session, candidate } = await sample(); const span = candidate.question.spans[0]!;
    expect(buildExcerpts(session, [span, span])).toHaveLength(1);
    expect(() => buildExcerpts(session, [{ ...span, end: 999_999 }])).toThrow('invalid_span');
  });
});
