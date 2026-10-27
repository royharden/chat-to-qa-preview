// Every refusal code: exactly one constant in src/, exactly one fixture, and the fixture is refused with that code.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFUSAL_CODES, importChatFile } from '../../src/lib/adapters/index.ts';
import { LIMITS } from '../../src/lib/schema/chatSession.ts';
import { FIXTURES, REPO_ROOT, expandRecipe, expandRecipeText, loadRecipe } from './recipes.ts';

const dir = join(FIXTURES, 'refusals');
const files = readdirSync(dir).sort();
const fixturesFor = (code: string): string[] => files.filter((f) => f.startsWith(`${code}.`));

function loadFixture(name: string): { bytes: Uint8Array; fileName: string } {
  if (name.endsWith('.recipe.json')) {
    const recipe = loadRecipe(join(dir, name));
    return { bytes: expandRecipe(recipe), fileName: recipe.fileName };
  }
  return { bytes: new Uint8Array(readFileSync(join(dir, name))), fileName: name };
}

describe('refusal codes', () => {
  it('has 14 distinct codes', () => {
    expect(REFUSAL_CODES).toHaveLength(14);
    expect(new Set(REFUSAL_CODES).size).toBe(14);
  });

  it('defines each code string exactly once in src/', () => {
    const srcDir = join(REPO_ROOT, 'src');
    const sources = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
      .filter((p) => /\.tsx?$/.test(p))
      .map((p) => readFileSync(join(srcDir, p), 'utf8'))
      .join('\n');
    for (const code of REFUSAL_CODES) {
      const count = sources.split(`'${code}'`).length - 1 + (sources.split(`"${code}"`).length - 1);
      expect(count, code).toBe(1);
    }
  });

  it('has exactly one fixture per code and no fixture without a code', () => {
    for (const code of REFUSAL_CODES) expect(fixturesFor(code), code).toHaveLength(1);
    for (const f of files) expect(REFUSAL_CODES.some((c) => f.startsWith(`${c}.`)), f).toBe(true);
  });

  for (const code of REFUSAL_CODES) {
    it(`refuses the ${code} fixture with ${code}`, () => {
      const name = fixturesFor(code)[0];
      expect(name).toBeDefined();
      if (name === undefined) return;
      const { bytes, fileName } = loadFixture(name);
      const out = importChatFile(bytes, fileName);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.refusal).toBe(code);
    });
  }
});

describe('size recipes', () => {
  const recipe = (code: string) => loadRecipe(join(dir, `${code}.recipe.json`));

  it('oversize_file expands past 5 MiB', () => {
    const r = recipe('oversize_file');
    expect(r.code).toBe('oversize_file');
    expect(expandRecipe(r).byteLength).toBeGreaterThan(LIMITS.maxFileBytes);
  });

  it('too_many_turns expands past 2,000 role headings and stays small', () => {
    const r = recipe('too_many_turns');
    const text = expandRecipeText(r);
    expect(text.split('\n## ').length + (text.startsWith('## ') ? 0 : -1)).toBeGreaterThan(LIMITS.maxTurns);
    expect(expandRecipe(r).byteLength).toBeLessThan(LIMITS.maxFileBytes);
  });

  it('turn_too_long has one turn past 100,000 units and is otherwise within caps', () => {
    const text = expandRecipeText(recipe('turn_too_long'));
    const longest = Math.max(...text.split('\n').map((l) => l.length));
    expect(longest).toBeGreaterThan(LIMITS.maxTurnUnits);
    expect(text.length).toBeLessThan(LIMITS.maxTotalUnits);
  });

  it('total_too_long passes file and per-turn caps but exceeds the total cap', () => {
    const r = recipe('total_too_long');
    const text = expandRecipeText(r);
    expect(expandRecipe(r).byteLength).toBeLessThanOrEqual(LIMITS.maxFileBytes);
    expect(Math.max(...text.split('\n').map((l) => l.length))).toBeLessThanOrEqual(LIMITS.maxTurnUnits);
    expect(text.length).toBeGreaterThan(LIMITS.maxTotalUnits);
  });
});
