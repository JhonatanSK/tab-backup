import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { snapshot } from './fixtures';
import { semanticState } from '../src/domain/normalize';
import { serialize, parseBackup } from '../src/domain/serialization';
import { Repository } from '../src/storage/repository';
it.each([10, 100, 500, 1000])(
  'synthetic %i tab normalize/roundtrip/transaction',
  async (count) => {
    const s = snapshot('perf', count);
    const start = performance.now();
    semanticState(s.windows);
    const normalized = performance.now();
    const text = await serialize([s], '1.0.0');
    await parseBackup(text);
    const parsed = performance.now();
    const repo = new Repository(crypto.randomUUID());
    await repo.save(s);
    expect((await repo.list())[0]!.windows[0]!.tabs).toHaveLength(count);
    console.info(
      JSON.stringify({
        tabs: count,
        normalizeMs: +(normalized - start).toFixed(2),
        roundtripMs: +(parsed - normalized).toFixed(2),
        repositoryMs: +(performance.now() - parsed).toFixed(2),
        fileBytes: Buffer.byteLength(text),
      }),
    );
  },
);
