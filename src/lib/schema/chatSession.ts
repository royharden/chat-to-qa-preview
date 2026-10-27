// ChatSessionV1: the canonical, in-memory chat session every adapter produces (PLAN-FINAL K3, K4, D10).
// Strict keys everywhere. Roles: user | assistant | tool | thinking (K3); tool and thinking turns are kept in the
// session but never enter candidates, model input or excerpts (see src/lib/session/views.ts).
// Caps (K4): 5 MiB file, 2,000 turns, 100,000 UTF-16 code units per turn, 4,000,000 UTF-16 code units in total.
// Ids are regenerated t1..tN in document order; any imported title is discarded and has no field here.
import { z } from 'zod';

export const SCHEMA_VERSION = 's47.chat.v1';

export const ROLES = ['user', 'assistant', 'tool', 'thinking'] as const;
export type Role = (typeof ROLES)[number];

export const LIMITS = {
  /** Maximum input file size in bytes (5 MiB). */
  maxFileBytes: 5 * 1024 * 1024,
  /** Maximum number of turns in one session. */
  maxTurns: 2000,
  /** Maximum UTF-16 code units in one turn's text. */
  maxTurnUnits: 100_000,
  /** Maximum UTF-16 code units summed over all turn texts. */
  maxTotalUnits: 4_000_000,
} as const;

/** Canonical turn id: t1..t2000, no leading zero. */
export const CANONICAL_TURN_ID = /^t[1-9][0-9]{0,3}$/;

/** Turn ids accepted in the JSON wire format before regeneration (K3): short, safe charset, no whitespace. */
export const WIRE_TURN_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

// C0 controls except tab (U+0009) and LF (U+000A), DEL and C1 controls. CR (U+000D) is included: CRLF is
// normalised to LF before this check, so any CR still present is a lone CR and is refused (D10 step 1).
const FORBIDDEN_CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/;

// A lone (unpaired) surrogate: possible in JSON input through \uD800-style escapes. No `u` flag on purpose.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Index of the first forbidden control character, or -1. */
export function findForbiddenControlChar(text: string): number {
  return text.search(FORBIDDEN_CONTROL);
}

/** True when the string is well-formed UTF-16 (no unpaired surrogate). */
export function isWellFormedUtf16(text: string): boolean {
  return !LONE_SURROGATE.test(text);
}

/** True when the text holds at least one non-whitespace character. */
export function hasContent(text: string): boolean {
  return /\S/.test(text);
}

export const TurnV1 = z
  .object({
    id: z.string().regex(CANONICAL_TURN_ID),
    role: z.enum(ROLES),
    text: z
      .string()
      .max(LIMITS.maxTurnUnits)
      .refine((t) => findForbiddenControlChar(t) === -1, { message: 'forbidden control character' })
      .refine(isWellFormedUtf16, { message: 'unpaired surrogate' }),
  })
  .strict();
export type TurnV1 = z.infer<typeof TurnV1>;

export const ChatSessionV1 = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    turns: z.array(TurnV1).min(1).max(LIMITS.maxTurns),
  })
  .strict()
  .superRefine((session, ctx) => {
    let total = 0;
    let user = false;
    let assistant = false;
    session.turns.forEach((turn, index) => {
      if (turn.id !== `t${index + 1}`) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['turns', index, 'id'], message: 'ids must be t1..tN in order' });
      }
      total += turn.text.length;
      if (turn.role === 'user' && hasContent(turn.text)) user = true;
      if (turn.role === 'assistant' && hasContent(turn.text)) assistant = true;
    });
    if (total > LIMITS.maxTotalUnits) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['turns'], message: 'total text exceeds cap' });
    }
    if (!user || !assistant) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['turns'], message: 'needs a non-empty user and assistant turn' });
    }
  });
export type ChatSessionV1 = z.infer<typeof ChatSessionV1>;

/**
 * JSON wire format accepted by the chat-session JSON adapter (S47's own canonical JSON, not a native xexport format).
 * Strict keys; optional `title` is accepted and discarded; ids are any safe unique strings and are regenerated.
 * Caps are enforced by the adapter (so each violation gets its own refusal code), not here.
 */
export const ChatSessionV1Json = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    title: z.string().optional(),
    turns: z.array(
      z
        .object({
          id: z.string().regex(WIRE_TURN_ID),
          role: z.enum(ROLES),
          text: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export type ChatSessionV1Json = z.infer<typeof ChatSessionV1Json>;
