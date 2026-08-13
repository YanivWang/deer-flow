export function createInitialOpacities(count: number, maxOpacity: number) {
  const values = new Float32Array(Math.max(0, count));
  for (let index = 0; index < values.length; index += 1) {
    // Stable initial paint keeps screenshots deterministic. Runtime flicker
    // may randomize a cell only after this frame has been drawn.
    const hash = Math.imul(index + 1, 2654435761) >>> 0;
    values[index] = (hash / 0xffffffff) * maxOpacity;
  }
  return values;
}

export function prefersReducedMotion() {
  return (
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}
