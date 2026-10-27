import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { generate } from '../../src/lib/fixtures/generate.ts';
import { parseXexportMd } from '../../src/lib/adapters/xexportMd.ts';
import { parseChatSessionJson } from '../../src/lib/adapters/chatSessionJson.ts';
// what_bug_this_catches: the recipe materializer and actual import adapters disagreeing about turns/details/fences.
it('imports both twins as the same canonical chat for every dev recipe and seed',async()=>{
  const manifest=JSON.parse(await readFile('fixtures/dev/MANIFEST.json','utf8')) as {entries:{template:string;seeds:number[]}[]};
  for(const entry of manifest.entries)for(const seed of entry.seeds){
    const generated=generate(await readFile('fixtures/dev/'+entry.template,'utf8'),seed),encoder=new TextEncoder();
    const markdown=parseXexportMd(encoder.encode(generated.markdown)),json=parseChatSessionJson(encoder.encode(generated.json));
    expect(markdown.ok).toBe(true);expect(json.ok).toBe(true);
    if(markdown.ok&&json.ok){expect(markdown.session).toEqual(json.session);expect(json.session).toEqual(generated.session);}
  }
});
