import {seeded} from './prng.ts';
import {SLOT_KINDS,slotValue} from './slots.ts';
import type {SlotKind,SlotValue} from './slots.ts';
import {reservedValue} from './ranges.ts';
export type FixtureTurn={id:string;role:'user'|'assistant';text:string};
export type Generated={markdown:string;json:string;session:{schema_version:'s47.chat.v1';turns:FixtureTurn[]};slots:SlotValue[]};
export function generate(template:string,seed:number):Generated {
 if(!/^Author: .+$/m.test(template)||!/^Provenance: synthetic; lineage: (?:builder-dev|independent-heldout)$/m.test(template)) throw new Error('missing_provenance');
 const r=seeded(seed),values=new Map<string,SlotValue>();
 const markdown=template.replace(/\{\{([A-Z_]+):([a-z][a-z0-9_-]*)\}\}/g,(_,raw:string,id:string)=>{
 if(!(SLOT_KINDS as readonly string[]).includes(raw)) throw new Error('unknown_slot');
 const kind=raw as SlotKind,old=values.get(id);
 if(old&&old.kind!==kind) throw new Error('conflicting_slot');
 if(old)return old.value;
 const value=slotValue(kind,r);if(!reservedValue(kind,value))throw new Error('unreserved_value');
 values.set(id,{id,kind,value});return value;
 });
 if(/\{\{|\}\}/.test(markdown))throw new Error('malformed_slot');
 const turns:FixtureTurn[]=[];let current:FixtureTurn|undefined,fence:string|undefined,details=false;
 for(const line of markdown.replace(/\r\n/g,'\n').split('\n')){
 if(!fence&&!details&&/^## (?:👤 User|🤖 Assistant)\s*$/.test(line)){current={id:'t'+(turns.length+1),role:line.includes('👤')?'user':'assistant',text:''};turns.push(current);continue;}
 if(line.startsWith('<!-- xexport-cursor'))continue;
 if(!fence&&/^<details>\s*$/.test(line)){details=true;continue;}
 if(details){if(/^<\/details>\s*$/.test(line))details=false;continue;}
 const marker=line.match(/^ {0,3}(\x60{3,}|~{3,})/);
 if(marker){if(!fence)fence=marker[1]!;else if(marker[1]![0]===fence[0]&&marker[1]!.length>=fence.length)fence=undefined;}
 if(current)current.text+=line+'\n';
 }
 if(fence||details)throw new Error('unbalanced_template');
 for(const t of turns)t.text=t.text.trim();
 if(turns.length<12||turns.length>60)throw new Error('fixture_turn_count');
 const session={schema_version:'s47.chat.v1' as const,turns};
 return {markdown,json:JSON.stringify(session),session,slots:[...values.values()]};
}
