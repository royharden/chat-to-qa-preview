// ChatSessionV1 (canonical) and ChatSessionV1Json (wire) zod schemas: strict keys, K3 roles, K4 caps.
import { describe, expect, it } from 'vitest';
import { ChatSessionV1, ChatSessionV1Json, LIMITS, ROLES } from '../../src/lib/schema/chatSession.ts';

const base = () => ({
  schema_version: 's47.chat.v1',
  turns: [
    { id: 't1', role: 'user', text: 'q' },
    { id: 't2', role: 'assistant', text: 'a' },
  ],
});

describe('ChatSessionV1', () => {
  it('declares exactly the K3 roles and the K4 caps', () => {
    expect([...ROLES]).toEqual(['user', 'assistant', 'tool', 'thinking']);
    expect(LIMITS).toEqual({ maxFileBytes: 5 * 1024 * 1024, maxTurns: 2000, maxTurnUnits: 100_000, maxTotalUnits: 4_000_000 });
  });

  it('accepts a minimal session and tool/thinking turns', () => {
    expect(ChatSessionV1.safeParse(base()).success).toBe(true);
    const s = base();
    s.turns.push({ id: 't3', role: 'tool', text: 'x' }, { id: 't4', role: 'thinking', text: 'y' });
    expect(ChatSessionV1.safeParse(s).success).toBe(true);
  });

  it('is strict: no title, no extra keys on the session or a turn', () => {
    expect(ChatSessionV1.safeParse({ ...base(), title: 't' }).success).toBe(false);
    const s = base();
    expect(ChatSessionV1.safeParse({ ...s, turns: [{ ...s.turns[0], label: 'x' }, s.turns[1]] }).success).toBe(false);
  });

  it('rejects unknown roles, non-canonical or out-of-order ids', () => {
    const s = base();
    expect(ChatSessionV1.safeParse({ ...s, turns: [{ ...s.turns[0], role: 'system' }, s.turns[1]] }).success).toBe(false);
    expect(ChatSessionV1.safeParse({ ...s, turns: [{ ...s.turns[0], id: 't01' }, s.turns[1]] }).success).toBe(false);
    expect(ChatSessionV1.safeParse({ ...s, turns: [s.turns[1], s.turns[0]] }).success).toBe(false);
  });

  it('enforces per-turn, total and turn-count caps', () => {
    const s = base();
    expect(ChatSessionV1.safeParse({ ...s, turns: [s.turns[0], { id: 't2', role: 'assistant', text: 'x'.repeat(100_001) }] }).success).toBe(false);
    const big = Array.from({ length: 41 }, (_, i) => ({ id: `t${i + 1}`, role: i % 2 === 0 ? 'user' : 'assistant', text: 'x'.repeat(99_000) }));
    expect(ChatSessionV1.safeParse({ schema_version: 's47.chat.v1', turns: big }).success).toBe(false);
    const many = Array.from({ length: 2001 }, (_, i) => ({ id: `t${i + 1}`, role: i % 2 === 0 ? 'user' : 'assistant', text: 'x' }));
    expect(ChatSessionV1.safeParse({ schema_version: 's47.chat.v1', turns: many }).success).toBe(false);
  });

  it('rejects control characters and needs a non-empty user and assistant turn', () => {
    const s = base();
    expect(ChatSessionV1.safeParse({ ...s, turns: [{ ...s.turns[0], text: 'a\u0000b' }, s.turns[1]] }).success).toBe(false);
    expect(ChatSessionV1.safeParse({ ...s, turns: [s.turns[0], { id: 't2', role: 'tool', text: 'a' }] }).success).toBe(false);
  });
});

describe('ChatSessionV1Json (wire)', () => {
  it('accepts an optional title and safe wire ids, rejects unknown keys', () => {
    const wire = { schema_version: 's47.chat.v1', title: 'x', turns: [{ id: 'msg-1.a:b', role: 'user', text: 'q' }] };
    expect(ChatSessionV1Json.safeParse(wire).success).toBe(true);
    expect(ChatSessionV1Json.safeParse({ ...wire, workspace: 'w' }).success).toBe(false);
    expect(ChatSessionV1Json.safeParse({ ...wire, turns: [{ id: '', role: 'user', text: 'q' }] }).success).toBe(false);
  });
});
