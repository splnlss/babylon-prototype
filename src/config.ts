export const MANIFEST_URL = 'https://pub-dd92ae5131ec49f1bbd411b51a858249.r2.dev/20260820_RondaLobato/lod-meta.json';

export const START = { x: 2.5, y: 3.6, z: 24 } as const;
// Turn the original pole-facing heading 45 degrees left without moving the camera.
export const TARGET = { x: 4.267767, y: 3.6, z: 17.282486 } as const;
export const WALK_SPEED = 3;
export const POI_FLOOR_Y = 2;

export const STREAM_OPTIONS = {
  memoryBudgetMb: 128,
  maxDetailLod: 0,
  splatBudget: 600_000,
  decodeSh: false,
  maxConcurrentDownloads: 2,
} as const;

// Leave headroom above the 196,908-splat base layer for on-demand detail.
export const XR_SPLAT_BUDGET = 300_000;
export const XR_FRAMEBUFFER_SCALE = 0.5;
export const XR_FIXED_FOVEATION = 1;
