// R0 no-redaction control (PLAN-FINAL K24). EVALUATOR-ONLY identity: it measures what leaks when nothing is
// redacted. Never used by the app, the download path or any provider path. Frozen in M1 (SHA-256 in FREEZE.json).

export const R0_RULES_VERSION = 'r0-no-redaction/1';

/** Returns the input unchanged. */
export function noRedaction(text: string): string {
  return text;
}

/** Returns a copy of the inputs, unchanged, in order. */
export function noRedactionAll(texts: readonly string[]): string[] {
  return texts.map(noRedaction);
}
