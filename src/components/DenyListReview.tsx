import { useState } from 'react';
export function DenyListReview({ enabled, confirmed, changed, confirm }: { enabled: boolean; confirmed: boolean; changed(values: string[]): void; confirm(values: string[]): void }) {
  const [text, setText] = useState('');
  const values = text.split('\n').map(s => s.trim()).filter(Boolean);
  return <section><h2>2. Names to redact</h2><p>Names in ordinary prose are a known miss. Enter one exact term per line.</p>
    <textarea aria-label="Names to redact" value={text} disabled={!enabled} onChange={e => { setText(e.target.value); changed(e.target.value.split('\n').map(s => s.trim()).filter(Boolean)); }} />
    <button disabled={!enabled || confirmed || !values.length} onClick={() => confirm(values)}>Confirm names</button>
    <button disabled={!enabled || confirmed || values.length > 0} onClick={() => confirm([])}>I have no names to add</button></section>;
}
