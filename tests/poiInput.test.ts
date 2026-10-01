import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { selectMediaFromRay } from '../src/poiInput.js';

describe('shared media selection', () => {
  it('routes one video toggle per ray action, and only when the active plane is hit', () => {
    const engine = new NullEngine(); const scene = new Scene(engine);
    const plane = MeshBuilder.CreatePlane('video', { size: 2 }, scene);
    plane.position.z = 2;
    const toggle = vi.fn(); const retry = vi.fn();
    const ray = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 10);
    expect(selectMediaFromRay(scene, ray, [plane], 'playing', toggle, retry)).toBe(true);
    expect(toggle).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(selectMediaFromRay(scene, new Ray(new Vector3(5, 0, 0), new Vector3(0, 0, 1), 10), [plane], 'playing', toggle, retry)).toBe(false);
    scene.dispose(); engine.dispose();
  });

  it('prioritizes blocked retry over video toggling', () => {
    const engine = new NullEngine(); const scene = new Scene(engine);
    const target = MeshBuilder.CreatePlane('retry', { size: 2 }, scene);
    target.position.z = 2;
    const toggle = vi.fn(); const retry = vi.fn();
    expect(selectMediaFromRay(scene, new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 10), [target], 'blocked', toggle, retry)).toBe(true);
    expect(retry).toHaveBeenCalledOnce(); expect(toggle).not.toHaveBeenCalled();
    scene.dispose(); engine.dispose();
  });

  it('retries blocked media from a pointer-locked center click when the status plane is off axis', () => {
    const engine = new NullEngine(); const scene = new Scene(engine);
    const target = MeshBuilder.CreatePlane('retry', { size: 0.8 }, scene);
    target.position.set(1, -0.65, 2);
    target.computeWorldMatrix(true);
    const toggle = vi.fn(); const retry = vi.fn();
    const centerRay = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 10);
    expect(selectMediaFromRay(scene, centerRay, [target], 'blocked', toggle, retry, true)).toBe(true);
    expect(retry).toHaveBeenCalledOnce();
    expect(toggle).not.toHaveBeenCalled();
    expect(selectMediaFromRay(scene, centerRay, [target], 'playing', toggle, retry, true)).toBe(false);
    expect(toggle).not.toHaveBeenCalled();
    scene.dispose(); engine.dispose();
  });
});
