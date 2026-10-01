// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createOverlay } from '../src/ui';

beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"></div>';
});

describe('overlay', () => {
  it('shows a recoverable network error and invokes Retry', () => {
    const overlay = createOverlay(document.querySelector('#overlay') as HTMLElement);
    let retries = 0;
    overlay.onRetry(() => { retries += 1; });

    overlay.setError('Manifest https://assets.example.test/lod-meta.json: HTTP 403');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('HTTP 403');
    const retry = document.querySelector<HTMLButtonElement>('[data-action="retry"]');
    expect(retry?.hidden).toBe(false);
    retry?.click();
    expect(retries).toBe(1);
  });

  it('clears the error when loading resumes', () => {
    const overlay = createOverlay(document.querySelector('#overlay') as HTMLElement);
    overlay.setError('A chunk failed');
    overlay.setStatus('Streaming scene…');
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Streaming scene');
    expect(document.querySelector<HTMLButtonElement>('[data-action="retry"]')?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('[role="alert"]')?.hidden).toBe(true);
  });

  it('keeps VR unavailable while leaving Reset accessible', () => {
    const overlay = createOverlay(document.querySelector('#overlay') as HTMLElement);
    let resets = 0;
    overlay.onReset(() => { resets += 1; });
    overlay.setVrAvailable(false, 'Immersive VR is unavailable in this browser');
    const vr = document.querySelector<HTMLButtonElement>('[data-action="vr"]');
    expect(vr?.disabled).toBe(true);
    expect(vr?.title).toContain('unavailable');
    expect(vr?.textContent).toContain('VR unavailable');
    document.querySelector<HTMLButtonElement>('[data-action="reset"]')?.click();
    expect(resets).toBe(1);
  });

  it('places the VR action in the top overlay with a dedicated pill style', () => {
    const overlay = createOverlay(document.querySelector('#overlay') as HTMLElement);
    const vr = document.querySelector<HTMLButtonElement>('[data-action="vr"]')!;
    expect(vr.closest('.hud-top')).toBeTruthy();
    expect(vr.classList.contains('vr-button')).toBe(true);
    overlay.setVrAvailable(true);
    expect(vr.disabled).toBe(false);
    expect(vr.textContent).toBe('Enter VR');
  });

  it('shows an unsupported browser error without offering a network retry', () => {
    const overlay = createOverlay(document.querySelector('#overlay') as HTMLElement);
    overlay.setError('WebGL2 is required for this viewer.', false);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('WebGL2');
    expect(document.querySelector<HTMLButtonElement>('[data-action="retry"]')?.hidden).toBe(true);
  });
});
