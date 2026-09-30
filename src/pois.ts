import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

export type Vec3Tuple = [number, number, number];
type Base = { id: string; title: string; position: Vec3Tuple; standingRadius: number; exitRadius: number };
export type VideoPoi = Base & { kind: 'video'; muxPlaybackId: string; video: { position: Vec3Tuple; rotationDeg: Vec3Tuple; width: number; height: number } };
export type AudioPoi = Base & { kind: 'audio'; muxPlaybackId?: string; fallbackUrl?: string };
export type PoiDefinition = VideoPoi | AudioPoi;
export type PoiManifestV1 = { version: 1; assetUrl: string; pois: PoiDefinition[] };
export type Poi = PoiDefinition & { worldPosition: Vector3; worldVideo?: { position: Vector3; rotation: Quaternion; width: number; height: number } };
export type PoiEvent = { type: 'enter' | 'exit'; id: string } | { type: 'replace'; oldId: string; newId: string };

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function tuple(value: unknown, name: string): Vec3Tuple {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(finite)) throw new Error(`${name} must be three finite numbers`);
  return [value[0], value[1], value[2]];
}
function muxId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9]{20,64}$/.test(value)) throw new Error('Invalid public Mux playback ID');
  return value;
}
function httpsM4a(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Audio fallback must be an HTTPS M4A URL');
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.pathname.toLowerCase().endsWith('.m4a')) return value;
  } catch { /* use the same validation message */ }
  throw new Error('Audio fallback must be an HTTPS M4A URL');
}

export function parsePoiManifest(input: unknown, activeAssetUrl: string): PoiManifestV1 {
  if (!isRecord(input)) throw new Error('POI manifest must be an object');
  if (input.version !== 1) throw new Error('Unsupported POI manifest version');
  if (input.assetUrl !== activeAssetUrl) throw new Error('POI manifest asset URL does not match this scene');
  if (!Array.isArray(input.pois)) throw new Error('POI manifest pois must be an array');
  const ids = new Set<string>();
  const pois: PoiDefinition[] = input.pois.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`POI ${index} must be an object`);
    if (typeof raw.id !== 'string' || !raw.id.trim()) throw new Error(`POI ${index} needs an ID`);
    if (ids.has(raw.id)) throw new Error(`Duplicate POI ID: ${raw.id}`);
    ids.add(raw.id);
    if (typeof raw.title !== 'string' || !raw.title.trim()) throw new Error(`POI ${raw.id} needs a title`);
    const position = tuple(raw.position, `POI ${raw.id} position`);
    if (!finite(raw.standingRadius) || raw.standingRadius <= 0 || !finite(raw.exitRadius) || raw.exitRadius <= raw.standingRadius) throw new Error(`POI ${raw.id} radius values must be positive and ordered`);
    const base = { id: raw.id, title: raw.title, position, standingRadius: raw.standingRadius, exitRadius: raw.exitRadius };
    if (raw.kind === 'video') {
      const playbackId = muxId(raw.muxPlaybackId);
      if (!isRecord(raw.video)) throw new Error(`POI ${raw.id} needs a video plane`);
      const plane = raw.video;
      const planePosition = tuple(plane.position, `POI ${raw.id} video position`);
      const rotationDeg = tuple(plane.rotationDeg, `POI ${raw.id} video rotation`);
      if (!finite(plane.width) || plane.width < 0.2 || plane.width > 4) throw new Error(`POI ${raw.id} video width must be 0.2–4`);
      if (!finite(plane.height) || plane.height < 0.2 || plane.height > 4) throw new Error(`POI ${raw.id} video height must be 0.2–4`);
      return { ...base, kind: 'video', muxPlaybackId: playbackId, video: { position: planePosition, rotationDeg, width: plane.width, height: plane.height } };
    }
    if (raw.kind === 'audio') {
      const playbackId = raw.muxPlaybackId === undefined ? undefined : muxId(raw.muxPlaybackId);
      const fallbackUrl = raw.fallbackUrl === undefined ? undefined : httpsM4a(raw.fallbackUrl);
      if (!playbackId && !fallbackUrl) throw new Error(`POI ${raw.id} audio needs a source`);
      return { ...base, kind: 'audio', ...(playbackId ? { muxPlaybackId: playbackId } : {}), ...(fallbackUrl ? { fallbackUrl } : {}) };
    }
    throw new Error(`POI ${raw.id} kind must be audio or video`);
  });
  return { version: 1, assetUrl: activeAssetUrl, pois };
}

export function loadPoiManifest(input: unknown, activeAssetUrl: string): { manifest: PoiManifestV1; warning: string | null } {
  try { return { manifest: parsePoiManifest(input, activeAssetUrl), warning: null }; }
  catch (error) {
    return { manifest: { version: 1, assetUrl: activeAssetUrl, pois: [] }, warning: `POIs unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

type Mat3 = [number[], number[], number[]];
function mul3(a: Mat3, b: Mat3): Mat3 {
  return [0, 1, 2].map(i => [0, 1, 2].map(j => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j])) as Mat3;
}
function linear3(matrix: Matrix): Mat3 {
  const m = matrix.m;
  return [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
}
function rotationXYZ(degrees: Vec3Tuple): Mat3 {
  const [x, y, z] = degrees.map(value => value * Math.PI / 180);
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)];
  const rx: Mat3 = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
  const ry: Mat3 = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const rz: Mat3 = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  return mul3(mul3(rz, ry), rx);
}
function worldRotation(degrees: Vec3Tuple, host: Matrix): Quaternion {
  const r = mul3(mul3(linear3(host), rotationXYZ(degrees)), linear3(host.clone().invert()));
  const matrix = Matrix.FromValues(r[0][0], r[1][0], r[2][0], 0, r[0][1], r[1][1], r[2][1], 0, r[0][2], r[1][2], r[2][2], 0, 0, 0, 0, 1);
  return Quaternion.FromRotationMatrix(matrix);
}

export function resolvePois(manifest: PoiManifestV1, hostMatrix: Matrix): Poi[] {
  const h = linear3(hostMatrix);
  for (const j of [0, 1, 2]) if (Math.abs(Math.hypot(h[0][j], h[1][j], h[2][j]) - 1) > 0.0001) throw new Error('POI host scale must have unit axis magnitudes');
  return manifest.pois.map(definition => {
    const worldPosition = Vector3.TransformCoordinates(Vector3.FromArray(definition.position), hostMatrix);
    if (definition.kind === 'video') {
      const worldVideo = { position: Vector3.TransformCoordinates(Vector3.FromArray(definition.video.position), hostMatrix), rotation: worldRotation(definition.video.rotationDeg, hostMatrix), width: definition.video.width, height: definition.video.height };
      return { ...definition, worldPosition, worldVideo };
    }
    return { ...definition, worldPosition };
  });
}

export function tryResolvePois(manifest: PoiManifestV1, hostMatrix: Matrix): { pois: Poi[]; warning: string | null } {
  try { return { pois: resolvePois(manifest, hostMatrix), warning: null }; }
  catch (error) { return { pois: [], warning: `POIs unavailable: ${error instanceof Error ? error.message : String(error)}` }; }
}

/** WebXRCamera.position is the tracked head; POI height compares the standing floor. */
export function xrStandingBody(headWorld: Vector3, realWorldHeight: number): Vector3 {
  if (!Number.isFinite(realWorldHeight) || realWorldHeight < 0) throw new Error('Invalid XR user height');
  return new Vector3(headWorld.x, headWorld.y - realWorldHeight, headWorld.z);
}

export class PoiTracker {
  private activeId: string | null = null;
  private candidateId: string | null = null;
  private candidateSince = 0;
  constructor(private readonly pois: Poi[], private readonly replacementMargin: number) {}

  update(bodyWorld: Vector3, nowMs: number): PoiEvent[] {
    const distance = (poi: Poi) => Math.hypot(bodyWorld.x - poi.worldPosition.x, bodyWorld.z - poi.worldPosition.z);
    const sameLevel = (poi: Poi) => Math.abs(bodyWorld.y - poi.worldPosition.y) <= 0.6;
    const eligible = this.pois.filter(poi => sameLevel(poi) && distance(poi) <= poi.standingRadius).sort((a, b) => distance(a) - distance(b));
    const events: PoiEvent[] = [];
    const active = this.pois.find(poi => poi.id === this.activeId);
    if (active && (!sameLevel(active) || distance(active) >= active.exitRadius)) {
      events.push({ type: 'exit', id: active.id });
      this.activeId = null;
      this.candidateId = null;
    }
    const current = this.pois.find(poi => poi.id === this.activeId);
    const nearest = current ? eligible.find(poi => poi.id !== current.id && distance(poi) + this.replacementMargin < distance(current)) : eligible[0];
    if (!nearest) { this.candidateId = null; return events; }
    if (nearest.id !== this.candidateId) { this.candidateId = nearest.id; this.candidateSince = nowMs; return events; }
    if (nowMs - this.candidateSince < 250) return events;
    this.candidateId = null;
    if (current) { this.activeId = nearest.id; events.push({ type: 'replace', oldId: current.id, newId: nearest.id }); }
    else { this.activeId = nearest.id; events.push({ type: 'enter', id: nearest.id }); }
    return events;
  }
  reset(): void { this.activeId = null; this.candidateId = null; this.candidateSince = 0; }
}
