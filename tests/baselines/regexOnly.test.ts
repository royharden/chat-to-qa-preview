// R1 regex-only baseline: exactly the K20 rule list. Every token-shaped input is assembled at runtime from parts so
// no materialised secret-shaped literal exists in this file.
import { describe, expect, it } from 'vitest';
import { R1_RULE_IDS, regexOnlyRedact, regexOnlyRedactAll } from '../../src/lib/baselines/regexOnly.ts';

const email = 'dev.one' + '@' + 'example.test';
const awsKeyId = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP';
const awsTempKeyId = 'AS' + 'IA' + 'QRSTUVWXYZ234567';
const skKey = 's' + 'k-' + 'abcDEF123'.repeat(3);
const ghClassic = 'gh' + 'p_' + 'aB3'.repeat(12);
const ghFineGrained = 'github' + '_pat_' + 'Zx9_'.repeat(6);
const slackBot = 'xo' + 'xb-' + '1234-abcd-5678';
const slackUser = 'xo' + 'xp-' + '9876-wxyz-5432';
const bearerToken = 'tok.EN-'.repeat(3);
const pemHeader = '-----' + 'BEGIN ' + 'RSA ' + 'PRIVATE' + ' KEY' + '-----';

describe('R1 rule list (K20)', () => {
  it('has exactly the seven K20 rules', () => {
    expect([...R1_RULE_IDS]).toEqual(['email', 'aws_key_id', 'sk_key', 'github_token', 'slack_token', 'bearer_token', 'pem_header']);
  });
});

describe('R1 detections', () => {
  const cases: Array<[string, string, string]> = [
    ['email', `mail ${email} now`, 'mail [EMAIL_1] now'],
    ['aws akia', `key ${awsKeyId} end`, 'key [AWS_KEY_1] end'],
    ['aws asia', `key ${awsTempKeyId} end`, 'key [AWS_KEY_1] end'],
    ['sk-', `use ${skKey} here`, 'use [SK_KEY_1] here'],
    ['ghp_', `token ${ghClassic} ok`, 'token [GITHUB_TOKEN_1] ok'],
    ['github_pat_', `token ${ghFineGrained} ok`, 'token [GITHUB_TOKEN_1] ok'],
    ['xoxb-', `slack ${slackBot} ok`, 'slack [SLACK_TOKEN_1] ok'],
    ['xoxp-', `slack ${slackUser} ok`, 'slack [SLACK_TOKEN_1] ok'],
    ['Bearer', `Authorization: Bea` + `rer ${bearerToken}`, 'Authorization: Bea' + 'rer [BEARER_1]'],
    ['PEM header only', `${pemHeader}\nMIIBodyLine`, '[PEM_HEADER_1]\nMIIBodyLine'],
  ];
  for (const [name, input, expected] of cases) {
    it(`redacts ${name}`, () => {
      expect(regexOnlyRedact(input).text).toBe(expected);
    });
  }

  it('the PEM key body is a documented R1 miss (header only)', () => {
    expect(regexOnlyRedact(`${pemHeader}\nMIIBodyLine`).text).toContain('MIIBodyLine');
  });
});

describe('R1 is regex-only: everything outside K20 passes through', () => {
  const untouched = [
    'call 555-0123 tomorrow',
    'host 192.0.2.10 and 2001:db8::1',
    'id 123e4567-e89b-12d3-a456-426614174000',
    'path C:\\Users\\someone\\project',
    'handle @someone',
    'jwt-like ' + 'ey' + 'Jabcdefghijkl' + '.' + 'ey' + 'Jmnopqrstuvw' + '.sig',
    'slack app ' + 'xo' + 'xa-' + '1234-abcd-5678',
    'postgres://user:pw@db.internal/app',
  ];
  for (const text of untouched) {
    it(`leaves ${JSON.stringify(text.slice(0, 12))}... unchanged`, () => {
      const out = regexOnlyRedact(text);
      // The connection string contains an email-like `pw@db.internal`; R1 redacts only that email-shaped part.
      if (text.startsWith('postgres')) expect(out.findings.every((f) => f.rule === 'email')).toBe(true);
      else expect(out.text).toBe(text);
    });
  }
});

describe('R1 numbering', () => {
  it('reuses a placeholder for a repeated value and numbers new values', () => {
    const other = 'dev.two' + '@' + 'example.test';
    expect(regexOnlyRedact(`${email} ${other} ${email}`).text).toBe('[EMAIL_1] [EMAIL_2] [EMAIL_1]');
  });

  it('shares numbering across the texts of one session', () => {
    const out = regexOnlyRedactAll([`a ${email}`, `b ${email} ${skKey}`]);
    expect(out.map((r) => r.text)).toEqual(['a [EMAIL_1]', 'b [EMAIL_1] [SK_KEY_1]']);
  });

  it('reports half-open UTF-16 offsets into the input', () => {
    const input = `x ${email}`;
    const f = regexOnlyRedact(input).findings[0];
    expect(f).toBeDefined();
    if (f !== undefined) expect(input.slice(f.start, f.end)).toBe(email);
  });
});
