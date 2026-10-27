// K24: FREEZE.json pins the SHA-256 of both baselines; K20/M1: baselines are reachable only from leakeval.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../adapters/recipes.ts';

const freeze = JSON.parse(readFileSync(join(REPO_ROOT, 'src/lib/baselines/FREEZE.json'), 'utf8')) as {
  files: Record<string, string>;
};

describe('FREEZE.json', () => {
  it('lists exactly the two baselines', () => {
    expect(Object.keys(freeze.files).sort()).toEqual(['src/lib/baselines/noRedaction.ts', 'src/lib/baselines/regexOnly.ts']);
  });

  for (const [path, hash] of Object.entries(freeze.files)) {
    it(`${path} matches its pinned sha256`, () => {
      expect(createHash('sha256').update(readFileSync(join(REPO_ROOT, path))).digest('hex')).toBe(hash);
    });
  }
});

const IMPORT_SPEC = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(REPO_ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((p) => /\.(?:ts|tsx|mts)$/.test(p))
    .map((p) => `${dir}/${p.replace(/\\/g, '/')}`);
}

function specifiers(path: string): string[] {
  return [...readFileSync(join(REPO_ROOT, path), 'utf8').matchAll(IMPORT_SPEC)].map((m) => m[1] ?? '');
}

describe('baseline reachability (static import graph)', () => {
  const src = sourceFiles('src');

  it('only src/lib/leakeval/ imports baselines', () => {
    for (const f of src) {
      if (f.startsWith('src/lib/leakeval/') || f.startsWith('src/lib/baselines/')) continue;
      expect(specifiers(f).filter((s) => s.includes('baselines')), f).toEqual([]);
    }
  });

  it('nothing in src/ outside leakeval imports leakeval, and src/ never imports scripts/', () => {
    for (const f of src) {
      if (!f.startsWith('src/lib/leakeval/')) expect(specifiers(f).filter((s) => s.includes('leakeval')), f).toEqual([]);
      expect(specifiers(f).filter((s) => s.includes('scripts/')), f).toEqual([]);
    }
  });

  it('the baselines import nothing (in particular nothing from redactkit)', () => {
    for (const f of src.filter((p) => p.startsWith('src/lib/baselines/'))) expect(specifiers(f), f).toEqual([]);
  });
});
