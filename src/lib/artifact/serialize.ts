import { isRedactedSession } from '../redactkit/index.ts';
import type { RedactedSession } from '../redactkit/index.ts';
import type { QaCandidate } from '../select/types.ts';
import { checkCandidate } from '../spanground/index.ts';
import { buildExcerpts } from './excerpts.ts';
import { serializeCore } from './core.ts';
import { sha256 } from './hash.ts';
import { scanArtifact } from './scan.ts';
export async function serialize(session: RedactedSession, candidate: QaCandidate, profileId: string, denyList: readonly string[] = []) {
  if (!isRedactedSession(session) || candidate.source_revision !== session.source_revision) throw new Error('stale_or_unbranded');
  const grounding = checkCandidate(session, candidate);
  if (!grounding.ok) throw new Error(`grounding_blocked:${grounding.reasons.join(',')}`);
  const content = {
    question: candidate.question, answer: candidate.answer,
    excerpts: buildExcerpts(session, [candidate.question, ...candidate.answer].flatMap(b => [...b.spans])),
    source_revision: session.source_revision, rules_version: session.rules_version, profile_id: profileId,
  };
  const bytes = serializeCore(content);
  const scan = await scanArtifact(content, bytes, denyList);
  if (!scan.ok) throw new Error(`rescan_blocked:${scan.reasons.join(',')}`);
  return { ...bytes, md_sha256: await sha256(bytes.md), json_sha256: await sha256(bytes.json), scan_digest: scan.digest };
}
