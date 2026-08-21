/*
  【文件职责】     固定 object-contain letterbox 坐标与 wheel delta 归一化合同。
  【对应 frontend/】 frontend/src/components/workspace/browser-view/browser-view-panel.tsx
  【架构位置】     测试
  【主要导出】     browser geometry 回归用例
  【依赖关系】     app/core/browser/geometry.ts
  【边界与注意】   纯数学测试，不证明浏览器 DOM 事件接线。
*/

import { describe, expect, it } from "vitest";

import {
  mapBrowserPoint,
  normalizeBrowserWheel,
} from "@/core/browser/geometry";

const rect = (width: number, height: number, left = 10, top = 20) => ({
  left,
  top,
  width,
  height,
});

describe("mapBrowserPoint", () => {
  it("maps a matching 16:9 viewport and includes content boundaries", () => {
    expect(
      mapBrowserPoint({
        clientX: 650,
        clientY: 380,
        rect: rect(1280, 720),
        naturalWidth: 1280,
        naturalHeight: 720,
      }),
    ).toEqual({ nx: 0.5, ny: 0.5 });
    expect(
      mapBrowserPoint({
        clientX: 10,
        clientY: 20,
        rect: rect(1280, 720),
        naturalWidth: 1280,
        naturalHeight: 720,
      }),
    ).toEqual({ nx: 0, ny: 0 });
    expect(
      mapBrowserPoint({
        clientX: 1290,
        clientY: 740,
        rect: rect(1280, 720),
        naturalWidth: 1280,
        naturalHeight: 720,
      }),
    ).toEqual({ nx: 1, ny: 1 });
  });

  it("rejects horizontal letterbox bars around a portrait frame", () => {
    const input = {
      rect: rect(1000, 500, 0, 0),
      naturalWidth: 500,
      naturalHeight: 1000,
    };
    expect(
      mapBrowserPoint({ ...input, clientX: 374, clientY: 250 }),
    ).toBeNull();
    expect(mapBrowserPoint({ ...input, clientX: 375, clientY: 250 })).toEqual({
      nx: 0,
      ny: 0.5,
    });
    expect(mapBrowserPoint({ ...input, clientX: 625, clientY: 250 })).toEqual({
      nx: 1,
      ny: 0.5,
    });
    expect(
      mapBrowserPoint({ ...input, clientX: 626, clientY: 250 }),
    ).toBeNull();
  });

  it("rejects vertical letterbox bars around a landscape frame", () => {
    const input = {
      rect: rect(500, 1000, 0, 0),
      naturalWidth: 1600,
      naturalHeight: 900,
    };
    expect(
      mapBrowserPoint({ ...input, clientX: 250, clientY: 358 }),
    ).toBeNull();
    expect(
      mapBrowserPoint({ ...input, clientX: 250, clientY: 359.375 }),
    ).toEqual({ nx: 0.5, ny: 0 });
    expect(
      mapBrowserPoint({ ...input, clientX: 250, clientY: 640.625 }),
    ).toEqual({ nx: 0.5, ny: 1 });
    expect(
      mapBrowserPoint({ ...input, clientX: 250, clientY: 642 }),
    ).toBeNull();
  });

  it("returns null for missing intrinsic or layout dimensions", () => {
    expect(
      mapBrowserPoint({
        clientX: 0,
        clientY: 0,
        rect: rect(0, 100),
        naturalWidth: 100,
        naturalHeight: 100,
      }),
    ).toBeNull();
  });
});

describe("normalizeBrowserWheel", () => {
  it("normalizes pixel, line, and page deltas with the product gain", () => {
    expect(
      normalizeBrowserWheel({ deltaX: 1, deltaY: -2, deltaMode: 0 }),
    ).toEqual({ dx: 2, dy: -4 });
    expect(
      normalizeBrowserWheel({ deltaX: 1, deltaY: 2, deltaMode: 1 }),
    ).toEqual({ dx: 32, dy: 64 });
    expect(
      normalizeBrowserWheel({ deltaX: 0, deltaY: 1, deltaMode: 2 }),
    ).toEqual({ dx: 0, dy: 1600 });
  });

  it("drops sub-pixel noise", () => {
    expect(
      normalizeBrowserWheel({ deltaX: 0.1, deltaY: -0.12, deltaMode: 0 }),
    ).toEqual({ dx: 0, dy: 0 });
  });
});
