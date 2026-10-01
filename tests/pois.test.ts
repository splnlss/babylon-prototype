import { describe, expect, it } from 'vitest';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { MANIFEST_URL, POI_FLOOR_Y, START, TARGET } from '../src/config.js';
import manifestJson from '../src/pois/ronda.json';
import { parsePoiManifest, loadPoiManifest, resolvePois, tryResolvePois, xrStandingBody, PoiTracker } from '../src/pois.js';

const videoId = '00UWevxtFkfuKdqmXsJmdXqXXqWTcxSBjEuIrpejlYk00';
const audioId = 'BvRHSlj5WGXeIG2HCr5t9w02ZMUXmzLkKNYofkE02JgH00';
const fallback = 'https://pub-dd92ae5131ec49f1bbd411b51a858249.r2.dev/20221110_rondajoseph-storyoutline_v1-AudioOnly.m4a';

function fixture() {
  return {
    version: 1,
    assetUrl: MANIFEST_URL,
    pois: [
      { id: 'video', title: 'Video', kind: 'video', position: [0, -3.4, 37], standingRadius: 0.8, exitRadius: 1.1, muxPlaybackId: videoId,
        video: { position: [0, -5.05, 35.2], rotationDeg: [0, 180, 0], width: 1.6, height: 0.9 } },
      { id: 'audio', title: 'Audio', kind: 'audio', position: [2, -3.4, 32], standingRadius: 0.8, exitRadius: 1.1, muxPlaybackId: audioId, fallbackUrl: fallback },
    ],
  };
}

describe('POI manifest and mapping', () => {
  it('starts facing 45 degrees left of the original pole-facing heading', () => {
    const previousHeading = new Vector3(-3.5, 0, -6).normalize();
    const heading = new Vector3(TARGET.x - START.x, 0, TARGET.z - START.z).normalize();
    expect(TARGET.y).toBe(START.y);
    expect(Vector3.Dot(previousHeading, heading)).toBeCloseTo(Math.SQRT1_2, 4);
    // Babylon's default left-handed camera turns screen-left for negative Y yaw.
    expect(Vector3.Cross(previousHeading, heading).y).toBeCloseTo(-Math.SQRT1_2, 4);
  });

  it('uses the supplied Bob video playback ID in the shipped Ronda POI', () => {
    const manifest = parsePoiManifest(manifestJson, MANIFEST_URL);
    const video = manifest.pois.find(poi => poi.kind === 'video');
    expect(video?.muxPlaybackId).toBe('00UWevxtFkfuKdqmXsJmdXqXXqWTcxSBjEuIrpejlYk00');
  });

  it('starts outside both nearby pole POIs and keeps the video surface by its marker', () => {
    expect([START.x, START.y, START.z]).toEqual([2.5, 3.6, 24]);
    expect(POI_FLOOR_Y).toBe(2);
    expect(START.y - POI_FLOOR_Y).toBeCloseTo(1.6);
    const pois = resolvePois(parsePoiManifest(manifestJson, MANIFEST_URL), Matrix.Scaling(1, -1, 1));
    const start = new Vector3(START.x, POI_FLOOR_Y, START.z);
    for (const poi of pois) {
      const distance = Math.hypot(start.x - poi.worldPosition.x, start.z - poi.worldPosition.z);
      expect(distance).toBeGreaterThan(poi.exitRadius);
      expect(distance).toBeLessThan(9);
    }
    expect(Math.hypot(pois[0].worldPosition.x - pois[1].worldPosition.x, pois[0].worldPosition.z - pois[1].worldPosition.z)).toBeLessThan(2);
    const video = pois.find(poi => poi.kind === 'video')!;
    expect(pois.every(poi => poi.worldPosition.y === POI_FLOOR_Y)).toBe(true);
    expect(Math.hypot(video.worldVideo!.position.x - video.worldPosition.x, video.worldVideo!.position.z - video.worldPosition.z)).toBeLessThan(1.5);
    expect(video.worldVideo!.position.y).toBe(START.y);
    const planeNormal = Vector3.TransformNormal(new Vector3(0, 0, -1), Matrix.Compose(Vector3.One(), video.worldVideo!.rotation, Vector3.Zero()));
    const towardStart = new Vector3(START.x - video.worldVideo!.position.x, 0, START.z - video.worldVideo!.position.z).normalize();
    expect(Vector3.Dot(planeNormal, towardStart)).toBeGreaterThan(0.9);
    const tracker = new PoiTracker(pois, 0.25);
    expect(tracker.update(start, 0)).toEqual([]);
    expect(tracker.update(start, 1000)).toEqual([]);
  });
  it('maps approved source points through the reflected SOG host', () => {
    const host = Matrix.Scaling(1, -1, 1);
    const pois = resolvePois(parsePoiManifest(fixture(), MANIFEST_URL), host);
    expect(pois[0].worldPosition.asArray()).toEqual([0, 3.4, 37]);
    expect(pois[0].worldVideo?.position.asArray()).toEqual([0, 5.05, 35.2]);
    const normal = Vector3.TransformNormal(new Vector3(0, 0, -1), Matrix.Compose(Vector3.One(), pois[0].worldVideo!.rotation, Vector3.Zero()));
    expect(normal.z).toBeCloseTo(1);
    expect(pois[1].worldPosition.asArray()).toEqual([2, 3.4, 32]);
  });

  it('uses the forward matrix for a translated reflective host', () => {
    const host = Matrix.Compose(new Vector3(1, -1, 1), Quaternion.Identity(), new Vector3(10, 5, 0));
    const pois = resolvePois(parsePoiManifest(fixture(), MANIFEST_URL), host);
    expect(pois[1].worldPosition.x).toBeCloseTo(12);
    expect(pois[1].worldPosition.y).toBeCloseTo(8.4);
  });

  it('rejects unknown versions, assets, duplicate IDs, and invalid geometry', () => {
    const version = fixture(); version.version = 2;
    expect(() => parsePoiManifest(version, MANIFEST_URL)).toThrow(/version/i);
    expect(() => parsePoiManifest(fixture(), 'https://other.example/scene.json')).toThrow(/asset/i);
    const duplicate = fixture(); duplicate.pois[1].id = 'video';
    expect(() => parsePoiManifest(duplicate, MANIFEST_URL)).toThrow(/duplicate/i);
    const nonfinite = fixture(); nonfinite.pois[0].position[0] = Infinity;
    expect(() => parsePoiManifest(nonfinite, MANIFEST_URL)).toThrow(/position/i);
    const radius = fixture(); radius.pois[0].exitRadius = 0.8;
    expect(() => parsePoiManifest(radius, MANIFEST_URL)).toThrow(/radius/i);
    const plane = fixture(); plane.pois[0].video!.width = 0;
    expect(() => parsePoiManifest(plane, MANIFEST_URL)).toThrow(/width/i);
  });

  it('requires a valid public media reference for each kind', () => {
    const invalidId = fixture(); invalidId.pois[0].muxPlaybackId = 'https://stream.mux.com/x.m3u8';
    expect(() => parsePoiManifest(invalidId, MANIFEST_URL)).toThrow(/Mux/i);
    const insecure = fixture(); insecure.pois[1].fallbackUrl = 'http://example.test/a.m4a';
    expect(() => parsePoiManifest(insecure, MANIFEST_URL)).toThrow(/HTTPS/i);
    const r2Only = fixture(); delete (r2Only.pois[1] as { muxPlaybackId?: string }).muxPlaybackId;
    expect(parsePoiManifest(r2Only, MANIFEST_URL).pois[1].kind).toBe('audio');
  });

  it('keeps a different or malformed asset free of Ronda POIs while reporting a warning', () => {
    const other = loadPoiManifest(fixture(), 'https://example.test/other.json');
    expect(other.manifest.pois).toEqual([]);
    expect(other.warning).toMatch(/asset/i);
    const bad = loadPoiManifest({ version: 2 }, MANIFEST_URL);
    expect(bad.manifest.pois).toEqual([]);
    expect(bad.warning).toMatch(/version/i);
  });

  it('keeps a transformed asset with unsupported scale from breaking scene loading', () => {
    const result = tryResolvePois(parsePoiManifest(fixture(), MANIFEST_URL), Matrix.Scaling(2, -1, 1));
    expect(result.pois).toEqual([]);
    expect(result.warning).toMatch(/scale/i);
  });
});

describe('PoiTracker', () => {
  it('places a tracked 1.6-unit XR eye on the configured interaction floor', () => {
    expect(xrStandingBody(new Vector3(START.x, START.y, START.z), 1.6).y).toBeCloseTo(POI_FLOOR_Y);
  });

  it('uses the tracked XR head height to find the standing body floor', () => {
    expect(xrStandingBody(new Vector3(0, 5, 37), 1.6).asArray()).toEqual([0, 3.4, 37]);
  });
  function tracker() {
    const host = Matrix.Scaling(1, -1, 1);
    return new PoiTracker(resolvePois(parsePoiManifest(fixture(), MANIFEST_URL), host), 0.25);
  }

  it('requires 250 ms inside 0.8 and exits only across 1.1', () => {
    const t = tracker();
    expect(t.update(new Vector3(0.8, 3.4, 37), 0)).toEqual([]);
    expect(t.update(new Vector3(0.8, 3.4, 37), 249)).toEqual([]);
    expect(t.update(new Vector3(0.8, 3.4, 37), 250)).toEqual([{ type: 'enter', id: 'video' }]);
    expect(t.update(new Vector3(1.09, 3.4, 37), 300)).toEqual([]);
    expect(t.update(new Vector3(1.11, 3.4, 37), 301)).toEqual([{ type: 'exit', id: 'video' }]);
  });

  it('rejects a flyover and resets a partial dwell', () => {
    const t = tracker();
    expect(t.update(new Vector3(0, 4.01, 37), 0)).toEqual([]);
    expect(t.update(new Vector3(0, 3.4, 37), 100)).toEqual([]);
    expect(t.update(new Vector3(0, 3.4, 37), 349)).toEqual([]);
    expect(t.update(new Vector3(0, 3.4, 37), 350)).toEqual([{ type: 'enter', id: 'video' }]);
    expect(t.update(new Vector3(0, 3.4, 37), 400)).toEqual([]);
  });

  it('chooses the nearest overlapping POI and replaces only after margin and dwell', () => {
    const data = fixture();
    data.pois[0].position = [0, 0, 0];
    data.pois[1].position = [0.5, 0, 0];
    data.pois.forEach(p => { p.standingRadius = 1.1; p.exitRadius = 1.4; });
    const t = new PoiTracker(resolvePois(parsePoiManifest(data, MANIFEST_URL), Matrix.Identity()), 0.25);
    expect(t.update(new Vector3(0, 0, 0), 0)).toEqual([]);
    expect(t.update(new Vector3(0, 0, 0), 250)).toEqual([{ type: 'enter', id: 'video' }]);
    expect(t.update(new Vector3(0.5, 0, 0), 300)).toEqual([]);
    expect(t.update(new Vector3(0.5, 0, 0), 549)).toEqual([]);
    expect(t.update(new Vector3(0.5, 0, 0), 550)).toEqual([{ type: 'replace', oldId: 'video', newId: 'audio' }]);
    expect(t.update(new Vector3(0.24, 0, 0), 800)).toEqual([]);
  });

  it('clears active and dwell state on scene reload', () => {
    const t = tracker();
    t.update(new Vector3(0, 3.4, 37), 0);
    t.update(new Vector3(0, 3.4, 37), 250);
    t.reset();
    expect(t.update(new Vector3(0, 3.4, 37), 300)).toEqual([]);
    expect(t.update(new Vector3(0, 3.4, 37), 550)).toEqual([{ type: 'enter', id: 'video' }]);
  });
});
