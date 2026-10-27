import type {Provider} from './types.ts';
import {completeLive} from './anthropic.ts';
/** Only the fixed OpenAI endpoint is supported; no user-supplied base URL. */
export const openaiCompatibleProvider:Provider={complete:(r,c)=>c?completeLive('openai',r,c):Promise.resolve({ok:false,reason:'live_context_required'})};
