declare const redactedText: unique symbol;
declare const redactedSession: unique symbol;
/** Only redactkit's engine may assert these private, nominal brands. */
export type RedactedText = string & { readonly [redactedText]: true };
export interface RedactedTurn { readonly id: string; readonly role: 'user' | 'assistant'; readonly text: RedactedText }
export interface RedactedSession {
  readonly [redactedSession]: true;
  readonly ok: true;
  readonly turns: readonly RedactedTurn[];
  readonly source_revision: string;
  readonly rules_version: string;
  readonly placeholders: readonly string[];
}
