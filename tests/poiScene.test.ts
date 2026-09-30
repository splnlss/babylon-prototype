import { describe, expect, it } from 'vitest';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import manifestJson from '../src/pois/ronda.json';
import { MANIFEST_URL } from '../src/config.js';
import { parsePoiManifest, resolvePois } from '../src/pois.js';
import { PoiScene, statusPosition } from '../src/poiScene.js';

describe('POI scene ownership', () => {
  it('positions compact status away from the eye and below the video plane', () => {
    const pos = statusPosition(new Vector3(0, 5, 37), new Vector3(0, 0, -1));
    expect(pos.asArray()).toEqual([1, 4.35, 35.2]);
    expect(Vector3.Distance(pos, new Vector3(0, 5, 37))).toBeGreaterThan(2);
    expect(pos.y + 0.1).toBeLessThan(5.05 - 0.45);
  });
  it('swaps a single draft marker set with live markers and leaves the placeholder unpickable', () => {
    const engine = new NullEngine(); const scene = new Scene(engine);
    const view = new PoiScene(scene);
    const pois = resolvePois(parsePoiManifest(manifestJson, MANIFEST_URL), Matrix.Scaling(1, -1, 1));
    view.setPois(pois, true);
    expect(scene.meshes.filter(mesh => mesh.name.startsWith('poi-'))).toHaveLength(3);
    expect(view.selectableMeshes).toEqual([]);
    expect(scene.meshes.find(mesh => mesh.name === 'poi-video-video')?.isPickable).toBe(false);
    view.setPois(pois, false);
    expect(scene.meshes.filter(mesh => mesh.name.startsWith('poi-'))).toHaveLength(2);
    view.dispose();
    expect(scene.meshes.filter(mesh => mesh.name.startsWith('poi-'))).toHaveLength(0);
    scene.dispose(); engine.dispose();
  });
});
