import {z} from 'zod';
import {checkCandidate} from '../spanground/index.ts';
import type {RedactedRequest} from '../select/modelInput.ts';
import type {QaCandidate} from '../select/types.ts';
const span=z.object({turn_id:z.string().regex(/^t[1-9][0-9]{0,3}$/),start:z.number().int().nonnegative(),end:z.number().int().positive(),source_revision:z.string().regex(/^[a-f0-9]{16}$/)}).strict();
const block=z.object({kind:z.enum(['sentence','code']),text:z.string().min(1).max(2000),spans:z.array(span).min(1).max(3)}).strict();
export const CandidateSchema=z.object({source_revision:z.string().regex(/^[a-f0-9]{16}$/),question:block,answer:z.array(block).min(1).max(8)}).strict().superRefine((v,c)=>{
 if(v.question.kind!=='sentence'||v.question.text.length>500||v.answer.map(b=>b.text).join('\n\n').length>2000)c.addIssue({code:z.ZodIssueCode.custom,message:'model_limits'});
});
export function parseCandidate(value:unknown,request:RedactedRequest):QaCandidate{
 const candidate=CandidateSchema.parse(value);if(!checkCandidate(request,candidate).ok)throw new Error('grounding_failed');return candidate;
}
