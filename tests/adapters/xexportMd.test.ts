// D10 steps 1-7 and K19 for profile xexport-md/doc-2026-10. Inputs are synthetic; nothing is secret-shaped.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFUSAL, WARNING, XEXPORT_MD_PROFILE_ID, parseXexportMd } from '../../src/lib/adapters/index.ts';
import type { ImportAccepted, ImportOutcome, RefusalCode } from '../../src/lib/adapters/index.ts';
import { ASSISTANT, CURSOR, FIXTURES, USER, lines, utf8 } from './recipes.ts';

const accept = (name: string): ImportOutcome => parseXexportMd(new Uint8Array(readFileSync(join(FIXTURES, 'accept', name))));
const parse = (text: string): ImportOutcome => parseXexportMd(utf8(text));

function ok(out: ImportOutcome): ImportAccepted {
  if (!out.ok) throw new Error(`expected acceptance, got ${out.refusal}`);
  return out;
}

function refusedWith(out: ImportOutcome, code: RefusalCode): void {
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.refusal).toBe(code);
}

/** A minimal valid session with `extra` lines appended inside the assistant turn. */
const withAssistantLines = (...extra: string[]): string =>
  lines(USER, '', 'How do I run it?', '', ASSISTANT, '', 'Run the script.', ...extra, '', CURSOR);

describe('accept fixtures', () => {
  it('basic.md: turns, ids, fences before headings, details and preamble dropped, cursor stripped', () => {
    const out = ok(accept('basic.md'));
    const turns = out.session.turns;
    expect(turns.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    const t2 = turns[1]?.text ?? '';
    expect(t2).toContain('## Notes inside an answer');
    expect(t2).toContain('## 👤 User'); // inside a fence: content, not a heading
    expect(t2).toContain('<div>inside a fence this is content</div>');
    expect(t2).toContain('mid-line <b>tag</b> mention');
    expect(t2).not.toContain('tool output that is dropped');
    expect(t2).not.toContain('<details>');
    expect(t2.endsWith('Then run the build again.')).toBe(true);
    const all = turns.map((t) => t.text).join('\n');
    expect(all).not.toContain('Synthetic session');
    expect(all).not.toContain('Provenance');
    expect(all).not.toContain('xexport-cursor');
    expect(out.review.preamble).toContain('Provenance');
    expect(out.review.turns[1]?.droppedDetails).toHaveLength(1);
    expect(out.review.turns[1]?.droppedDetails[0]).toContain('tool output that is dropped');
    expect(out.review.warnings).toEqual([]);
    expect(out.review.profileId).toBe(XEXPORT_MD_PROFILE_ID);
  });

  it('basic.crlf.md parses to exactly the same session as basic.md', () => {
    expect(ok(accept('basic.crlf.md')).session).toEqual(ok(accept('basic.md')).session);
  });

  it('fences.md: headings, comments and details inside fences are content; missing cursor warns', () => {
    const out = ok(accept('fences.md'));
    expect(out.session.turns).toHaveLength(2);
    const t2 = out.session.turns[1]?.text ?? '';
    expect(t2).toContain('## 🔧 Tool');
    expect(t2).toContain('<!-- a comment -->');
    expect(t2).toContain('<details>');
    expect(t2).toContain('a shorter backtick run does not close a longer fence');
    expect(out.review.warnings).toEqual([WARNING.MISSING_CURSOR_LINE]);
  });

  it('preamble.md: role-like headings and raw HTML in the preamble are not refused and are dropped', () => {
    const out = ok(accept('preamble.md'));
    expect(out.session.turns.map((t) => t.role)).toEqual(['user', 'assistant']);
    expect(out.review.preamble).toContain('<div>');
    const all = out.session.turns.map((t) => t.text).join('\n');
    expect(all).not.toContain('<div>');
    expect(all).not.toContain('Tool notes');
    expect(all).not.toContain('a preamble comment');
  });
});

describe('step 1: encoding, BOM, CRLF, control characters, HTML documents', () => {
  it('refuses invalid UTF-8', () => {
    refusedWith(parseXexportMd(new Uint8Array([0x23, 0x20, 0xff, 0x0a])), REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
  });
  it('refuses a lone CR after CRLF normalisation', () => {
    refusedWith(parse(withAssistantLines('a\rb')), REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
  });
  it('refuses C0, DEL and C1 control characters but accepts tab', () => {
    refusedWith(parse(withAssistantLines('bell \u0007')), REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
    refusedWith(parse(withAssistantLines('del \u007f')), REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
    refusedWith(parse(withAssistantLines('c1 \u0085')), REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
    ok(parse(withAssistantLines('tab\there')));
  });
  it('removes a leading BOM with a warning', () => {
    const out = ok(parse('﻿' + withAssistantLines()));
    expect(out.review.warnings).toContain(WARNING.BOM_REMOVED);
  });
  it('refuses an HTML document as html_export', () => {
    refusedWith(parse('<!doctype html>\n<html><body></body></html>\n'), REFUSAL.HTML_EXPORT);
    refusedWith(parse('\n  <html lang="en">\n</html>\n'), REFUSAL.HTML_EXPORT);
  });
});

describe('step 2: cursor line', () => {
  it('strips a final cursor line even when followed by blank lines', () => {
    const out = ok(parse(withAssistantLines() + '\n\n'));
    expect(out.review.warnings).toEqual([]);
  });
  it('a cursor-like comment that is not the final line is raw HTML inside a turn', () => {
    refusedWith(parse(withAssistantLines(CURSOR, '', 'more text')), REFUSAL.RAW_HTML_OUTSIDE_DETAILS);
  });
});

describe('step 3: fences', () => {
  it('refuses an unclosed fence', () => {
    refusedWith(parse(lines(USER, '', 'q', '', ASSISTANT, '', '```', 'code')), REFUSAL.UNBALANCED_FENCE);
  });
  it('a fence closes only with the same character and at least the same length', () => {
    refusedWith(parse(lines(USER, '', 'q', '', ASSISTANT, '', '````', '```', '~~~~')), REFUSAL.UNBALANCED_FENCE);
  });
  it('a role heading inside a fence never starts a turn', () => {
    const out = ok(parse(withAssistantLines('```', USER, '```')));
    expect(out.session.turns).toHaveLength(2);
  });
});

describe('step 4: details', () => {
  it('drops a one-line details region', () => {
    const out = ok(parse(withAssistantLines('<details><summary>Tool</summary>dropped text</details>')));
    expect(out.session.turns[1]?.text).not.toContain('dropped text');
  });
  it('refuses an unclosed details region', () => {
    refusedWith(parse(withAssistantLines('<details>', 'never closed')), REFUSAL.NESTED_OR_UNBALANCED_DETAILS);
  });
  it('refuses a stray closing tag at a line start', () => {
    refusedWith(parse(withAssistantLines('</details>')), REFUSAL.NESTED_OR_UNBALANCED_DETAILS);
  });
  it('refuses nesting, including a mid-line opening tag inside a region', () => {
    refusedWith(
      parse(withAssistantLines('<details>', 'text <details> more', '</details>')),
      REFUSAL.NESTED_OR_UNBALANCED_DETAILS,
    );
  });
  it('a role-like heading inside details is dropped, not refused', () => {
    const out = ok(parse(withAssistantLines('<details>', '## 🔧 Tool', '</details>')));
    expect(out.session.turns[1]?.text).not.toContain('Tool');
  });
  it('details inside a fence are content', () => {
    const out = ok(parse(withAssistantLines('```', '<details>', '```')));
    expect(out.session.turns[1]?.text).toContain('<details>');
  });
});

describe('step 5 / K19: role headings', () => {
  const refusedHeadings: string[] = [
    '## 👤User',
    '##  👤 User',
    '##\t👤 User',
    '## 👤 user',
    '## 👤 User ##',
    '## 🤖',
    '## 🤖x',
    '## 🤖 ' + 'x'.repeat(81),
    '## 🔧 Tool',
    '  ## 🔧 Tool',
  ];
  for (const heading of refusedHeadings) {
    it(`refuses ${JSON.stringify(heading)} after the first heading`, () => {
      refusedWith(parse(withAssistantLines('', heading, 'x')), REFUSAL.UNKNOWN_ROLE_HEADING);
    });
  }
  it('accepts an 80-character assistant label and trailing spaces on the user heading', () => {
    const out = ok(parse(lines(USER + '  ', '', 'q', '', '## 🤖 ' + 'x'.repeat(80), '', 'a')));
    expect(out.session.turns.map((t) => t.role)).toEqual(['user', 'assistant']);
  });
  it('discards the assistant label entirely', () => {
    const out = ok(parse(lines(USER, '', 'q', '', '## 🤖 LabelMarkerZq', '', 'a')));
    expect(JSON.stringify(out)).not.toContain('LabelMarkerZq');
  });
  it('a plain ## heading without an emoji is content', () => {
    const out = ok(parse(withAssistantLines('## Plain heading')));
    expect(out.session.turns[1]?.text).toContain('## Plain heading');
  });
  it('refuses a file with no accepted role heading', () => {
    refusedWith(parse(lines('# Title', '', '## 🔧 Tool', 'text')), REFUSAL.NO_ROLE_HEADING);
  });
  it('refuses a session without a non-empty assistant turn', () => {
    refusedWith(parse(lines(USER, '', 'q', '', ASSISTANT, '', '   ')), REFUSAL.NO_USER_OR_ASSISTANT);
  });
});

describe('step 5 / K19: raw HTML outside details', () => {
  const refused: string[] = [
    '<div>',
    '<div class="x">text',
    '   <p>',
    '<!-- note -->',
    '<?xml version="1.0"?>',
    '<!DOCTYPE note>',
    '<![CDATA[x]]>',
    '<script>',
    '<style type="text/css">',
    '<summary>outside details</summary>',
    '<custom-tag data-x="1" flag>',
    '<custom-tag/>',
    '</span>',
  ];
  for (const line of refused) {
    it(`refuses ${JSON.stringify(line)}`, () => {
      refusedWith(parse(withAssistantLines(line)), REFUSAL.RAW_HTML_OUTSIDE_DETAILS);
    });
  }
  const allowed: string[] = [
    'text with <b>inline</b> tag',
    '    <div> (indented four spaces)',
    '<a href="x">link</a> then text',
    '<3 hearts',
    '< not a tag',
  ];
  for (const line of allowed) {
    it(`keeps ${JSON.stringify(line)} as text`, () => {
      ok(parse(withAssistantLines(line)));
    });
  }
});

describe('ids and preamble', () => {
  it('regenerates ids t1..tN in document order', () => {
    const out = ok(parse(lines(USER, '', 'a', '', ASSISTANT, '', 'b', '', USER, '', 'c', '', ASSISTANT, '', 'd')));
    expect(out.session.turns.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
  });
  it('keeps the preamble out of every turn', () => {
    const out = ok(parse(lines('PreambleMarkerQx', '', USER, '', 'q', '', ASSISTANT, '', 'a')));
    expect(JSON.stringify(out.session)).not.toContain('PreambleMarkerQx');
    expect(out.review.preamble).toContain('PreambleMarkerQx');
  });
});
