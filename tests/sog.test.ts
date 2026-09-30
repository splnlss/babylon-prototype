import { describe, expect, it } from 'vitest';
import { fetchManifest, replaceStream } from '../src/sog';

const url = 'https://assets.example.test/ronda/lod-meta.json';
const metadata = {
  lodLevels: 5,
  filenames: ['4_0/meta.json'],
  tree: {
    bound: { min: [-1, -1, -1], max: [1, 1, 1] },
    lods: { '4': { file: 0, offset: 0, count: 10 } },
  },
};

describe('fetchManifest', () => {
  it('returns Babylon LOD metadata and the sibling chunk root', async () => {
    const fetcher = async () => new Response(JSON.stringify(metadata), { status: 200 });
    const result = await fetchManifest(url, fetcher);
    expect(result).toEqual({ metadata, rootUrl: 'https://assets.example.test/ronda/' });
  });

  it('reports a denied manifest URL', async () => {
    const fetcher = async () => new Response('Forbidden', { status: 403 });
    await expect(fetchManifest(url, fetcher)).rejects.toThrow(`Manifest ${url}: HTTP 403`);
  });

  it('rejects a JSON document without the streamed-SOG shape', async () => {
    const fetcher = async () => new Response(JSON.stringify({ version: 1 }), { status: 200 });
    await expect(fetchManifest(url, fetcher)).rejects.toThrow(`Manifest ${url}: invalid streamed SOG metadata`);
  });
});

describe('replaceStream', () => {
  it('disposes the old stream once before creating its replacement', () => {
    const order: string[] = [];
    const oldStream = { dispose: () => order.push('dispose') };
    const nextStream = { dispose: () => order.push('dispose next') };
    const replacement = replaceStream(oldStream, () => {
      order.push('create');
      return nextStream;
    });
    expect(replacement).toBe(nextStream);
    expect(order).toEqual(['dispose', 'create']);
  });
});
