import {
  GaussianSplattingStream,
  type ISOGLODMetadata,
} from '@babylonjs/loaders/SPLAT/gaussianSplattingStream.js';

export async function fetchManifest(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<{ metadata: ISOGLODMetadata; rootUrl: string }> {
  let response: Response;
  try {
    response = await fetcher(url);
  } catch (error) {
    throw new Error(`Manifest ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    throw new Error(`Manifest ${url}: HTTP ${response.status}`);
  }
  let metadata: unknown;
  try {
    metadata = await response.json();
  } catch {
    throw new Error(`Manifest ${url}: invalid JSON`);
  }
  if (!GaussianSplattingStream.IsLODMetadata(metadata)) {
    throw new Error(`Manifest ${url}: invalid streamed SOG metadata`);
  }
  return { metadata, rootUrl: new URL('.', url).href };
}

export function replaceStream<T extends { dispose(): void }>(
  oldStream: T | null,
  createNext: () => T,
): T {
  oldStream?.dispose();
  return createNext();
}
