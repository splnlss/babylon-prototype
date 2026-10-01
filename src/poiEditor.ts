import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { parsePoiManifest, type PoiManifestV1, type PoiDefinition } from './pois.js';

export function createPoiDraft(manifest: PoiManifestV1): PoiManifestV1 { return structuredClone(manifest); }

export function setPoiFromWorld(draft: PoiManifestV1, poiId: string, bodyWorld: Vector3, hostMatrix: Matrix): void {
  const poi = draft.pois.find(item => item.id === poiId);
  if (!poi) throw new Error(`Unknown POI: ${poiId}`);
  const source = Vector3.TransformCoordinates(bodyWorld, hostMatrix.clone().invert());
  poi.position = [source.x, source.y, source.z];
}

export function placeVideoAhead(draft: PoiManifestV1, headWorld: Vector3, forwardWorld: Vector3, hostMatrix: Matrix): void {
  const video = draft.pois.find(poi => poi.kind === 'video');
  if (!video) throw new Error('Video POI missing');
  const horizontal = new Vector3(forwardWorld.x, 0, forwardWorld.z);
  if (horizontal.lengthSquared() < 0.01) throw new Error('Look toward a horizontal direction first');
  horizontal.normalize();
  const inverse = hostMatrix.clone().invert();
  const sourcePosition = Vector3.TransformCoordinates(headWorld.add(horizontal.scale(1.8)), inverse);
  const sourceForward = Vector3.TransformNormal(horizontal, inverse).normalize();
  video.video.position = [sourcePosition.x, sourcePosition.y, sourcePosition.z];
  video.video.rotationDeg = [0, Math.atan2(sourceForward.x, sourceForward.z) * 180 / Math.PI, 0];
}

export function exportPoiJson(draft: PoiManifestV1): string {
  const valid = parsePoiManifest(draft, draft.assetUrl);
  return `${JSON.stringify(valid, null, 2)}\n`;
}

type EditorOptions = {
  hostMatrix(): Matrix;
  bodyWorld(): Vector3;
  headPose(): { position: Vector3; forward: Vector3 };
  onChange(): void;
};

export function createPlacementEditor(container: HTMLElement, draft: PoiManifestV1, options: EditorOptions): () => void {
  const panel = document.createElement('section');
  panel.className = 'poi-editor';
  panel.setAttribute('aria-label', 'POI placement editor');
  panel.innerHTML = `<h2>POI placement</h2><p>Draft only · scene units · WASD to walk · Q/E to turn</p><label>Selected POI <select data-poi></select></label><div data-fields></div><div class="editor-actions"><button type="button" data-action="current">Use current location</button><button type="button" data-action="ahead">Place video ahead</button><button type="button" data-action="export">Download JSON</button></div><p data-editor-message role="status"></p>`;
  container.appendChild(panel);
  const selector = panel.querySelector<HTMLSelectElement>('[data-poi]')!;
  const fields = panel.querySelector<HTMLElement>('[data-fields]')!;
  const message = panel.querySelector<HTMLElement>('[data-editor-message]')!;
  for (const poi of draft.pois) {
    const option = document.createElement('option'); option.value = poi.id; option.textContent = `${poi.title} (${poi.kind})`; selector.appendChild(option);
  }
  if (!draft.pois.length) {
    selector.disabled = true;
    fields.textContent = 'No POIs are saved for this asset.';
    panel.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
    return () => panel.remove();
  }
  const selected = (): PoiDefinition => draft.pois.find(poi => poi.id === selector.value)!;
  const numberField = (label: string, path: string, value: number) => `<label>${label}<input type="number" step="0.01" data-field="${path}" value="${value}"></label>`;
  const triplet = (label: string, path: string, values: number[]) => values.map((value, axis) => numberField(`${label} ${'XYZ'[axis]}`, `${path}.${axis}`, value)).join('');
  const render = () => {
    const poi = selected();
    fields.innerHTML = `<h3>${poi.kind === 'video' ? 'Video' : 'Audio'} marker</h3>${triplet('Position', 'position', poi.position)}${poi.kind === 'video' ? `<h3>Video plane</h3>${triplet('Plane position', 'video.position', poi.video.position)}${triplet('Rotation °', 'video.rotationDeg', poi.video.rotationDeg)}${numberField('Width', 'video.width', poi.video.width)}${numberField('Height', 'video.height', poi.video.height)}` : ''}`;
  };
  selector.addEventListener('change', render);
  fields.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    if (!input.dataset.field) return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    const poi = selected();
    const parts = input.dataset.field.split('.');
    if (parts[0] === 'position') poi.position[Number(parts[1])] = value;
    else if (poi.kind === 'video') {
      if (parts[1] === 'width' || parts[1] === 'height') poi.video[parts[1]] = value;
      else if (parts[1] === 'position' || parts[1] === 'rotationDeg') poi.video[parts[1]][Number(parts[2])] = value;
    }
    options.onChange();
  });
  panel.querySelector<HTMLButtonElement>('[data-action="current"]')!.onclick = () => {
    setPoiFromWorld(draft, selector.value, options.bodyWorld(), options.hostMatrix()); render(); options.onChange(); message.textContent = 'Marker moved to your standing location.';
  };
  panel.querySelector<HTMLButtonElement>('[data-action="ahead"]')!.onclick = () => {
    try { const pose = options.headPose(); placeVideoAhead(draft, pose.position, pose.forward, options.hostMatrix()); render(); options.onChange(); message.textContent = 'Video plane placed ahead.'; }
    catch (error) { message.textContent = error instanceof Error ? error.message : String(error); }
  };
  panel.querySelector<HTMLButtonElement>('[data-action="export"]')!.onclick = () => {
    try {
      const blob = new Blob([exportPoiJson(draft)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ronda-pois.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message.textContent = 'Downloaded ronda-pois.json';
    } catch (error) { message.textContent = error instanceof Error ? error.message : String(error); }
  };
  render();
  return () => panel.remove();
}
