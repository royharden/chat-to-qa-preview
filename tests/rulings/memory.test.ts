import { it, expect } from 'vitest';
import { memoryStore } from '../../src/lib/rulings/memory.ts';
// what_bug_this_catches: using a transient fallback as approval persistence.
it('marks memory-only rulings nondurable and copies history', async () => {
  const store = memoryStore(); expect(store.durable).toBe(false);
  const rows = await store.list(); expect(rows).toEqual([]);
  expect(await store.list()).not.toBe(rows);
});
