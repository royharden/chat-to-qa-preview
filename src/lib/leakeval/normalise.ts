// Oracle-only normalisations. No redactkit imports: an independent value-based check.
export function normalisations(value: string, insensitive = false): readonly string[] {
  const variants = new Set([value]);
  // Decode one JSON string layer, including escaped strings nested in a formatted JSON artifact.
  try { const decoded: unknown = JSON.parse(value); const collect = (item: unknown): void => {
    if (typeof item === 'string') variants.add(item); else if (Array.isArray(item)) item.forEach(collect);
    else if (item && typeof item === 'object') Object.values(item).forEach(collect);
  }; collect(decoded); } catch { /* The surface need not be a complete JSON document. */ }
  variants.add(value.replace(/\\u([0-9a-f]{4})|\\(["\\/bfnrt])/gi, (whole, hex: string | undefined, escaped: string | undefined) => {
    if (hex) return String.fromCharCode(parseInt(hex,16));
    return ({'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'} as Record<string,string>)[escaped ?? ''] ?? whole;
  }));
  for (const item of [...variants]) try { variants.add(decodeURIComponent(item)); } catch { /* literal percent text */ }
  for (const item of [...variants]) variants.add(item.normalize('NFKC'));
  for (const item of [...variants]) variants.add(item.replace(/\s+/g, ''));
  if (insensitive) for (const item of [...variants]) variants.add(item.toLowerCase());
  return [...variants].filter(Boolean);
}
