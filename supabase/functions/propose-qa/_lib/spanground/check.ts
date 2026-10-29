import type { QaBlock, QaCandidate } from '../select/types.ts';
import { QA_LIMITS } from '../select/types.ts';
import type { SpanSource } from '../spans/validate.ts';
import { validateSpan } from '../spans/validate.ts';
import { containsToken, extractCheckable } from './extract.ts';
import { normaliseCode, splitBlocks } from './split.ts';

export interface BlockCheck {
  readonly ok: boolean;
  readonly label: 'lexical-only';
  readonly reasons: readonly string[];
  readonly missing: readonly string[];
}
export interface CandidateCheck {
  readonly ok: boolean;
  readonly label: 'lexical-only';
  /** Question first, followed by all answer blocks, including failures. */
  readonly blocks: readonly BlockCheck[];
  readonly reasons: readonly string[];
}

export function checkBlock(session: SpanSource, block: QaBlock): BlockCheck {
  const reasons: string[] = [];
  const missing: string[] = [];
  if (block.spans.length < 1 || block.spans.length > QA_LIMITS.spansPerBlock) reasons.push('span_count');
  const split = splitBlocks(block.text);
  if (!split.ok || split.blocks.length !== 1 || split.blocks[0]?.kind !== block.kind) reasons.push('invalid_single_block');
  const evidence: string[] = [];
  for (const span of block.spans) {
    const result = validateSpan(session, span);
    if (!result.ok) {
      reasons.push(result.reason);
      continue;
    }
    evidence.push(result.text);
    const cited = splitBlocks(result.text);
    // Never let a broad paragraph or a mixed code/prose range serve as one citation.
    if (!cited.ok || cited.blocks.length !== 1) reasons.push('over_broad_span');
  }
  if (block.kind === 'code') {
    const equal = evidence.some((text) => {
      const cited = splitBlocks(text);
      return cited.ok && cited.blocks.length === 1 && cited.blocks[0]?.kind === 'code' && normaliseCode(text) === normaliseCode(block.text);
    });
    if (!equal) reasons.push('code_not_equal');
  } else {
    for (const token of extractCheckable(block.text)) {
      if (!evidence.some((text) => containsToken(text, token))) missing.push(token);
    }
    if (missing.length > 0) reasons.push('missing_tokens');
  }
  return { ok: reasons.length === 0, label: 'lexical-only', reasons: Object.freeze([...new Set(reasons)]), missing: Object.freeze(missing) };
}

export function checkCandidate(session: SpanSource, candidate: QaCandidate): CandidateCheck {
  const reasons: string[] = [];
  if (candidate.source_revision !== session.source_revision) reasons.push('wrong_revision');
  if (candidate.question.kind !== 'sentence') reasons.push('question_kind');
  if (candidate.question.text.length > QA_LIMITS.question) reasons.push('question_limit');
  if (candidate.answer.length < 1 || candidate.answer.length > QA_LIMITS.blocks) reasons.push('block_limit');
  if (candidate.answer.map((block) => block.text).join('\n\n').length > QA_LIMITS.answer) reasons.push('answer_limit');
  const blocks = [candidate.question, ...candidate.answer].map((block) => checkBlock(session, block));
  for (const block of blocks) reasons.push(...block.reasons);
  return { ok: reasons.length === 0, label: 'lexical-only', blocks: Object.freeze(blocks), reasons: Object.freeze([...new Set(reasons)]) };
}
