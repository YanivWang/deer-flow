/*
  【文件职责】     计算 confetti 是否启用及其发射参数。
  【对应 frontend/】 src/components/ui/confetti-button.tsx
  【架构位置】     L3 product UI helper
  【主要导出】     shouldEmitConfetti · confettiOrigin
  【依赖关系】     无
  【边界与注意】   仅服务 M7 产品特效，不进入 M8 L2 公共集合。
*/

export function shouldEmitConfetti() {
  return !(
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

export function emitConfettiFrom(
  target: HTMLElement,
  { particleCount = 36, angle = 90, spread = 70, startVelocity = 35 } = {},
) {
  if (!shouldEmitConfetti()) return;
  const rect = target.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.dataset.confettiLayer = "";
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "9999",
    overflow: "hidden",
  });
  document.body.append(layer);
  const colors = ["#ff0080", "#7928ca", "#0070f3", "#38bdf8", "#e3a812"];
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement("span");
    const offset = (index / Math.max(1, particleCount - 1) - 0.5) * spread;
    const radians = ((angle - 90 + offset) * Math.PI) / 180;
    const velocity = startVelocity * (0.65 + ((index * 17) % 35) / 100);
    Object.assign(particle.style, {
      position: "absolute",
      left: `${originX}px`,
      top: `${originY}px`,
      width: "6px",
      height: "10px",
      borderRadius: "2px",
      background: colors[index % colors.length],
    });
    layer.append(particle);
    particle.animate(
      [
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(radians) * velocity * 8}px), calc(-50% + ${Math.sin(radians) * velocity * 8 + 180}px)) rotate(${360 + index * 19}deg)`,
          opacity: 0,
        },
      ],
      { duration: 900, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" },
    );
  }
  globalThis.setTimeout(() => layer.remove(), 950);
}
