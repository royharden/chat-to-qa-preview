import { describe, expect, it } from 'vitest';
import { detect, RULES } from '../../src/lib/redactkit/rules.ts';
import { decoyRule, DECOY_RULE_IDS } from '../../src/lib/redactkit/decoys.ts';
import { resolveOverlaps } from '../../src/lib/redactkit/tiers.ts';
const mixed = 'Ab3Cd4Ef5Gh6Ij7Kl8Mn9Op0Qr1St2Uv3Wx4Yz5';
const cases: readonly [string, () => string][] = [
  ['S_AWS_ID', () => 'AK' + 'IA' + 'A1B2C3D4E5F6G7H8'],
  ['S_PROVIDER', () => 'gh' + 'p_' + 'a'.repeat(36)],
  ['S_JWT', () => 'ey' + 'J' + 'a'.repeat(12) + '.' + 'b'.repeat(12) + '.' + 'c'.repeat(12)],
  ['S_PEM', () => '-----BE' + 'GIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'],
  ['S_PEM_HEADER', () => '-----BE' + 'GIN PRIVATE KEY-----'],
  ['S_AUTH', () => 'Bea' + 'rer ' + mixed],
  ['S_CONNECTION', () => 'postgres' + '://reader:demo@db.test/db'],
  ['S_USERINFO', () => 'https' + '://reader:demo@docs.test/x'],
  ['S_QUERY', () => 'https' + '://docs.test/?token=' + mixed],
  ['S_ASSIGNMENT', () => 'aws_secret_access_key' + ' = ' + mixed],
  ['C_EMAIL', () => 'reader' + '@example.test'],
  ['C_PHONE', () => '+1 202-555-0123'],
  ['N_IPV4', () => '192.0.2.10'],
  ['N_IPV6', () => '2001:db8::1234'],
  ['N_INTERNAL', () => 'build' + '.internal'],
  ['N_SINGLE_HOST', () => 'http' + '://printer/jobs'],
  ['P_HOME', () => 'C:' + '\\Users\\Demo\\project'],
  ['P_HANDLE', () => '@' + 'demo_handle'],
  ['I_UUID', () => ['12345678', '1234', '4234', '8234', '123456789abc'].join('-')],
];
describe('every declared class has a source case', () => {
  it.each(cases)('%s', (id, input) => expect(detect(input()).some((f) => f.rule_id === id)).toBe(true));
  it('keeps source rule inventory in sync', () => expect(new Set(cases.map(([id]) => id))).toEqual(new Set(RULES.map((r) => r.id))));
  it.each(['AK' + 'IA', 'AS' + 'IA'])('AWS prefixes %s', (prefix) => expect(detect(prefix + 'A1B2C3D4E5F6G7H8').some((f) => f.rule_id === 'S_AWS_ID')).toBe(true));
  it.each(['sk' + '-', 'github' + '_pat_', 'xo' + 'xb-', 'xo' + 'xp-', 'xo' + 'xa-', 'xo' + 'xs-'])('provider variants %s', (prefix) =>
    expect(detect(prefix + 'a'.repeat(40)).some((f) => f.rule_id === 'S_PROVIDER')).toBe(true));
  it.each(['corp', 'lan', 'local', 'home.arpa'])('host suffix %s', (suffix) => expect(detect('demo.' + suffix).some((f) => f.kind === 'HOST')).toBe(true));
  it('Unix home', () => expect(detect('/home/demo/project').some((f) => f.rule_id === 'P_HOME')).toBe(true));
  it('Basic authorization', () => expect(detect('Ba' + 'sic ' + mixed).some((f) => f.rule_id === 'S_AUTH')).toBe(true));
  it('JSON secret assignments include the quoted key delimiter', () => expect(detect(JSON.stringify({ api_key: 'demo-value-12345' })).some((f) => f.rule_id === 'S_ASSIGNMENT')).toBe(true));
  it('deny list literal matching including regex punctuation', () => expect(detect('A+B writes.', { denyList: ['a+b'] }).some((f) => f.rule_id === 'P_DENY')).toBe(true));
  it.each([
    ['P_SIGNATURE', 'Thanks, Demo Person'], ['P_SIGNATURE', '\u2014 Demo Person'],
    ['P_HEADER', 'From: Demo Person'], ['P_HEADER', 'Co-authored-by: Demo Person'],
    ['P_EMAIL_NAME', 'Demo Person <reader' + '@example.test>'], ['P_GIT_NAME', 'git config user.name "Demo Person"'],
  ])('name pattern %s', (id, input) => expect(detect(input).some((f) => f.rule_id === id)).toBe(true));
  it('entropy is blocking, never auto-approved', () => expect(detect(mixed).find((f) => f.rule_id === 'S_ENTROPY')?.blocking).toBe(true));
  it('reserved fixture ranges are detected', () => expect(detect('192.0.2.10 reader' + '@example.test')).toHaveLength(2));
  it('overlap picks tier then longest and deterministic rule id', () => {
    const f = (rule_id: string, tier: 'high' | 'medium', start: number, end: number) => ({ rule_id, tier, start, end, kind: 'X', blocking: false });
    const data = [f('z', 'high', 2, 4), f('a', 'high', 1, 5), f('m', 'medium', 0, 10)];
    expect(resolveOverlaps(data).map((v) => v.rule_id)).toEqual(['a']);
    expect(resolveOverlaps([...data].reverse())).toEqual(resolveOverlaps(data));
    expect(resolveOverlaps([f('b', 'high', 0, 4), f('a', 'high', 0, 4)])[0]?.rule_id).toBe('a');
  });
});
describe('decoys are contextual, never global allowlists', () => {
  const decoys: readonly [string, string, number, number, string][] = [
    ['D_VERSION_IP', 'version 1.2.3.4', 8, 15, 'IPV4'],
    ['D_DOTTED_VERSION', '1.2.3.4.5', 0, 7, 'IPV4'],
    ['D_GIT_SHA', 'commit abcdef0123456789abcdef0123456789', 7, 39, 'ENTROPY'],
    ['D_SEMVER', 'v5.4.2', 0, 6, 'ENTROPY'],
    ['D_LINE_COL', '12:34', 0, 5, 'ENTROPY'],
    ['D_BASE64_CONTEXT', 'base64 aGVsbG8gd29ybGQ=', 7, 23, 'ENTROPY'],
  ];
  it.each(decoys)('%s', (id, text, start, end, kind) => expect(decoyRule(text, start, end, kind)).toBe(id));
  it('covers every decoy rule', () => expect(new Set(decoys.map(([id]) => id))).toEqual(new Set(DECOY_RULE_IDS)));
  it('does not exempt URL query addresses', () => expect(detect('https://docs.test/?v1.2.3.4').some((f) => f.rule_id === 'N_IPV4')).toBe(true));
  it('does not exempt path addresses', () => expect(detect('/tmp/v1.2.3.4').some((f) => f.rule_id === 'N_IPV4')).toBe(true));
  it('does not exempt encoded tokens merely labelled base64', () => expect(decoyRule('base64 QUJDREVGR0gxMjM0NTY3ODkw', 7, 31, 'ENTROPY')).toBeUndefined());
  it('ignores invalid IPv4 and ordinary semver and line:col', () => expect(detect('v5.4.2 12:34 999.1.2.3')).toHaveLength(0));
});
