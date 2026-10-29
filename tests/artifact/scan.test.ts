import { expect, it } from 'vitest';
import { scanArtifact } from '../../src/lib/artifact/scan.ts';
import type { ArtifactContent } from '../../src/lib/artifact/core.ts';
import { redactSession } from '../../src/lib/redactkit/index.ts';
import { buildExcerpts } from '../../src/lib/artifact/excerpts.ts';
const encoder=new TextEncoder();
const clean:ArtifactContent={question:{text:'How should I set the cache?',spans:[]},answer:[{text:'Use the cache.',spans:[]}],excerpts:[],rules_version:'s47.redact.v1',profile_id:'s47.test.v1',source_revision:'1234567890abcdef'};
// what_bug_this_catches: leaking via a field outside Q&A text, encoded JSON, or bytes not reflected in the object.
it('rescans metadata, Markdown bytes, escaped answer text and deny terms independently',async()=>{
  const value=['seed','@example.test'].join('');
  for(const field of ['rules_version','profile_id','source_revision'] as const){
    const content={...clean,[field]:value};
    expect((await scanArtifact(content,{md:encoder.encode('safe'),json:encoder.encode(JSON.stringify(content))})).ok).toBe(false);
  }
  expect((await scanArtifact(clean,{md:encoder.encode(value),json:encoder.encode(JSON.stringify(clean))})).ok).toBe(false);
  const token=['s','k-',...Array.from({length:24},(_,i)=>String.fromCharCode(65+i))].join('');
  const content={...clean,answer:[{text:token.replace('s','\\u0073'),spans:[]}]};
  expect((await scanArtifact(content,{md:encoder.encode('safe'),json:encoder.encode(JSON.stringify(content))})).ok).toBe(false);
  expect((await scanArtifact(clean,{md:encoder.encode('safe'),json:encoder.encode(JSON.stringify(clean))},['cache'])).ok).toBe(false);
});
// what_bug_this_catches: accepting half a surrogate or permitting uncapped exact-source excerpt exports.
it('rejects a true surrogate split and an 8001-unit excerpt',async()=>{
  const session=await redactSession({turns:[{id:'t1',role:'user',text:'How should I use \u{1f600}?'},{id:'t2',role:'assistant',text:'Use '+ 'a'.repeat(8001)}]});
  if(!session.ok)throw new Error('fixture_redaction_failed');
  const offset=session.turns[0]!.text.indexOf('\u{1f600}');
  expect(()=>buildExcerpts(session,[{turn_id:'t1',start:offset+1,end:offset+2,source_revision:session.source_revision}])).toThrow('surrogate_boundary');
  expect(()=>buildExcerpts(session,[{turn_id:'t2',start:4,end:8005,source_revision:session.source_revision}])).toThrow('excerpt_cap_exceeded');
});
