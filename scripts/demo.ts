import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generate } from '../src/lib/fixtures/generate.ts';
import { redactSession } from '../src/lib/redactkit/index.ts';
import { selectExtractive } from '../src/lib/select/extractive.ts';
import { serialize } from '../src/lib/artifact/serialize.ts';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{const generated=generate(await readFile('fixtures/dev/dev-01.md.tmpl','utf8'),1047);
    const redacted=await redactSession(generated.session);if(!redacted.ok)throw new Error('redaction_blocked');
    const selected=selectExtractive(redacted);if(!selected.ok)throw new Error('selection_abstained');
    const bytes=await serialize(redacted,selected.candidate,'s47.synthetic.v1');
    console.log(JSON.stringify({status:'synthetic_preview_only',md_bytes:bytes.md.length,json_bytes:bytes.json.length,approval:false}));
  }catch{console.error('demo_blocked');process.exitCode=1;}
}
