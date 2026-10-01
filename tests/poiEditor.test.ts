import { describe, expect, it } from 'vitest';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import manifestJson from '../src/pois/ronda.json';
import { MANIFEST_URL } from '../src/config.js';
import { parsePoiManifest } from '../src/pois.js';
import { createPoiDraft, setPoiFromWorld, placeVideoAhead, exportPoiJson } from '../src/poiEditor.js';

describe('placement draft and export', () => {
  it('copies the manifest and maps a standing location back through the reflective host', () => {
    const source = parsePoiManifest(manifestJson, MANIFEST_URL);
    const originalAudioPosition = [...source.pois[1].position];
    const draft = createPoiDraft(source);
    setPoiFromWorld(draft, 'audio', new Vector3(3, 3.4, 30), Matrix.Scaling(1, -1, 1));
    expect(draft.pois[1].position).toEqual([3, -3.4, 30]);
    expect(source.pois[1].position).toEqual(originalAudioPosition);
  });

  it('places the plane 1.8 units ahead and facing the visitor, then exports loadable JSON', () => {
    const draft = createPoiDraft(parsePoiManifest(manifestJson, MANIFEST_URL));
    placeVideoAhead(draft, new Vector3(0, 5, 37), new Vector3(0, 0, -1), Matrix.Scaling(1, -1, 1));
    const video = draft.pois.find(poi => poi.kind === 'video');
    expect(video?.video.position[0]).toBeCloseTo(0);
    expect(video?.video.position[1]).toBeCloseTo(-5);
    expect(video?.video.position[2]).toBeCloseTo(35.2);
    expect(video?.video.rotationDeg[1]).toBeCloseTo(180);
    const output = exportPoiJson(draft);
    expect(parsePoiManifest(JSON.parse(output), MANIFEST_URL).pois).toHaveLength(2);
  });

  it('refuses an almost vertical look when placing the plane', () => {
    const draft = createPoiDraft(parsePoiManifest(manifestJson, MANIFEST_URL));
    expect(() => placeVideoAhead(draft, new Vector3(0, 5, 37), new Vector3(0.001, 1, 0), Matrix.Scaling(1, -1, 1))).toThrow(/horizontal/i);
  });
});
