export function ExactBytes({ bytes }: { bytes: { md: Uint8Array; json: Uint8Array; md_sha256: string; json_sha256: string } | null }) {
  if (!bytes) return <section><h2>5. Preview exact public bytes</h2><p>Resolve blocking checks to preview both downloads.</p></section>;
  const decode = (b: Uint8Array) => new TextDecoder().decode(b);
  return <section><h2>5. Preview exact public bytes</h2><h3>Markdown · {bytes.md_sha256}</h3><pre>{decode(bytes.md)}</pre>
    <h3>JSON · {bytes.json_sha256}</h3><pre>{decode(bytes.json)}</pre><h3>Inert reading pane</h3>
    <div className="reading-pane">{decode(bytes.md).split('\n\n').map((block, i) => <p key={i}>{block}</p>)}</div>
    <p>The reading pane renders text only. Images, HTML and links remain inert.</p></section>;
}
