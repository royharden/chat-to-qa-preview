import type { Finding } from './tiers.ts';
export function nameFindings(text: string): Finding[] {
  const findings: Finding[] = [];
  const rules = [
    ['P_SIGNATURE', /(?:Thanks,|Regards,|Cheers,|\u2014)[ \t]+([^\n<>]{1,80})/g],
    ['P_HEADER', /(?:^|\n)(?:From:|Co-authored-by:)[ \t]*([^\n<>]{1,80})/g],
    ['P_EMAIL_NAME', /(?:^|\n)([^\n<>]{1,80})[ \t]+<[^<>\s]{1,200}@[^<>\s]{1,200}>/g],
    ['P_GIT_NAME', /git[ \t]+config[ \t]+user\.name[ \t]+["']([^"'\n]{1,80})["']/g],
  ] as const;
  for (const [rule_id, pattern] of rules) for (const match of text.matchAll(pattern)) {
    const value = match[1]; if (!value) continue;
    const relative = match[0].lastIndexOf(value); const start = match.index + relative;
    findings.push({ rule_id, kind: 'NAME', tier: 'medium', start, end: start + value.length, blocking: false });
  }
  return findings;
}
