import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import AuroraText from "@/components/ui/effects/AuroraText.vue";
import ShineBorder from "@/components/ui/effects/ShineBorder.vue";
import {
  emitConfettiFrom,
  shouldEmitConfetti,
} from "@/components/ui/effects/confetti";
import { createInitialOpacities } from "@/components/ui/effects/flickering-grid";

afterEach(() => {
  vi.useRealTimers();
  document
    .querySelectorAll("[data-confetti-layer]")
    .forEach((node) => node.remove());
  vi.unstubAllGlobals();
});

describe("M7 named effects", () => {
  it("renders Aurora text once for assistive technology and once as decoration", () => {
    const wrapper = mount(AuroraText, {
      props: { colors: ["red", "blue"], speed: 2 },
      slots: { default: "Welcome" },
    });

    expect(wrapper.get(".sr-only").text()).toBe("Welcome");
    const visual = wrapper.get('[aria-hidden="true"]');
    expect(visual.text()).toBe("Welcome");
    expect(visual.attributes("style")).toContain("linear-gradient");
    expect(visual.attributes("style")).toContain("5s");
  });

  it("renders the shine border as non-interactive decoration", () => {
    const wrapper = mount(ShineBorder, {
      props: {
        borderWidth: 1.5,
        duration: 8,
        shineColor: ["#a07cfe", "#fe8fb5", "#ffbe7b"],
      },
    });

    expect(wrapper.attributes("aria-hidden")).toBe("true");
    expect(wrapper.attributes("style")).toContain("--border-width: 1.5px");
    expect(wrapper.attributes("style")).toContain("--duration: 8s");
  });

  it("uses a deterministic initial grid and bounds every opacity", () => {
    const first = [...createInitialOpacities(8, 0.3)];
    const second = [...createInitialOpacities(8, 0.3)];

    expect(first).toEqual(second);
    expect(first.every((value) => value >= 0 && value <= 0.3)).toBe(true);
  });

  it("suppresses confetti for reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const target = document.createElement("button");
    document.body.append(target);

    expect(shouldEmitConfetti()).toBe(false);
    emitConfettiFrom(target);
    expect(document.querySelector("[data-confetti-layer]")).toBeNull();
    target.remove();
  });

  it("emits a bounded particle layer and removes it after the animation", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    const target = document.createElement("button");
    document.body.append(target);

    emitConfettiFrom(target, { particleCount: 5 });
    const layer = document.querySelector("[data-confetti-layer]");
    expect(layer?.children).toHaveLength(5);
    expect(animate).toHaveBeenCalledTimes(5);

    vi.advanceTimersByTime(950);
    expect(document.querySelector("[data-confetti-layer]")).toBeNull();
    target.remove();
  });
});
