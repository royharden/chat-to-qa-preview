// candidateTurns() / modelViewTurns(): only included user/assistant turns; preamble and details absent (K3, D10).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importChatFile } from '../../src/lib/adapters/index.ts';
import type { ChatSessionV1 } from '../../src/lib/schema/chatSession.ts';
import { candidateTurns, modelViewTurns } from '../../src/lib/session/views.ts';
import { FIXTURES } from './recipes.ts';

const session: ChatSessionV1 = {
  schema_version: 's47.chat.v1',
  turns: [
    { id: 't1', role: 'user', text: 'q1' },
    { id: 't2', role: 'thinking', text: 'thinking' },
    { id: 't3', role: 'tool', text: 'tool' },
    { id: 't4', role: 'assistant', text: 'a1' },
    { id: 't5', role: 'user', text: 'q2' },
    { id: 't6', role: 'assistant', text: 'a2' },
  ],
};

const views: Array<[string, typeof candidateTurns]> = [
  ['candidateTurns', candidateTurns],
  ['modelViewTurns', modelViewTurns],
];

describe.each(views)('%s', (_name, view) => {
  it('returns only user and assistant turns, in order', () => {
    expect(view(session, new Set()).map((t) => t.id)).toEqual(['t1', 't4', 't5', 't6']);
  });

  it('drops turns excluded in import review', () => {
    expect(view(session, new Set(['t4', 't5'])).map((t) => t.id)).toEqual(['t1', 't6']);
  });

  it('never yields tool or thinking text', () => {
    const text = view(session, new Set()).map((t) => t.text).join('\n');
    expect(text).not.toContain('thinking');
    expect(text).not.toContain('tool');
  });

  it('returns a frozen array and does not change the session', () => {
    const out = view(session, new Set());
    expect(Object.isFrozen(out)).toBe(true);
    expect(session.turns).toHaveLength(6);
  });

  it('preamble and <details> text of a Markdown import never appear', () => {
    const out = importChatFile(new Uint8Array(readFileSync(join(FIXTURES, 'accept', 'basic.md'))), 'basic.md');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const text = view(out.session, new Set()).map((t) => t.text).join('\n');
    expect(text).not.toContain('Provenance');
    expect(text).not.toContain('tool output that is dropped');
    expect(text).not.toContain('Tool: read_file');
  });

  it('tool and thinking turns from a JSON import never appear', () => {
    const out = importChatFile(new Uint8Array(readFileSync(join(FIXTURES, 'accept', 'session.json'))), 'session.json');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const turns = view(out.session, new Set());
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant']);
    expect(turns.map((t) => t.text).join('\n')).not.toContain('never reaches candidates');
  });
});
