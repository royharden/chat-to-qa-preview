// Test helpers: fixture locations and size-refusal recipe expansion. Recipes keep the repository small: a
// recipe is a list of parts, each `{text, times}` or `{parts, times}`, concatenated in order at test time.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const FIXTURES = fileURLToPath(new URL('../../fixtures/', import.meta.url));

export interface RecipePart {
  readonly text?: string;
  readonly times?: number;
  readonly parts?: readonly RecipePart[];
}

export interface Recipe {
  readonly recipe: string;
  readonly code: string;
  readonly fileName: string;
  readonly provenance: string;
  readonly parts: readonly RecipePart[];
}

function expandParts(parts: readonly RecipePart[], out: string[]): void {
  for (const part of parts) {
    const times = part.times ?? 1;
    for (let i = 0; i < times; i++) {
      if (part.text !== undefined) out.push(part.text);
      if (part.parts !== undefined) expandParts(part.parts, out);
    }
  }
}

export function loadRecipe(path: string): Recipe {
  return JSON.parse(readFileSync(path, 'utf8')) as Recipe;
}

export function expandRecipeText(recipe: Recipe): string {
  const out: string[] = [];
  expandParts(recipe.parts, out);
  return out.join('');
}

export function expandRecipe(recipe: Recipe): Uint8Array {
  return new TextEncoder().encode(expandRecipeText(recipe));
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Join lines with LF and end with LF. */
export function lines(...ls: string[]): string {
  return ls.join('\n') + '\n';
}

export const USER = '## 👤 User';
export const ASSISTANT = '## 🤖 Assistant';
export const CURSOR = '<!-- xexport-cursor synthetic-test -->';
