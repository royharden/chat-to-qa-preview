// Byte/text helpers shared by both adapters (D10 step 1). Pure; no I/O.

/** Strict UTF-8 decode. Returns null on any invalid sequence. A leading BOM is kept (handled by stripBom). */
export function decodeUtf8Strict(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Removes one leading U+FEFF. */
export function stripBom(text: string): { text: string; removed: boolean } {
  return text.startsWith('﻿') ? { text: text.slice(1), removed: true } : { text, removed: false };
}

/** CRLF -> LF. A lone CR is left in place so the control-character check refuses it. */
export function normaliseCrlf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

// An HTML document export (xexport `--format html` writes index.html / page-NNN.html / full.html).
const HTML_DOCUMENT_START = /^\s*<(?:!doctype\s+html|html(?:[\s>]|$))/i;

/** True when the text starts (after whitespace) with an HTML doctype or <html> tag. */
export function looksLikeHtmlDocument(text: string): boolean {
  return HTML_DOCUMENT_START.test(text);
}

/** 1-based line number of a UTF-16 index in LF text. */
export function lineOfIndex(text: string, index: number): number {
  let line = 1;
  let from = 0;
  for (;;) {
    const next = text.indexOf('\n', from);
    if (next < 0 || next >= index) return line;
    line++;
    from = next + 1;
  }
}
