export function horizontalDelta(forward: number, strafe: number, yaw: number, seconds: number, speed: number) {
  const length = Math.hypot(forward, strafe);
  if (!length) return { x: 0, z: 0 };
  const distance = Math.min(Math.max(seconds, 0), 0.1) * speed / Math.max(1, length);
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: (forward * sin + strafe * cos) * distance,
    z: (forward * cos - strafe * sin) * distance,
  };
}
