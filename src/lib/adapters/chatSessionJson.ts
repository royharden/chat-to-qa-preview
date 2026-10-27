// JSON adapter for S47's canonical wire format `s47.chat.v1` (K3 roles, K4 caps). Not a native xexport format.
// Order (first failing check refuses): size -> strict UTF-8 (+ BOM warning) -> HTML document -> JSON.parse and
// strict shape -> turn count -> duplicate ids -> per-turn CRLF->LF + control chars / unpaired surrogates ->
// per-turn length -> total length -> non-empty user and assistant. `title` is accepted and discarded (never read),
// wire ids are regenerated t1..tN, and text is otherwise taken as is (`<details>` has no meaning in JSON).
import {
  ChatSessionV1,
  ChatSessionV1Json,
  LIMITS,
  SCHEMA_VERSION,
  findForbiddenControlChar,
  hasContent,
  isWellFormedUtf16,
} from '../schema/chatSession.ts';
import { REFUSAL } from './refusals.ts';
import { FORMAT, WARNING, refuse } from './types.ts';
import type { ImportOutcome, ImportWarning } from './types.ts';
import { decodeUtf8Strict, looksLikeHtmlDocument, normaliseCrlf, stripBom } from './text.ts';

export const CHAT_SESSION_JSON_PROFILE_ID = SCHEMA_VERSION;

/** Parse one `s47.chat.v1` JSON session. Pure; the input is never stored. */
export function parseChatSessionJson(bytes: Uint8Array): ImportOutcome {
  if (bytes.byteLength > LIMITS.maxFileBytes) return refuse(REFUSAL.OVERSIZE_FILE);

  const decoded = decodeUtf8Strict(bytes);
  if (decoded === null) return refuse(REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS);
  const warnings: ImportWarning[] = [];
  const bom = stripBom(decoded);
  if (bom.removed) warnings.push(WARNING.BOM_REMOVED);
  if (looksLikeHtmlDocument(bom.text)) return refuse(REFUSAL.HTML_EXPORT);

  let raw: unknown;
  try {
    raw = JSON.parse(bom.text);
  } catch {
    return refuse(REFUSAL.UNKNOWN_JSON_SHAPE);
  }
  const shape = ChatSessionV1Json.safeParse(raw);
  if (!shape.success) return refuse(REFUSAL.UNKNOWN_JSON_SHAPE);
  const wireTurns = shape.data.turns;

  if (wireTurns.length > LIMITS.maxTurns) return refuse(REFUSAL.TOO_MANY_TURNS);

  const seen = new Set<string>();
  for (let i = 0; i < wireTurns.length; i++) {
    const id = wireTurns[i]?.id ?? '';
    if (seen.has(id)) return refuse(REFUSAL.DUPLICATE_TURN_ID, { turnIndex: i });
    seen.add(id);
  }

  const texts: string[] = [];
  for (let i = 0; i < wireTurns.length; i++) {
    const text = normaliseCrlf(wireTurns[i]?.text ?? '');
    if (!isWellFormedUtf16(text) || findForbiddenControlChar(text) >= 0) {
      return refuse(REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS, { turnIndex: i });
    }
    texts.push(text);
  }

  let total = 0;
  for (let i = 0; i < texts.length; i++) {
    const len = (texts[i] ?? '').length;
    if (len > LIMITS.maxTurnUnits) return refuse(REFUSAL.TURN_TOO_LONG, { turnIndex: i });
    total += len;
  }
  if (total > LIMITS.maxTotalUnits) return refuse(REFUSAL.TOTAL_TOO_LONG);

  const hasUser = wireTurns.some((t, i) => t.role === 'user' && hasContent(texts[i] ?? ''));
  const hasAssistant = wireTurns.some((t, i) => t.role === 'assistant' && hasContent(texts[i] ?? ''));
  if (!hasUser || !hasAssistant) return refuse(REFUSAL.NO_USER_OR_ASSISTANT);

  // Only id (regenerated), role and text are carried over. `title` and wire ids are dropped here.
  const candidate = {
    schema_version: SCHEMA_VERSION,
    turns: wireTurns.map((t, i) => ({ id: `t${i + 1}`, role: t.role, text: texts[i] ?? '' })),
  };
  const parsed = ChatSessionV1.safeParse(candidate);
  if (!parsed.success) {
    // Every schema rule is checked above; reaching this is a bug, not an input problem.
    throw new Error('chatSessionJson: canonical session failed ChatSessionV1 validation');
  }

  return {
    ok: true,
    session: parsed.data,
    review: {
      format: FORMAT.CHAT_SESSION_JSON,
      profileId: CHAT_SESSION_JSON_PROFILE_ID,
      preamble: '',
      turns: parsed.data.turns.map((t) => ({ id: t.id, role: t.role, headingLine: null, droppedDetails: [] })),
      warnings,
    },
  };
}
