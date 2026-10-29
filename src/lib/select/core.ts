import type { SpanSource } from '../spans/validate.ts';
import { candidateTurns } from '../session/views.ts';
import { splitBlocks } from '../spanground/split.ts';
import type { SourceBlock } from '../spanground/split.ts';
import { QA_LIMITS } from './types.ts';
import type { QaBlock, ScoredPair, SelectionResult } from './types.ts';

/** Shared deterministic selector for evaluator arms; product callers use branded extractive.ts. */
function eligibleTurns(session: SpanSource) {
  const turns = session.turns.filter((turn): turn is { readonly id: string; readonly role: 'user' | 'assistant'; readonly text: string } => turn.role === 'user' || turn.role === 'assistant');
  return candidateTurns({ turns }, new Set());
}
const QUESTION_FIRST = /^(how|why|what|which|can|should|is|does)\b/iu;
const AMBIGUOUS_FIRST = /^(it|this|that|above)\b/iu;
const RECOMMENDATION = /\b(use|set|add|change|run|replace|switch|upgrade|pin)\b/iu;

export function rankPairsCore(session: SpanSource): readonly ScoredPair[] {
  const turns = eligibleTurns(session);
  const pairs: ScoredPair[] = [];
  for (let i = 0; i < turns.length; i += 1) {
    const user = turns[i]!;
    if (user.role !== 'user') continue;
    const firstWordText = user.text.trimStart();
    const questionScore = (user.text.includes('?') ? 2 : 0) + (QUESTION_FIRST.test(firstWordText) ? 1 : 0) - (AMBIGUOUS_FIRST.test(firstWordText) ? 1 : 0);
    for (let j = i + 1; j < turns.length; j += 1) {
      const assistant = turns[j]!;
      if (assistant.role === 'user') break;
      if (assistant.role !== 'assistant') continue;
      const split = splitBlocks(assistant.text);
      const code = split.ok && split.blocks.some((block) => block.kind === 'code');
      const verb = RECOMMENDATION.test(assistant.text);
      if (questionScore >= 1 && (code || verb)) {
        pairs.push({ user_turn_id: user.id, assistant_turn_id: assistant.id, user_index: i, assistant_index: j, question_score: questionScore, score: questionScore + (code ? 2 : 0) + (verb ? 1 : 0) });
      }
      break; // Only the first assistant before the next user can be paired.
    }
  }
  return Object.freeze(pairs.sort((a, b) => b.score - a.score || b.user_index - a.user_index));
}

function cite(block: SourceBlock, turnId: string, revision: string): QaBlock {
  return { kind: block.kind, text: block.text, spans: [{ turn_id: turnId, start: block.start, end: block.end, source_revision: revision }] };
}

export function extractiveCore(session: SpanSource): SelectionResult {
  const pair = rankPairsCore(session)[0];
  if (!pair) return { ok: false, reason: 'no_qualifying_pair' };
  const turns = eligibleTurns(session);
  const user = turns[pair.user_index]!;
  const assistant = turns[pair.assistant_index]!;
  const questions = splitBlocks(user.text);
  const answers = splitBlocks(assistant.text);
  if (!questions.ok || !answers.ok) return { ok: false, reason: 'invalid_blocks' };
  const sentences = questions.blocks.filter((block) => block.kind === 'sentence');
  const question = sentences.find((block) => /\?["'\u2019\u201d)\]]*$/u.test(block.text)) ?? sentences[0];
  if (!question) return { ok: false, reason: 'invalid_blocks' };
  if (question.text.length > QA_LIMITS.question) return { ok: false, reason: 'question_limit' };
  const answer: QaBlock[] = [];
  let units = 0;
  for (const block of answers.blocks) {
    if (answer.length === QA_LIMITS.extractiveBlocks) break;
    const separator = answer.length > 0 ? 2 : 0;
    if (units + separator + block.text.length > QA_LIMITS.answer) break;
    answer.push(cite(block, assistant.id, session.source_revision));
    units += separator + block.text.length;
  }
  if (answer.length === 0) return { ok: false, reason: 'answer_limit' };
  return { ok: true, pair, candidate: { question: cite(question, user.id, session.source_revision), answer: Object.freeze(answer), source_revision: session.source_revision } };
}
