// JSON adapter (s47.chat.v1) and adapter routing. Inputs are synthetic; nothing is secret-shaped.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFUSAL, WARNING, importChatFile, parseChatSessionJson } from '../../src/lib/adapters/index.ts';
import type { ImportAccepted, ImportOutcome, RefusalCode } from '../../src/lib/adapters/index.ts';
import { FIXTURES, utf8 } from './recipes.ts';

function ok(out: ImportOutcome): ImportAccepted {
  if (!out.ok) throw new Error(`expected acceptance, got ${out.refusal}`);
  return out;
}

function refusedWith(out: ImportOutcome, code: RefusalCode): void {
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.refusal).toBe(code);
}

type WireTurn = { id: string; role: string; text: string };
const session = (turns: WireTurn[], extra: Record<string, unknown> = {}): Uint8Array =>
  utf8(JSON.stringify({ schema_version: 's47.chat.v1', turns, ...extra }));
const pair = (): WireTurn[] => [
  { id: 'q', role: 'user', text: 'How do I clear it?' },
  { id: 'r', role: 'assistant', text: 'Delete the folder.' },
];

describe('accept fixtures', () => {
  it('session.json: title discarded, wire ids regenerated, tool/thinking kept with their roles, CRLF normalised', () => {
    const out = ok(parseChatSessionJson(new Uint8Array(readFileSync(join(FIXTURES, 'accept', 'session.json')))));
    expect(out.session.turns.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(out.session.turns.map((t) => t.role)).toEqual(['user', 'thinking', 'tool', 'assistant']);
    expect(out.session.turns[3]?.text).toBe('Add an engines field to package.json.\nThen run the install again.');
    const dump = JSON.stringify(out);
    expect(dump).not.toContain('Synthetic title');
    expect(dump).not.toContain('u-1');
    expect(dump).not.toContain('tool-1');
    expect(Object.keys(out.session).sort()).toEqual(['schema_version', 'turns']);
  });

  it('bom.json.txt: a leading BOM is removed with a warning', () => {
    const out = ok(parseChatSessionJson(new Uint8Array(readFileSync(join(FIXTURES, 'accept', 'bom.json.txt')))));
    expect(out.review.warnings).toEqual([WARNING.BOM_REMOVED]);
    expect(out.session.turns).toHaveLength(2);
  });
});

describe('refusals', () => {
  it('invalid JSON, wrong version, unknown key, unknown role and unsafe id are unknown_json_shape', () => {
    refusedWith(parseChatSessionJson(utf8('{"schema_version":')), REFUSAL.UNKNOWN_JSON_SHAPE);
    refusedWith(parseChatSessionJson(utf8(JSON.stringify({ schema_version: 's47.chat.v2', turns: pair() }))), REFUSAL.UNKNOWN_JSON_SHAPE);
    refusedWith(parseChatSessionJson(session(pair(), { file_name: 'x' })), REFUSAL.UNKNOWN_JSON_SHAPE);
    refusedWith(parseChatSessionJson(session([...pair(), { id: 's', role: 'system', text: 'x' }])), REFUSAL.UNKNOWN_JSON_SHAPE);
    refusedWith(parseChatSessionJson(session([{ id: 'a b', role: 'user', text: 'x' }, ...pair()])), REFUSAL.UNKNOWN_JSON_SHAPE);
    refusedWith(
      parseChatSessionJson(utf8(JSON.stringify({ schema_version: 's47.chat.v1', turns: [{ id: 'q', role: 'user', text: 'x', at: 1 }] }))),
      REFUSAL.UNKNOWN_JSON_SHAPE,
    );
  });

  it('duplicate wire ids', () => {
    refusedWith(parseChatSessionJson(session([...pair(), { id: 'q', role: 'user', text: 'again' }])), REFUSAL.DUPLICATE_TURN_ID);
  });

  it('control characters, lone CR and unpaired surrogates in text', () => {
    refusedWith(parseChatSessionJson(session([...pair(), { id: 'c', role: 'user', text: 'bell \u0007' }])), REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
    refusedWith(parseChatSessionJson(session([...pair(), { id: 'c', role: 'user', text: 'a\rb' }])), REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
    const loneSurrogate = '{"schema_version":"s47.chat.v1","turns":[{"id":"q","role":"user","text":"x \\ud800 y"},' +
      '{"id":"r","role":"assistant","text":"ok"}]}';
    refusedWith(parseChatSessionJson(utf8(loneSurrogate)), REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
    refusedWith(parseChatSessionJson(new Uint8Array([0x7b, 0xff, 0x7d])), REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
  });

  it('caps: turns, per-turn length, total length', () => {
    const many: WireTurn[] = Array.from({ length: 2001 }, (_, i) => ({ id: `w${i}`, role: i % 2 === 0 ? 'user' : 'assistant', text: 'x' }));
    refusedWith(parseChatSessionJson(session(many)), REFUSAL.TOO_MANY_TURNS);
    refusedWith(parseChatSessionJson(session([...pair(), { id: 'l', role: 'assistant', text: 'y'.repeat(100_001) }])), REFUSAL.TURN_TOO_LONG);
    const big: WireTurn[] = Array.from({ length: 41 }, (_, i) => ({ id: `b${i}`, role: i % 2 === 0 ? 'user' : 'assistant', text: 'z'.repeat(99_000) }));
    refusedWith(parseChatSessionJson(session(big)), REFUSAL.TOTAL_TOO_LONG);
  });

  it('needs a non-empty user and a non-empty assistant turn', () => {
    refusedWith(parseChatSessionJson(session([])), REFUSAL.NO_USER_OR_ASSISTANT);
    refusedWith(
      parseChatSessionJson(session([{ id: 'q', role: 'user', text: 'x' }, { id: 'r', role: 'assistant', text: ' \n\t' }])),
      REFUSAL.NO_USER_OR_ASSISTANT,
    );
  });

  it('an HTML document is html_export', () => {
    refusedWith(parseChatSessionJson(utf8('<!DOCTYPE html><html></html>')), REFUSAL.HTML_EXPORT);
  });
});

describe('importChatFile routing', () => {
  const json = session(pair());
  it('routes .json and content starting with { (no Markdown extension) to the JSON adapter', () => {
    expect(ok(importChatFile(json, 'chat.json')).review.format).toBe('chat-session-json');
    expect(ok(importChatFile(json)).review.format).toBe('chat-session-json');
    expect(ok(importChatFile(json, 'chat.txt')).review.format).toBe('chat-session-json');
  });
  it('routes .md to the Markdown adapter even when the content starts with {', () => {
    refusedWith(importChatFile(json, 'chat.md'), REFUSAL.NO_ROLE_HEADING);
  });
  it('refuses .html and .htm by name', () => {
    refusedWith(importChatFile(utf8('anything'), 'index.html'), REFUSAL.HTML_EXPORT);
    refusedWith(importChatFile(utf8('anything'), 'PAGE-001.HTM'), REFUSAL.HTML_EXPORT);
  });
  it('never puts the file name into the result', () => {
    expect(JSON.stringify(importChatFile(json, 'FileNameMarkerWq.json'))).not.toContain('FileNameMarkerWq');
  });
});
