import { describe, expect, it, vi } from 'vitest';
import { requireAdmission } from '../../scripts/eval.ts';
// what_bug_this_catches: treating an absent or NO_GO receipt as permission to consume a hidden split.
vi.mock('node:fs/promises',()=>({readFile:vi.fn(async()=>JSON.stringify({decision:'NO_GO'}))}));
describe('held-out gate refusal (unexecuted)',()=>{
  it('refuses NO_GO before hashing or reading data sets',async()=>{
    await expect(requireAdmission({receipt:'explicit-receipt',templates:'explicit-templates',materialised:'explicit-materialised',labels:'explicit-labels',oracle:'explicit-oracle',devTemplates:'explicit-dev'})).rejects.toThrow('admission_required');
  });
});
