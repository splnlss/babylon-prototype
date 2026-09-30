// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import manifestJson from '../src/pois/ronda.json';
import { MANIFEST_URL } from '../src/config.js';
import { parsePoiManifest } from '../src/pois.js';
import { createPoiDraft, createPlacementEditor } from '../src/poiEditor.js';

describe('placement panel', () => {
  it('edits one draft in memory, updates preview, and captures a moved standing location', () => {
    const draft = createPoiDraft(parsePoiManifest(manifestJson, MANIFEST_URL));
    const root = document.createElement('div'); document.body.appendChild(root);
    const onChange = vi.fn();
    const destroy = createPlacementEditor(root, draft, {
      hostMatrix: () => Matrix.Scaling(1, -1, 1),
      bodyWorld: () => new Vector3(3, 3.4, 30),
      headPose: () => ({ position: new Vector3(3, 5, 30), forward: new Vector3(0, 0, -1) }),
      onChange,
    });
    const field = root.querySelector<HTMLInputElement>('[data-field="position.0"]')!;
    field.value = '1.25'; field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(draft.pois[0].position[0]).toBe(1.25);
    root.querySelector<HTMLSelectElement>('[data-poi]')!.value = 'audio';
    root.querySelector<HTMLButtonElement>('[data-action="current"]')!.click();
    expect(draft.pois[1].position).toEqual([3, -3.4, 30]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(root.querySelector('audio, video')).toBeNull();
    destroy(); expect(root.querySelector('.poi-editor')).toBeNull(); root.remove();
  });
});
