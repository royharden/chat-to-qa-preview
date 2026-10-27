import { normalisations } from './normalise.ts';
export interface PlantedIdentifier { readonly id: string; readonly kind: string; readonly value: string }
export const SECRET_KINDS = new Set(['GH_PAT','AWS_KEY_ID','AWS_SECRET','OPENAI_KEY','SLACK_TOKEN','JWT','PEM_BLOCK','BEARER','BASIC_AUTH_URL','TOKEN_QUERY_URL','CONN_STRING','HIGH_ENTROPY']);
const INSENSITIVE = new Set(['EMAIL','INTERNAL_HOST','IPV6','UUID','WIN_HOME']);
export function leaked(surface: string, identifier: PlantedIdentifier): boolean {
  const insensitive = INSENSITIVE.has(identifier.kind);
  const texts = normalisations(surface, insensitive);
  const values = normalisations(identifier.value, insensitive);
  for (const text of texts) for (const value of values) {
    if (text.includes(value)) return true;
    if (SECRET_KINDS.has(identifier.kind) && value.length >= 16) {
      for (let i = 0; i <= value.length - 12; i++) if (text.includes(value.slice(i, i + 12))) return true;
    }
  }
  return false;
}
export function leakedIds(surface: string, identifiers: readonly PlantedIdentifier[]): readonly string[] {
  return identifiers.filter(identifier => leaked(surface, identifier)).map(identifier => identifier.id);
}
