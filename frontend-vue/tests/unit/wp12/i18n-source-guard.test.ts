/*
  【文件职责】     固定 WP-12 Vue SFC 用户可见英文 source guard 与精确豁免边界。
  【架构位置】     WP-12 tooling unit test
  【主要导出】     无；Vitest cases
  【依赖关系】     scripts/lib/i18n-source-guard.mjs
  【边界与注意】   只豁免动态 backend/user/code/file/URL/协议值和明确测试 fixture。
*/

import { describe, expect, it } from "vitest";

import {
  productVueInventory,
  scanProductVueFiles,
  scanVueSource,
} from "../../../scripts/lib/i18n-source-guard.mjs";

describe("i18n source guard", () => {
  it("detects template text, accessible attributes and UI-bound script fallbacks", () => {
    const issues = scanVueSource(
      `
<script setup lang="ts">
const error = ref("")
error.value = "Could not save artifact"
const statusLabel = computed(() => "Loading workspace")
const currentTitle = computed(() => "New Chat")
function toolLabel() { return "Write file" }
function failDemo() { throw new Error("Demo is unavailable") }
</script>
<template>
  <button aria-label="Save artifact">Save artifact</button>
  <p>{{ error }}</p><output>{{ statusLabel }}</output>
  <h2 :title="ready ? 'Open report' : request.title">
    {{ request.title ?? "Clarification" }}
  </h2>
</template>`,
      "app/components/workspace/Fixture.vue",
    );
    expect(issues.map((issue: { text: string }) => issue.text)).toEqual(
      expect.arrayContaining([
        "Could not save artifact",
        "Clarification",
        "Demo is unavailable",
        "Loading workspace",
        "New Chat",
        "Open report",
        "Save artifact",
        "Write file",
      ]),
    );
  });

  it("does not translate dynamic backend, user, code, filename, URL, protocol or test-id values", () => {
    const issues = scanVueSource(
      `
<script setup lang="ts">
const method = "POST"
const contentType = "application/json"
const eventName = "task_started"
const route = "/api/threads/demo"
const errorCode = "permission_denied"
</script>
<template>
  <pre>{{ code }}</pre>
  <p>{{ backendError.detail }}</p>
  <p>{{ user.content }}</p>
  <span :title="file.name">{{ file.name }}</span>
  <a :href="url">{{ url }}</a>
  <div data-testid="English-is-not-copy" />
</template>`,
      "app/components/workspace/DynamicFixture.vue",
    );
    expect(issues).toEqual([]);
  });

  it("keeps the full product Vue surface free of untranslated core English", () => {
    const inventory = productVueInventory();
    expect(inventory.checked).toHaveLength(92);
    expect(inventory.checked).toContain("app/app.vue");
    expect(inventory.checked).toContain(
      "app/components/chat/AssistantTurnActions.vue",
    );
    expect(inventory.checked).toContain(
      "app/components/chat/ComposerAttachmentChip.vue",
    );
    expect(inventory.checked).toContain(
      "app/components/chat/ComposerModelSelector.vue",
    );
    expect(inventory.checked).toContain(
      "app/components/chat/ComposerSurface.vue",
    );
    expect(inventory.checked).toEqual(
      expect.arrayContaining([
        "app/components/chat/ProcessingMessageGroup.vue",
        "app/components/chat/ProcessingToolStep.vue",
        "app/components/chat/ReasoningDisclosure.vue",
        "app/components/chat/RunActivity.vue",
      ]),
    );
    expect(inventory.excludedTestFixtures).toEqual([
      "app/pages/__m0/splitpanes.vue",
      "app/pages/__m0/visual.vue",
    ]);
    expect(scanProductVueFiles()).toEqual([]);
  });
});
