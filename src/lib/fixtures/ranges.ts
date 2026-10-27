export function reservedValue(kind: string,value: string): boolean {
 switch(kind) {
 case 'EMAIL': return /^[a-z0-9]+@fixture[0-9]+\.invalid$/.test(value);
 case 'PHONE': return /^\+1-202-555-01[0-9]{2}$/.test(value);
 case 'IPV4': return /^(?:192\.0\.2|198\.51\.100|203\.0\.113)\.(?:[1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])$/.test(value);
 case 'IPV6': return /^2001:db8:[0-9a-f:]+$/i.test(value);
 case 'INTERNAL_HOST': return /^node[0-9]+\.(?:internal|local|home\.arpa)$/.test(value);
 case 'BASIC_AUTH_URL': case 'TOKEN_QUERY_URL': return new URL(value).hostname.endsWith('.invalid');
 case 'WIN_HOME': return /^C:\\Users\\Fixture[A-Za-z0-9]+\\/.test(value);
 case 'UNIX_HOME': return /^\/home\/fixture[a-z0-9]+\//.test(value);
 case 'HANDLE': return /^@fixture[a-z0-9]+$/.test(value);
 case 'SIG_NAME': case 'PROSE_NAME': return /^Fixture Person [A-Z]+$/.test(value);
 case 'CONN_STRING': return value.includes('@db.invalid/');
 default:return true;
 }
}
