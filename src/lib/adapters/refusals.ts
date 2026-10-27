// Import refusal codes (PLAN-FINAL D10 + K19 + K3/K4). Each code string is defined exactly once, here; every
// other module refers to it through REFUSAL. Each code has exactly one fixture under fixtures/refusals/ named
// `<code>.<ext>` (size refusals are small `<code>.recipe.json` files expanded at test time).
export const REFUSAL = {
  NO_ROLE_HEADING: 'no_role_heading',
  HTML_EXPORT: 'html_export',
  UNBALANCED_FENCE: 'unbalanced_fence',
  NESTED_OR_UNBALANCED_DETAILS: 'nested_or_unbalanced_details',
  OVERSIZE_FILE: 'oversize_file',
  TOO_MANY_TURNS: 'too_many_turns',
  TURN_TOO_LONG: 'turn_too_long',
  TOTAL_TOO_LONG: 'total_too_long',
  UNKNOWN_ROLE_HEADING: 'unknown_role_heading',
  RAW_HTML_OUTSIDE_DETAILS: 'raw_html_outside_details',
  BAD_ENCODING_OR_CONTROL_CHARS: 'bad_encoding_or_control_chars',
  UNKNOWN_JSON_SHAPE: 'unknown_json_shape',
  DUPLICATE_TURN_ID: 'duplicate_turn_id',
  NO_USER_OR_ASSISTANT: 'no_user_or_assistant',
} as const;

export type RefusalCode = (typeof REFUSAL)[keyof typeof REFUSAL];

export const REFUSAL_CODES: readonly RefusalCode[] = Object.freeze(Object.values(REFUSAL));

/** Short, user-facing explanation. Never includes any input content. */
export function refusalMessage(code: RefusalCode): string {
  switch (code) {
    case REFUSAL.NO_ROLE_HEADING:
      return 'No role heading found. Expected an xexport Markdown export with "## 👤 User" and "## 🤖 <label>" headings.';
    case REFUSAL.HTML_EXPORT:
      return 'HTML exports are not supported. Export with `--format md`.';
    case REFUSAL.UNBALANCED_FENCE:
      return 'A fenced code block is never closed.';
    case REFUSAL.NESTED_OR_UNBALANCED_DETAILS:
      return 'A <details> block is nested or not closed.';
    case REFUSAL.OVERSIZE_FILE:
      return 'The file is larger than 5 MiB.';
    case REFUSAL.TOO_MANY_TURNS:
      return 'The session has more than 2,000 turns.';
    case REFUSAL.TURN_TOO_LONG:
      return 'A turn is longer than 100,000 characters (UTF-16 code units).';
    case REFUSAL.TOTAL_TOO_LONG:
      return 'The session text is longer than 4,000,000 characters (UTF-16 code units) in total.';
    case REFUSAL.UNKNOWN_ROLE_HEADING:
      return 'A heading looks like a role heading but is not "## 👤 User" or "## 🤖 <label>" (for example a tool heading).';
    case REFUSAL.RAW_HTML_OUTSIDE_DETAILS:
      return 'Raw HTML block found outside a <details> block.';
    case REFUSAL.BAD_ENCODING_OR_CONTROL_CHARS:
      return 'The file is not valid UTF-8 or contains control characters other than tab and newline.';
    case REFUSAL.UNKNOWN_JSON_SHAPE:
      return 'The JSON file is not a valid s47.chat.v1 session.';
    case REFUSAL.DUPLICATE_TURN_ID:
      return 'Two turns share the same id.';
    case REFUSAL.NO_USER_OR_ASSISTANT:
      return 'The session needs at least one non-empty user turn and one non-empty assistant turn.';
  }
}
