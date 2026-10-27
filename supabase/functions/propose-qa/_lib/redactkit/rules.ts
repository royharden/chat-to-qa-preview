import { decoyRule } from './decoys.ts';
import { denyListFindings } from './denylist.ts';
import { nameFindings } from './names.ts';
import type { Finding, Tier } from './tiers.ts';
export const RULES_VERSION = 's47.redact.v1';
interface Rule { readonly id: string; readonly kind: string; readonly tier: Tier; readonly pattern: RegExp }
// Fresh implementation; bounded repetitions prevent nested unbounded quantifiers.
export const RULES: readonly Rule[] = [
  { id: 'S_AWS_ID', kind: 'AWS', tier: 'high', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { id: 'S_PROVIDER', kind: 'TOKEN', tier: 'high', pattern: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,255}|sk-[A-Za-z0-9_-]{20,255}|xox[bpas]-[A-Za-z0-9-]{10,255})/g },
  { id: 'S_JWT', kind: 'JWT', tier: 'high', pattern: /\beyJ[A-Za-z0-9_-]{10,4096}\.[A-Za-z0-9_-]{10,4096}\.[A-Za-z0-9_-]{1,4096}/g },
  { id: 'S_PEM', kind: 'PEM', tier: 'high', pattern: /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----[\s\S]{0,100000}?-----END [A-Z ]{0,40}PRIVATE KEY-----/g },
  { id: 'S_PEM_HEADER', kind: 'PEM', tier: 'high', pattern: /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----/g },
  { id: 'S_AUTH', kind: 'AUTH', tier: 'high', pattern: /\b(?:Bearer|Basic)[ \t\n]+[A-Za-z0-9._~+/=-]{8,4096}/gi },
  { id: 'S_CONNECTION', kind: 'CONNECTION', tier: 'high', pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s<>"']{1,4096}/gi },
  { id: 'S_USERINFO', kind: 'URL', tier: 'high', pattern: /\bhttps?:\/\/[^\s/@]{1,200}:[^\s/@]{1,500}@[^\s<>"']{1,2048}/gi },
  { id: 'S_QUERY', kind: 'URL', tier: 'high', pattern: /\bhttps?:\/\/[^\s<>"']{1,4096}/gi },
  { id: 'S_ASSIGNMENT', kind: 'SECRET', tier: 'high', pattern: /\b(?:aws_secret_access_key|api[_-]?key|access[_-]?token|secret|password|passwd|token)["']?[ \t]*[=:][ \t\n]*["']?[^\s"',;]{4,4096}/gi },
  { id: 'C_EMAIL', kind: 'EMAIL', tier: 'medium', pattern: /[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,8}/g },
  { id: 'C_PHONE', kind: 'PHONE', tier: 'medium', pattern: /(?<![\w.])(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]\d{3}[ .-]\d{4}(?!\d)|(?<!\d)555-01\d{2}(?!\d)/g },
  { id: 'N_IPV4', kind: 'IPV4', tier: 'medium', pattern: /(?<![\d])\d{1,3}(?:\.\d{1,3}){3}(?!\w)/g },
  { id: 'N_IPV6', kind: 'IPV6', tier: 'medium', pattern: /(?<![\w:])(?:[A-Fa-f0-9]{0,4}:){2,7}[A-Fa-f0-9]{0,4}(?![\w:])/g },
  { id: 'N_INTERNAL', kind: 'HOST', tier: 'medium', pattern: /\b[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.(?:internal|corp|local|lan|home\.arpa)\b/gi },
  { id: 'N_SINGLE_HOST', kind: 'HOST', tier: 'medium', pattern: /\bhttps?:\/\/[A-Za-z0-9-]{1,63}(?=[:/?#\s]|$)/gi },
  { id: 'P_HOME', kind: 'HOME', tier: 'medium', pattern: /[A-Za-z]:\\Users\\[^\\\s/]{1,80}|\/(?:home|Users)\/[^/\s]{1,80}/g },
  { id: 'P_HANDLE', kind: 'HANDLE', tier: 'medium', pattern: /(?<![\w.])@[A-Za-z0-9_]{1,40}\b/g },
  { id: 'I_UUID', kind: 'UUID', tier: 'low', pattern: /\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/gi },
];
export function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const c of value) counts.set(c, (counts.get(c) ?? 0) + 1);
  let bits = 0; for (const n of counts.values()) { const p = n / value.length; bits -= p * Math.log2(p); }
  return bits;
}
export interface DetectOptions { readonly denyList?: readonly string[] }
function detectSurface(text: string, options: DetectOptions): readonly Finding[] {
  const out: Finding[] = [];
  for (const rule of RULES) for (const match of text.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags))) {
    const start = match.index; const end = start + match[0].length;
    if (rule.id === 'S_QUERY') {
      try { const url = new URL(match[0]); let sensitive = false;
        url.searchParams.forEach((value, key) => {
          if (/token|key|secret|auth|password|signature/i.test(key) || (value.length >= 20 && entropy(value) >= 4)) sensitive = true;
        });
        if (!sensitive) continue;
      } catch { continue; }
    }
    if (rule.kind === 'IPV4' && match[0].split('.').some((p) => Number(p) > 255)) continue;
    if (decoyRule(text, start, end, rule.kind)) continue;
    out.push({ rule_id: rule.id, kind: rule.kind, tier: rule.tier, start, end, blocking: false });
  }
  for (const match of text.matchAll(/[A-Za-z0-9_+/=-]{20,4096}/g)) {
    const value = match[0]; const start = match.index; const end = start + value.length;
    if (entropy(value) < 4 || !/[A-Za-z]/.test(value) || !/[\d_+/=-]/.test(value) || decoyRule(text, start, end, 'ENTROPY')) continue;
    if (out.some((f) => !f.blocking && f.start <= start && f.end >= end)) continue;
    out.push({ rule_id: 'S_ENTROPY', kind: 'ENTROPY', tier: 'high', start, end, blocking: true });
  }
  return [...out, ...denyListFindings(text, options.denyList ?? []), ...nameFindings(text)];
}

/** Decode exactly one JSON-escape layer and retain a UTF-16 origin interval for each decoded unit. */
function decodedSurface(text: string): { text: string; starts: number[]; ends: number[] } {
  let output = ''; const starts: number[] = []; const ends: number[] = [];
  const simple: Readonly<Record<string, string>> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
  for (let i = 0; i < text.length;) {
    const start = i; let value = text[i] ?? ''; let size = 1;
    if (value === '\\') {
      const next = text[i + 1] ?? '';
      if (next === 'u' && /^[a-f\d]{4}$/i.test(text.slice(i + 2, i + 6))) { value = String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16)); size = 6; }
      else if (Object.prototype.hasOwnProperty.call(simple, next)) { value = simple[next] ?? value; size = 2; }
    }
    output += value; starts.push(start); ends.push(i + size); i += size;
  }
  return { text: output, starts, ends };
}
/** Literal surfaces plus one JSON-unescape layer; decoded findings map back to unchanged source offsets. */
export function detect(text: string, options: DetectOptions = {}): readonly Finding[] {
  const literal = detectSurface(text, options);
  if (!text.includes('\\')) return literal;
  const decoded = decodedSurface(text);
  if (decoded.text === text) return literal;
  const mapped = detectSurface(decoded.text, options).map((f) => ({ ...f,
    start: decoded.starts[f.start] ?? 0, end: decoded.ends[f.end - 1] ?? text.length }));
  const unique = new Map<string, Finding>();
  for (const f of [...literal, ...mapped]) unique.set(`${f.rule_id}:${f.start}:${f.end}`, f);
  return [...unique.values()];
}
