import type {RedactedSession} from '../redactkit/brand.ts';
import {buildModelInput} from './modelInput.ts';
import type {Provider,LiveContext,ProviderResult} from '../providers/types.ts';
import {defaultProvider} from '../providers/mock.ts';
export async function selectModel(session:RedactedSession,provider:Provider=defaultProvider,context?:LiveContext):Promise<ProviderResult>{
 const input=buildModelInput(session);if(!input.ok)return input;
 return provider.complete(input.request,context);
}
