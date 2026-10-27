// Adapter entry point: choose the adapter for one imported file. The file name is used only to pick the adapter
// here; it is never stored, shown in an artefact or hashed (D8).
import { LIMITS } from '../schema/chatSession.ts';
import { parseChatSessionJson } from './chatSessionJson.ts';
import { REFUSAL } from './refusals.ts';
import { refuse } from './types.ts';
import type { ImportOutcome } from './types.ts';
import { parseXexportMd } from './xexportMd.ts';

export { REFUSAL, REFUSAL_CODES, refusalMessage } from './refusals.ts';
export type { RefusalCode } from './refusals.ts';
export { FORMAT, WARNING } from './types.ts';
export type { ImportAccepted, ImportFormat, ImportOutcome, ImportRefused, ImportReview, ImportReviewTurn, ImportWarning } from './types.ts';
export { XEXPORT_MD_PROFILE_ID, parseXexportMd } from './xexportMd.ts';
export { CHAT_SESSION_JSON_PROFILE_ID, parseChatSessionJson } from './chatSessionJson.ts';

function extensionOf(fileName: string | undefined): string {
  if (fileName === undefined) return '';
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** First byte after an optional UTF-8 BOM and ASCII whitespace, or -1. */
function firstSignificantByte(bytes: Uint8Array): number {
  let i = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  while (i < bytes.length) {
    const b = bytes[i] ?? -1;
    if (b !== 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) return b;
    i++;
  }
  return -1;
}

/**
 * Import one file. `.html`/`.htm` -> html_export. `.json`, or no Markdown extension and content starting with `{`
 * -> JSON adapter. Everything else -> Markdown adapter (which itself refuses HTML documents).
 */
export function importChatFile(bytes: Uint8Array, fileName?: string): ImportOutcome {
  if (bytes.byteLength > LIMITS.maxFileBytes) return refuse(REFUSAL.OVERSIZE_FILE);
  const ext = extensionOf(fileName);
  if (ext === 'html' || ext === 'htm') return refuse(REFUSAL.HTML_EXPORT);
  if (ext === 'json') return parseChatSessionJson(bytes);
  if (ext !== 'md' && ext !== 'markdown' && firstSignificantByte(bytes) === 0x7b) return parseChatSessionJson(bytes);
  return parseXexportMd(bytes);
}
