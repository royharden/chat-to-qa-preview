import {chars} from './prng.ts';
import type {Random} from './prng.ts';
export const SLOT_KINDS=['EMAIL','PHONE','GH_PAT','AWS_KEY_ID','AWS_SECRET','OPENAI_KEY','SLACK_TOKEN','JWT','PEM_BLOCK','BEARER','BASIC_AUTH_URL','TOKEN_QUERY_URL','CONN_STRING','INTERNAL_HOST','IPV4','IPV6','WIN_HOME','UNIX_HOME','HANDLE','SIG_NAME','PROSE_NAME','UUID','HIGH_ENTROPY','GIT_SHA','SEMVER','IP_LIKE_VERSION','LINE_COL','BASE64_DECOY'] as const;
export type SlotKind=typeof SLOT_KINDS[number];
export type SlotValue={id:string;kind:SlotKind;value:string};
export const DECOYS: readonly SlotKind[]=['GIT_SHA','SEMVER','IP_LIKE_VERSION','LINE_COL','BASE64_DECOY'];
export function slotValue(kind:SlotKind,r:Random):string {
 const n=()=>Math.floor(r()*100), lower=()=>chars(r,8,'abcdefghijklmnopqrstuvwxyz0123456789');
 switch(kind) {
 case 'EMAIL':return lower()+'@fixture'+n()+'.invalid';
 case 'PHONE':return '+1-202-555-01'+String(n()).padStart(2,'0');
 case 'GH_PAT':return ['gh','p_'].join('')+chars(r,36);
 case 'AWS_KEY_ID':return ['AK','IA'].join('')+chars(r,16,'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
 case 'AWS_SECRET':return chars(r,40);
 case 'OPENAI_KEY':return ['s','k-'].join('')+chars(r,32);
 case 'SLACK_TOKEN':return ['xo','xb-'].join('')+chars(r,24);
 case 'JWT':return ['ey','J'].join('')+chars(r,20)+'.'+chars(r,24)+'.'+chars(r,32);
 case 'PEM_BLOCK':return ['-----BE','GIN PRIVATE KEY-----\n',chars(r,64),'\n-----END PRIVATE KEY-----'].join('');
 case 'BEARER':return 'Bearer '+chars(r,32);
 case 'BASIC_AUTH_URL':return 'https://fixture:'+chars(r,24)+'@service.invalid/api';
 case 'TOKEN_QUERY_URL':return 'https://service.invalid/api?token='+chars(r,28);
 case 'CONN_STRING':return 'postgresql://fixture:'+chars(r,24)+'@db.invalid/app';
 case 'INTERNAL_HOST':return 'node'+n()+'.'+['internal','local','home.arpa'][n()%3];
 case 'IPV4':return '192.0.2.'+(1+n());
 case 'IPV6':return '2001:db8::'+chars(r,4,'0123456789abcdef');
 case 'WIN_HOME':return 'C:\\Users\\Fixture'+chars(r,6)+'\\project';
 case 'UNIX_HOME':return '/home/fixture'+lower()+'/project';
 case 'HANDLE':return '@fixture'+lower();
 case 'SIG_NAME':case 'PROSE_NAME':return 'Fixture Person '+chars(r,5,'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
 case 'UUID':return chars(r,8,'0123456789abcdef')+'-'+chars(r,4,'0123456789abcdef')+'-4'+chars(r,3,'0123456789abcdef')+'-a'+chars(r,3,'0123456789abcdef')+'-'+chars(r,12,'0123456789abcdef');
 case 'HIGH_ENTROPY':return chars(r,48);
 case 'GIT_SHA':return 'commit '+chars(r,40,'0123456789abcdef');
 case 'SEMVER':return 'v'+(1+n())+'.'+n()+'.'+n();
 case 'IP_LIKE_VERSION':return 'version '+n()+'.'+n()+'.'+n()+'.'+n();
 case 'LINE_COL':return (n()+1)+':'+(n()+1);
 case 'BASE64_DECOY':return 'base64 '+btoa('fixture public documentation');
 }
}
