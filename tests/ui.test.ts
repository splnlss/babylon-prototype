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
    overlay.clearError();
    expect(document.querySelector<HTMLButtonElement>('[data-action="retry"]')?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('[role="alert"]')?.hidden).toBe(true);
  });

  it('keeps VR unavailable in an unsupported browser', () => {
    const overlay = createOverlay(document.querySelector('#overlay') as HTMLElement);
    overlay.setVrAvailable(false, 'Immersive VR is unavailable in this browser');
    const vr = document.querySelector<HTMLButtonElement>('[data-action="vr"]');
    expect(vr?.disabled).toBe(true);
    expect(vr?.title).toContain('unavailable');
    expect(vr?.textContent).toBe('Enter VR');
  });

  it('shows only the VR action during a successful scene load', () => {
    const overlay = createOverlay(document.querySelector('#overlay') as HTMLElement);
    const vr = document.querySelector<HTMLButtonElement>('[data-action="vr"]')!;
    expect(vr.classList.contains('vr-button')).toBe(true);
    overlay.setVrAvailable(true);
    overlay.clearError();
    expect(vr.disabled).toBe(false);
    expect(vr.textContent).toBe('Enter VR');
    expect(document.querySelectorAll('button:not([hidden])')).toHaveLength(1);
    expect(document.querySelector('[role="status"]')).toBeNull();
    expect(document.querySelector('.brand,.controls-card,.scene-note,.reticle,.media-box,.poi-warning')).toBeNull();
    expect(document.querySelector<HTMLElement>('[role="alert"]')?.hidden).toBe(true);
    expect(document.querySelector('#overlay')?.textContent).not.toMatch(/Explore the scene|BABYLON WEBXR STUDY|Scene ready/i);
  });

  it('shows an unsupported browser error without offering a network retry', () => {
    const overlay = createOverlay(document.querySelector('#overlay') as HTMLElement);
    overlay.setError('WebGL2 is required for this viewer.', false);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('WebGL2');
    expect(document.querySelector<HTMLButtonElement>('[data-action="retry"]')?.hidden).toBe(true);
  });
});
