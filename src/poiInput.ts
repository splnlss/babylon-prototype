import type { Scene } from '@babylonjs/core/scene.js';
import type { Ray } from '@babylonjs/core/Culling/ray.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { MediaStatus } from './media.js';

/** The same pick route is called by desktop clicks and WebXR select events. */
export function selectMediaFromRay(
  scene: Scene,
  ray: Ray,
  targets: Mesh[],
  phase: MediaStatus['phase'],
  toggleVideo: () => void,
  retry: () => void,
): boolean {
  if (!targets.length) return false;
  const targetSet = new Set(targets);
  const hit = scene.pickWithRay(ray, mesh => targetSet.has(mesh as Mesh));
  if (!hit?.hit) return false;
  if (phase === 'blocked' || phase === 'error') retry();
  else toggleVideo();
  return true;
}
