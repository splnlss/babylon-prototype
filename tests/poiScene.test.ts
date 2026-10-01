import { describe, expect, it, vi } from 'vitest';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import manifestJson from '../src/pois/ronda.json';
import { MANIFEST_URL, START } from '../src/config.js';
import { parsePoiManifest, resolvePois } from '../src/pois.js';
import { PoiScene, statusPosition } from '../src/poiScene.js';

function testScene(): { engine: NullEngine; scene: Scene } {
  const engine = new NullEngine();
  // NullEngine has no browser canvas; marker text drawing is covered in the browser check.
  vi.spyOn(engine, 'createCanvas').mockImplementation(() => ({
    width: 1, height: 1,
    getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, measureText: () => ({ width: 120 }) }),
  }) as unknown as ReturnType<NullEngine['createCanvas']>);
  return { engine, scene: new Scene(engine) };
}

describe('POI scene ownership', () => {
  it('positions compact status away from the eye and below the video plane', () => {
    const head = new Vector3(START.x, START.y, START.z);
    const pos = statusPosition(head, new Vector3(-3.5, 0, -6));
    const video = resolvePois(parsePoiManifest(manifestJson, MANIFEST_URL), Matrix.Scaling(1, -1, 1)).find(poi => poi.kind === 'video')!;
    expect(Vector3.Distance(pos, head)).toBeGreaterThan(2);
    expect(pos.y + 0.1).toBeLessThan(video.worldVideo!.position.y - video.worldVideo!.height / 2);
  });
  it('swaps a single draft marker set with live markers and leaves the placeholder unpickable', () => {
    const { engine, scene } = testScene();
    const view = new PoiScene(scene);
    const pois = resolvePois(parsePoiManifest(manifestJson, MANIFEST_URL), Matrix.Scaling(1, -1, 1));
    view.setPois(pois, true);
    expect(scene.meshes.filter(mesh => mesh.name.startsWith('poi-'))).toHaveLength(5);
    expect(view.selectableMeshes).toEqual([]);
    expect(scene.meshes.find(mesh => mesh.name === 'poi-video-video')?.isPickable).toBe(false);
    expect(scene.meshes.find(mesh => mesh.name === 'poi-video-video')?.renderingGroupId).toBe(1);
    view.setPois(pois, false);
    expect(scene.meshes.filter(mesh => mesh.name.startsWith('poi-'))).toHaveLength(4);
    view.dispose();
    expect(scene.meshes.filter(mesh => mesh.name.startsWith('poi-'))).toHaveLength(0);
    scene.dispose(); engine.dispose();
  });

  it('keeps an unpickable media label above each marker in live and editor views', () => {
    const { engine, scene } = testScene();
    const view = new PoiScene(scene);
    const pois = resolvePois(parsePoiManifest(manifestJson, MANIFEST_URL), Matrix.Scaling(1, -1, 1));
    for (const draft of [false, true]) {
      view.setPois(pois, draft);
      for (const kind of ['video', 'audio']) {
        const marker = scene.getMeshByName(`poi-${kind}`);
        const label = scene.getMeshByName(`poi-${kind}-label`);
        expect(marker).toBeTruthy();
        expect(label).toBeTruthy();
        expect(marker!.material).toBeInstanceOf(StandardMaterial);
        expect((marker!.material as StandardMaterial).disableLighting).toBe(true);
        expect(marker!.renderingGroupId).toBe(1);
        expect(label!.position.y).toBeGreaterThan(marker!.position.y + 0.2);
        expect(label!.billboardMode).toBe(Mesh.BILLBOARDMODE_ALL);
        expect(label!.renderingGroupId).toBe(1);
        expect(label!.isPickable).toBe(false);
      }
      expect(view.selectableMeshes).toEqual([]);
    }
    view.dispose();
    expect(scene.meshes.filter(mesh => mesh.name.startsWith('poi-'))).toHaveLength(0);
    scene.dispose(); engine.dispose();
  });
});
