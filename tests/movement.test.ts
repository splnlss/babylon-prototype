import { describe, expect, it } from 'vitest';
import { horizontalDelta } from '../src/movement.js';

describe('horizontalDelta', () => {
  it('walks toward negative Z from Babylon’s start heading of pi', () => {
    const delta = horizontalDelta(1, 0, Math.PI, 1, 3);
    expect(delta.x).toBeCloseTo(0);
    expect(delta.z).toBeCloseTo(-0.3);
  });

  it('normalizes diagonal input to one walking speed', () => {
    const { x, z } = horizontalDelta(1, 1, Math.PI, 0.05, 3);
    expect(Math.hypot(x, z)).toBeCloseTo(0.15);
  });

  it('rotates forward movement with yaw', () => {
    const { x, z } = horizontalDelta(1, 0, Math.PI / 2, 0.05, 3);
    expect(x).toBeCloseTo(0.15);
    expect(z).toBeCloseTo(0);
  });

  it('caps a stalled frame to a tenth of a second', () => {
    expect(horizontalDelta(1, 0, Math.PI, 5, 3).z).toBeCloseTo(-0.3);
  });

  it('moves right relative to the reversed start heading', () => {
    expect(horizontalDelta(0, 1, Math.PI, 0.1, 3).x).toBeCloseTo(-0.3);
  });
});
