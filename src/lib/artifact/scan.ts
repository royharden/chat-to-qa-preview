import { detect, scanPlaceholderEscapes } from '../redactkit/index.ts';
import type { ArtifactContent } from './core.ts';
import { sha256 } from './hash.ts';
export interface ScanResult { readonly ok: boolean; readonly reasons: readonly string[]; readonly digest: string }
export async function scanArtifact(content: ArtifactContent, bytes: { md: Uint8Array; json: Uint8Array }, denyList: readonly string[] = []): Promise<ScanResult> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const reasons: string[] = [];
  const fields: string[] = [];
  function strings(value: unknown): void {
    if (typeof value === 'string') fields.push(value);
    else if (Array.isArray(value)) value.forEach(strings);
    else if (value && typeof value === 'object') Object.values(value).forEach(strings);
  }
  strings(content);
  try { strings(JSON.parse(decoder.decode(bytes.json))); }
  catch { reasons.push('invalid_public_json'); }
  fields.push(decoder.decode(bytes.md), decoder.decode(bytes.json));
  for (const text of fields) {
    // Detector operates on literal surfaces; generated placeholders are not identifier rules.
    if (detect(text, { denyList }).length > 0) reasons.push('identifier_finding');
    if (scanPlaceholderEscapes(text).length > 0) reasons.push('placeholder_escape');
  }
  const unique = [...new Set(reasons)].sort();
  return { ok: unique.length === 0, reasons: unique, digest: await sha256(JSON.stringify({ reasons: unique, md: await sha256(bytes.md), json: await sha256(bytes.json) })) };
}
