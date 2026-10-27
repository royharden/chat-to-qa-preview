// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import type {ComponentProps} from 'react';
import {createRoot} from 'react-dom/client';
import type {Root} from 'react-dom/client';
import type {ImportReview} from '../../src/components/ImportReview.tsx';
import type {DenyListReview} from '../../src/components/DenyListReview.tsx';
import type {RedactionReview} from '../../src/components/RedactionReview.tsx';
import type {Approval} from '../../src/components/Approval.tsx';
import {App} from '../../src/components/App.tsx';
import {redactSession} from '../../src/lib/redactkit/index.ts';
import {redactSession as engineRedact} from '../../src/lib/redactkit/engine.ts';
import {seeded} from '../../src/lib/fixtures/prng.ts';
import {slotValue} from '../../src/lib/fixtures/slots.ts';

const controls=vi.hoisted(()=>({
 importReview:null as ComponentProps<typeof ImportReview>|null,
 deny:null as ComponentProps<typeof DenyListReview>|null,
 redaction:null as ComponentProps<typeof RedactionReview>|null,
 approval:null as ComponentProps<typeof Approval>|null,
}));
vi.mock('../../src/components/ImportReview.tsx',()=>({ImportReview:(p:ComponentProps<typeof ImportReview>)=>{controls.importReview=p;return null;}}));
vi.mock('../../src/components/DenyListReview.tsx',()=>({DenyListReview:(p:ComponentProps<typeof DenyListReview>)=>{controls.deny=p;return null;}}));
vi.mock('../../src/components/RedactionReview.tsx',()=>({RedactionReview:(p:ComponentProps<typeof RedactionReview>)=>{controls.redaction=p;return null;}}));
vi.mock('../../src/components/Approval.tsx',()=>({Approval:(p:ComponentProps<typeof Approval>)=>{controls.approval=p;return null;}}));
vi.mock('../../src/components/ExactBytes.tsx',()=>({ExactBytes:()=>null}));
vi.mock('../../src/components/QaEditor.tsx',()=>({QaEditor:()=>null}));
vi.mock('../../src/lib/rulings/indexeddb.ts',()=>({openRulings:async()=>({durable:true,append:async()=>{},list:async()=>[]})}));
// Byte serialization/storage are separate tests; these fakes isolate App operation lifetime.
vi.mock('../../src/lib/state/approval.ts',()=>({prepare:async()=>({}),approve:async()=>({decision:'approve'}),downloadBytes:async()=>new Uint8Array()}));
vi.mock('../../src/lib/redactkit/index.ts',async original=>{
 const actual=await original<typeof import('../../src/lib/redactkit/index.ts')>();
 return {...actual,redactSession:vi.fn(actual.redactSession)};
});

let root:Root,container:HTMLDivElement;
let pending:Promise<Awaited<ReturnType<typeof engineRedact>>>[];
const redactor=vi.mocked(redactSession);
function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(reason:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
beforeEach(async()=>{
 (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 controls.importReview=null;controls.deny=null;controls.redaction=null;controls.approval=null;
 pending=[];redactor.mockReset();redactor.mockImplementation((...args)=>{const promise=engineRedact(...args);pending.push(promise);return promise;});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>{root.render(createElement(App));});
});
afterEach(async()=>{await act(async()=>{root.unmount();});container.remove();});
async function imported(answer='Use --strict for configuration.'){
 const bytes=new TextEncoder().encode('## 👤 User\nHow should I use --strict?\n\n## 🤖 Assistant\n'+answer+'\n');
 const file=new File([bytes],'synthetic.md');Object.defineProperty(file,'arrayBuffer',{value:async()=>bytes.buffer});
 const input=container.querySelector<HTMLInputElement>('input[type="file"]')!;
 Object.defineProperty(input,'files',{value:[file],configurable:true});
 await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>{controls.importReview!.confirm();});
 await act(async()=>{controls.deny!.confirm([]);});
}
async function realRedaction(action=()=>controls.redaction!.redact()){
 await act(async()=>{action();await pending[pending.length-1];});
}
async function approved(){
 await imported();await realRedaction();
 expect(controls.approval!.ready).toBe(true);
 await act(async()=>{controls.approval!.approve();});
 expect(controls.approval!.approved).toBe(true);
}
describe('App redaction operation lifetime (unexecuted)',()=>{
 // what_bug_this_catches: a blocking second entropy candidate used to discard the first valid manual selection.
 it('accumulates successive valid manual spans across blocked results and rejects invalid spans before storing',async()=>{
 const a=slotValue('HIGH_ENTROPY',seeded(701)),b=slotValue('HIGH_ENTROPY',seeded(702));
 const answer='Use --strict for configuration. First value '+a+'. Second value '+b+'.';
 await imported(answer);await realRedaction();
 expect(controls.redaction!.session).toBeNull();
 expect(container.textContent).toContain('2 findings');
 const first={turn_id:'t2',start:answer.indexOf(a),end:answer.indexOf(a)+a.length};
 const second={turn_id:'t2',start:answer.indexOf(b),end:answer.indexOf(b)+b.length};
 await realRedaction(()=>controls.redaction!.manual(first.turn_id,first.start,first.end));
 expect(container.textContent).toContain('1 findings');
 const calls=redactor.mock.calls.length;
 await act(async()=>{controls.redaction!.manual('t2',-1,1);});
 expect(redactor).toHaveBeenCalledTimes(calls);
 expect(container.textContent).toContain('M_INVALID_SPAN');
 await realRedaction(()=>controls.redaction!.manual(second.turn_id,second.start,second.end));
 expect(redactor.mock.calls.at(-1)![1]!.manualSpans).toEqual([first,second]);
 expect(controls.redaction!.session).not.toBeNull();
 expect(controls.redaction!.session!.turns[1]!.text).not.toContain(a);
 expect(controls.redaction!.session!.turns[1]!.text).not.toContain(b);
 });
 // what_bug_this_catches: rejected async engine/crypto work used to leave the old approved candidate downloadable.
 it('revokes approved bytes immediately and keeps them revoked after redactor rejection',async()=>{
 await approved();const request=deferred<Awaited<ReturnType<typeof engineRedact>>>();
 redactor.mockImplementationOnce(()=>request.promise);
 await act(async()=>{controls.redaction!.redact();});
 expect(controls.approval!.ready).toBe(false);expect(controls.approval!.approved).toBe(false);
 expect(controls.redaction!.session).toBeNull();
 await act(async()=>{request.reject(new Error('synthetic_crypto_failure'));await Promise.resolve();});
 expect(container.textContent).toContain('synthetic_crypto_failure');
 expect(controls.approval!.ready).toBe(false);expect(controls.approval!.approved).toBe(false);
 });
 // what_bug_this_catches: a late completion must not publish after a newer review operation changes the epoch.
 it('ignores redaction completion from an epoch superseded by a names-list edit',async()=>{
 await approved();const old=controls.redaction!.session!;
 const request=deferred<Awaited<ReturnType<typeof engineRedact>>>();redactor.mockImplementationOnce(()=>request.promise);
 await act(async()=>{controls.redaction!.redact();});
 await act(async()=>{controls.deny!.changed(['Fixture Reviewer']);});
 await act(async()=>{request.resolve(old);await request.promise;});
 expect(controls.redaction!.session).toBeNull();expect(controls.redaction!.enabled).toBe(false);
 expect(controls.approval!.ready).toBe(false);expect(controls.approval!.approved).toBe(false);
 });
});
