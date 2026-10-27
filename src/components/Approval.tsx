export function Approval({ ready, approved, durable, busy, approve, download }: { ready: boolean; approved: boolean; durable: boolean; busy: boolean; approve(): void; download(format: 'md' | 'json'): void }) {
  return <section><h2>6. Approve both files</h2><p>Approval binds both byte hashes, the revision, rules and scan. Every edit requires a fresh approval.</p>
    <p>Only approval hashes are stored locally. Clearing browser storage loses approval history. {durable ? '' : 'Storage is unavailable: approval and download are blocked.'}</p>
    <button disabled={!ready || !durable || busy} onClick={approve}>I reviewed both files — approve</button>
    <button disabled={!approved || busy} onClick={() => download('md')}>Download Markdown</button><button disabled={!approved || busy} onClick={() => download('json')}>Download JSON</button></section>;
}
