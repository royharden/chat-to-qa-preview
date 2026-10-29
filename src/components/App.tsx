import { useEffect, useRef, useState } from 'react';
import { importChatFile, refusalMessage } from '../lib/adapters/index.ts';
import { redactSession } from '../lib/redactkit/index.ts';
import type { ManualSpan } from '../lib/redactkit/index.ts';
import { selectExtractive } from '../lib/select/extractive.ts';
import { validateSpan } from '../lib/spans/validate.ts';
import { initialState, importedState, excludeTurn, confirmImport, changeDenyList, acceptRedaction, editCandidate, canProceed } from '../lib/state/session.ts';
import type { PreviewState } from '../lib/state/session.ts';
import { approve, downloadBytes, prepare } from '../lib/state/approval.ts';
import { openRulings } from '../lib/rulings/indexeddb.ts';
import { memoryStore } from '../lib/rulings/memory.ts';
import type { RulingsStore } from '../lib/rulings/store.ts';
import { ImportReview } from './ImportReview.tsx';
import { DenyListReview } from './DenyListReview.tsx';
import { RedactionReview } from './RedactionReview.tsx';
import { QaEditor } from './QaEditor.tsx';
import { ExactBytes } from './ExactBytes.tsx';
import { Approval } from './Approval.tsx';
export function App() {
  const [state, setState] = useState(initialState);
  const current = useRef(state);
  const loadToken = useRef(0);
  const spans = useRef<ManualSpan[]>([]);
  const [message, setMessage] = useState('Import one synthetic chat to start.');
  const [busy, setBusy] = useState(false);
  const [store, setStore] = useState<RulingsStore>(memoryStore);
  const [preview, setPreview] = useState<{ epoch: number; bytes: Awaited<ReturnType<typeof prepare>> } | null>(null);
  function update(next: PreviewState) { current.current = next; setState(next); }
  useEffect(() => { let cancelled = false; void openRulings().then(value => { if (!cancelled) setStore(value); }).catch(() => { if (!cancelled) setMessage('Storage unavailable. You can review, but approval is blocked.'); }); return () => { cancelled = true; }; }, []);
  useEffect(() => {
    let cancelled = false; setPreview(null);
    if (state.candidate && canProceed(state)) void prepare(state).then(bytes => {
      if (!cancelled && current.current.epoch === state.epoch) setPreview({ epoch: state.epoch, bytes });
    }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'preview_blocked'); });
    return () => { cancelled = true; };
  }, [state]);
  async function load(file: File) {
    const token = ++loadToken.current;
    update({ ...initialState(), epoch: current.current.epoch + 1 }); spans.current = []; setPreview(null);
    if (file.size > 5 * 1024 * 1024) { setMessage('oversize_file'); return; }
    try { const bytes = new Uint8Array(await file.arrayBuffer()); if (token !== loadToken.current) return;
      const result = importChatFile(bytes, file.name);
      if (!result.ok) { setMessage(refusalMessage(result.refusal)); return; }
      update(importedState(current.current, result)); setMessage('Review all roles and dropped regions before confirming.');
    } catch { if (token === loadToken.current) setMessage('file_read_failed'); }
  }
  async function redact(manual?: ManualSpan) {
    const previous = current.current; if (!previous.imported || !canProceed(previous)) return;
    const snapshot = { ...previous, epoch: previous.epoch + 1, redacted: null, candidate: null, approval: null };
    // Revoke the old bytes before any validation, crypto or engine work can fail or yield.
    update(snapshot); setPreview(null);
    setBusy(true); setMessage('Redacting…');
    try {
      if (manual && (snapshot.excluded.has(manual.turn_id) || !validateSpan(
        { ...previous.imported.session, source_revision: 'manual-source' },
        { ...manual, source_revision: 'manual-source' },
      ).ok)) throw new Error('M_INVALID_SPAN');
      const manualSpans = manual ? [...spans.current, manual] : spans.current;
      // These raw-source offsets are structurally valid even if other entropy findings still block.
      spans.current = manualSpans;
      const result = await redactSession(previous.imported.session, { excludedTurnIds: snapshot.excluded, denyList: snapshot.denyList, manualSpans });
      if (current.current.epoch !== snapshot.epoch) return;
      if (!result.ok) { setMessage(`Redaction blocked: ${result.findings.length} findings need manual redaction.`); return; }
      const selected = selectExtractive(result);
      update(acceptRedaction(snapshot, snapshot.epoch, result, selected.ok ? selected.candidate : null));
      setMessage(selected.ok ? 'Inspect redaction and the selected Q&A.' : `Abstained: ${selected.reason}`);
    } catch (error) { if (current.current.epoch === snapshot.epoch) setMessage(error instanceof Error ? error.message : 'redaction_failed'); }
    finally { setBusy(false); }
  }
  async function doApprove() {
    const snapshot = current.current; setBusy(true);
    try { const row = await approve(snapshot, store); if (current.current.epoch === snapshot.epoch) { update({ ...snapshot, approval: row }); setMessage('Both byte hashes approved.'); } }
    catch (error) { setMessage(error instanceof Error ? error.message : 'approval_failed'); }
    finally { setBusy(false); }
  }
  async function download(format: 'md' | 'json') {
    const snapshot = current.current; setBusy(true);
    try {
      const bytes = await downloadBytes(snapshot, format);
      if (current.current.epoch !== snapshot.epoch) throw new Error('stale_download');
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `qa-preview.${format}`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'download_blocked'); }
    finally { setBusy(false); }
  }
  const bytes = preview?.epoch === state.epoch ? preview.bytes : null;
  return <main><header><p className="eyebrow">LOCAL REVIEW · SYNTHETIC EVALUATION</p><h1>One chat. One cited answer.</h1>
    <p>Turn an exported chat into a redacted Q&amp;A you can inspect byte for byte.</p><p><strong>Not a privacy guarantee.</strong> Construction only: nothing has been installed, tested or run. No measured result exists.</p></header>
    <section><label className="file">Import Markdown or ChatSessionV1 JSON<input type="file" accept=".md,.markdown,.json" onChange={e => { const file = e.target.files?.[0]; if (file) void load(file); }} /></label>
      <p>No network is used by this review flow. Raw imports, names, drafts and placeholder maps stay in memory.</p></section>
    <p className="status" role="status">{message}</p>
    <ImportReview state={state} toggle={id => { spans.current = []; update(excludeTurn(current.current, id)); }} confirm={() => update(confirmImport(current.current))} />
    <DenyListReview key={state.imported?.session.turns === undefined ? 'empty' : loadToken.current} enabled={state.importConfirmed} confirmed={state.denyConfirmed}
      changed={values => update(changeDenyList(current.current, values))} confirm={values => update(changeDenyList(current.current, values, true))} />
    <RedactionReview session={state.redacted} enabled={canProceed(state)} busy={busy} redact={() => void redact()} manual={(turn_id, start, end) => void redact({ turn_id, start, end })} />
    {state.candidate && state.redacted && <QaEditor candidate={state.candidate} session={state.redacted} changed={candidate => update(editCandidate(current.current, candidate))} />}
    <ExactBytes bytes={bytes} /><Approval ready={!!bytes} approved={!!state.approval && !!bytes} durable={store.durable} busy={busy} approve={() => void doApprove()} download={format => void download(format)} />
    <footer>Grounding checks lexical support only. Names in prose, split identifiers and persuasive fabricated text can be missed. Held-out validation and live providers remain pending.</footer>
  </main>;
}
