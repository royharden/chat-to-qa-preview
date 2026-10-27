import {describe,it,expect} from 'vitest';
import {verifyRedacted,isRedactedSession,RULES_VERSION} from '../../src/lib/redactkit/index.ts';
import {buildModelInput,MODEL_INPUT_LIMIT} from '../../src/lib/select/modelInput.ts';
import {mockProvider} from '../../src/lib/providers/mock.ts';
import {requestBody,inputTokensUpper} from '../../src/lib/providers/prompt.ts';
import type {ChatSessionV1} from '../../src/lib/schema/chatSession.ts';
import type {Provider} from '../../src/lib/providers/types.ts';
function compileBoundary(provider:Provider,raw:ChatSessionV1){
 // @ts-expect-error raw session cannot enter provider
 void provider.complete(raw);
 // @ts-expect-error strings cannot enter provider
 void provider.complete('text');
 // @ts-expect-error plain turn arrays cannot enter provider
 void provider.complete(raw.turns);
}
void compileBoundary;
describe('bounded redacted request',()=>{
 it('brands only genuine redacted sessions, chooses top pair and whole neighbours',async()=>{
 const session=await verifyRedacted([
 {id:'t1',role:'user',text:'Earlier topic.'},{id:'t2',role:'assistant',text:'Earlier response.'},
 {id:'t3',role:'user',text:'How can I set mode safe?'},{id:'t4',role:'assistant',text:'Set mode safe.'},
 {id:'t5',role:'user',text:'Thanks.'}],RULES_VERSION);
 if(!isRedactedSession(session))throw new Error('fixture_redaction_failed');
 const selected=buildModelInput(session);expect(selected.ok).toBe(true);if(!selected.ok)return;
 expect(selected.input_turn_ids).toEqual(['t2','t3','t4','t5']);expect(selected.input_units).toBeLessThanOrEqual(MODEL_INPUT_LIMIT);
 const body=requestBody(selected.request,'anthropic','fixture-model');
 expect(inputTokensUpper(body)).toBe(new TextEncoder().encode(body).byteLength+512);
 const result=await mockProvider.complete(selected.request);expect(result.ok).toBe(true);
 });
 it('rejects a structural brand forgery at runtime',()=>{
 expect(buildModelInput({ok:true,turns:[]} as never)).toEqual({ok:false,reason:'invalid_session'});
 });
 it('refuses a core pair over limit without truncating turns',async()=>{
 const session=await verifyRedacted([{id:'t1',role:'user',text:'How? '+ 'word '.repeat(2500)},{id:'t2',role:'assistant',text:'Use '+ 'word '.repeat(2500)}],RULES_VERSION);
 if(!isRedactedSession(session))throw new Error('fixture_redaction_failed');
 expect(buildModelInput(session)).toEqual({ok:false,reason:'model_input_limit'});
 });
});
