// R1 regex-only baseline (PLAN-FINAL K20, K24). EVALUATOR-ONLY: used by the leak evaluation arms, never by the app,
// the download path or any provider path. Frozen in M1: its SHA-256 is pinned in FREEZE.json and must not change.
//
// Exactly seven rules, nothing else (K20): email addresses; AWS access key ids (AKIA/ASIA prefix); `sk-` keys;
// GitHub tokens (ghp_ / github_pat_ prefix); Slack tokens (xoxb- / xoxp- prefix); the token after `Bearer `;
// the PEM private-key header line (header only - the key body is a deliberate, documented R1 miss).
// Each pattern is linear: a literal anchor plus single character-class runs, no nested quantifiers.

export const R1_RULES_VERSION = 'r1-regex-only/1';

export const R1_RULE_IDS = ['email', 'aws_key_id', 'sk_key', 'github_token', 'slack_token', 'bearer_token', 'pem_header'] as const;
export type R1RuleId = (typeof R1_RULE_IDS)[number];

interface R1Rule {
  readonly id: R1RuleId;
  readonly placeholder: string;
  readonly pattern: RegExp;
}

const R1_RULES: readonly R1Rule[] = [
  { id: 'email', placeholder: 'EMAIL', pattern: /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}/g },
  { id: 'aws_key_id', placeholder: 'AWS_KEY', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'sk_key', placeholder: 'SK_KEY', pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/g },
  { id: 'github_token', placeholder: 'GITHUB_TOKEN', pattern: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})/g },
  { id: 'slack_token', placeholder: 'SLACK_TOKEN', pattern: /\bxox[bp]-[A-Za-z0-9-]{10,}/g },
  { id: 'bearer_token', placeholder: 'BEARER', pattern: /(?<=\b[Bb]earer[ \t]{1,8})[A-Za-z0-9._~+/-]{8,}=*/g },
  { id: 'pem_header', placeholder: 'PEM_HEADER', pattern: /-----BEGIN (?:[A-Z0-9]{1,16} ){0,4}PRIVATE KEY-----/g },
];

export interface R1Finding {
  readonly rule: R1RuleId;
  /** UTF-16 offsets into the input text, half-open. */
  readonly start: number;
  readonly end: number;
}

export interface R1Result {
  readonly text: string;
  readonly findings: readonly R1Finding[];
}

function collect(text: string): R1Finding[] {
  const found: R1Finding[] = [];
  for (const rule of R1_RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      const start = m.index ?? 0;
      if (m[0].length > 0) found.push({ rule: rule.id, start, end: start + m[0].length });
    }
  }
  // Overlaps: earliest start wins, then the longest match, then rule order. Deterministic.
  found.sort((a, b) => a.start - b.start || b.end - a.end || R1_RULE_IDS.indexOf(a.rule) - R1_RULE_IDS.indexOf(b.rule));
  const kept: R1Finding[] = [];
  let cursor = 0;
  for (const f of found) {
    if (f.start >= cursor) {
      kept.push(f);
      cursor = f.end;
    }
  }
  return kept;
}

/**
 * Redact many texts with shared numbering (one session): the same value gets the same placeholder everywhere,
 * e.g. `[EMAIL_1]`. Returns one result per input text, in order.
 */
export function regexOnlyRedactAll(texts: readonly string[]): R1Result[] {
  const numbering = new Map<string, string>();
  const counters = new Map<string, number>();
  return texts.map((text) => {
    const findings = collect(text);
    let out = '';
    let at = 0;
    for (const f of findings) {
      const rule = R1_RULES.find((r) => r.id === f.rule);
      const kind = rule === undefined ? 'REDACTED' : rule.placeholder;
      const value = text.slice(f.start, f.end);
      const key = `${kind}\u0000${value}`;
      let label = numbering.get(key);
      if (label === undefined) {
        const next = (counters.get(kind) ?? 0) + 1;
        counters.set(kind, next);
        label = `[${kind}_${next}]`;
        numbering.set(key, label);
      }
      out += text.slice(at, f.start) + label;
      at = f.end;
    }
    out += text.slice(at);
    return { text: out, findings };
  });
}

/** Redact one text (its own numbering). */
export function regexOnlyRedact(text: string): R1Result {
  const [result] = regexOnlyRedactAll([text]);
  return result ?? { text, findings: [] };
}
