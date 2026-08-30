/*
  【文件职责】     固定Vue SFC 用户可见英文 source guard 与精确豁免边界。
  【架构位置】     tooling unit test
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
    expect(inventory.checked).toHaveLength(185);
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
    // UI primitive 层同样在扫描面内。primitive 不持有产品文案——关闭按钮、
    // placeholder 之类的可访问名字一律由调用方传入——所以它们必须是被检查的，
    // 而不是被豁免的。
    expect(inventory.checked).toEqual(
      expect.arrayContaining([
        "app/components/ui/alert-dialog/AlertDialogContent.vue",
        "app/components/ui/command/CommandInput.vue",
        "app/components/ui/dialog/DialogContent.vue",
        "app/components/ui/dropdown-menu/DropdownMenuContent.vue",
        "app/components/ui/popover/PopoverContent.vue",
        "app/components/ui/select/SelectTrigger.vue",
        "app/components/ui/sheet/SheetContent.vue",
        "app/components/ui/switch/Switch.vue",
        "app/components/ui/tabs/TabsTrigger.vue",
        "app/components/ui/tooltip/TooltipContent.vue",
      ]),
    );
    expect(inventory.excludedTestFixtures).toEqual([
      "app/pages/__m0/splitpanes.vue",
      "app/pages/__m0/visual.vue",
    ]);
    expect(scanProductVueFiles()).toEqual([]);
  });
});
