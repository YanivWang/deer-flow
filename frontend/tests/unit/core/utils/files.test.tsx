import { expect, test } from "@rstest/core";

import {
  canBrowserPreviewFile,
  getBrowserPreviewKind,
} from "@/core/utils/files";

test("classifies browser-previewable files by safe rendering surface", () => {
  expect(getBrowserPreviewKind("/mnt/user-data/outputs/chart.png")).toBe(
    "image",
  );
  expect(getBrowserPreviewKind("/mnt/user-data/outputs/narration.mp3")).toBe(
    "audio",
  );
  expect(getBrowserPreviewKind("/mnt/user-data/outputs/dancer-video.mp4")).toBe(
    "video",
  );
  expect(getBrowserPreviewKind("/mnt/user-data/outputs/report.pdf")).toBe(
    "iframe",
  );
});

test("treats only known safe browser preview extensions as previewable", () => {
  expect(canBrowserPreviewFile("/mnt/user-data/outputs/dancer-video.mp4")).toBe(
    true,
  );
  expect(canBrowserPreviewFile("/mnt/user-data/outputs/report.html")).toBe(
    false,
  );
  expect(canBrowserPreviewFile("/mnt/user-data/outputs/raw.bin")).toBe(false);
});
