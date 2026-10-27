import { describe, expect, it } from 'vitest';
import { containsToken, extractCheckable } from '../../src/lib/spanground/extract.ts';

describe('checkable technical token inventory (D3)', () => {
  it.each(['42', 'v5.4.2', '--max-old-space-size', 'NODE_OPTIONS', 'cli-tool', 'snake_case', 'vite.config.ts', '/usr/lib/x', 'https://example.test/a', 'person@example.test', 'a1b2c3d4', 'build7', '[EMAIL_1]'])('extracts %s whole', (token) => {
    expect(extractCheckable(`Use ${token}.`)).toContain(token);
  });
  it('treats inline code as checkable even when it is a plain word', () => {
    expect(extractCheckable('Use `cache`.')).toContain('cache');
    expect(extractCheckable('The cache is helpful.')).toEqual([]);
  });
  it('does not accept token prefixes or suffixes as cited evidence', () => {
    expect(containsToken('build70', 'build7')).toBe(false);
    expect(containsToken('--max-old-space-size-extra', '--max-old-space-size')).toBe(false);
    expect(containsToken('other-vite.config.ts', 'vite.config.ts')).toBe(false);
    expect(containsToken('/usr/lib/xyz', '/usr/lib/x')).toBe(false);
    expect(containsToken('Use build7.', 'build7')).toBe(true);
  });
  it('normalises Unicode compatibility forms without folding case-sensitive identifiers', () => {
    expect(containsToken('Use ＮＯＤＥ_ＯＰＴＩＯＮＳ.', 'NODE_OPTIONS')).toBe(true);
    expect(containsToken('node_options', 'NODE_OPTIONS')).toBe(false);
  });
});
