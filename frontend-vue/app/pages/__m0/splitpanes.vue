<!--
  【文件职责】     以真实 splitpanes 组件验证 H1/H2/H6。
  【对应 frontend/】 frontend/src/components/workspace/chats/chat-box.tsx
  【架构位置】     测试夹具
  【主要导出】     /__m0/splitpanes 测试页
  【依赖关系】     消费 splitpanes；仅在 M0 测试开关开启时可用
  【边界与注意】   spike，不实现业务面板。
-->

<script setup lang="ts">
import { ref } from "vue";
import { Pane, Splitpanes } from "splitpanes";
import { isEnabledRuntimeFlag } from "@/core/auth/decision";

const config = useRuntimeConfig();
if (!isEnabledRuntimeFlag(config.public.m0TestPages)) {
  throw createError({ statusCode: 404 });
}

const leftSize = ref(55);
const rightSizes = ref([15, 15, 15]);
const resizeCount = ref(0);
const resizedCount = ref(0);

function collapseRightPanels() {
  leftSize.value = 100;
  rightSizes.value = [0, 0, 0];
}

function restoreRightPanels() {
  leftSize.value = 55;
  rightSizes.value = [15, 15, 15];
}
</script>

<template>
  <main class="bg-background text-foreground h-screen p-6">
    <div class="mb-4 flex items-center gap-3">
      <button
        data-collapse
        class="rounded border px-3 py-1"
        @click="collapseRightPanels"
      >
        Collapse
      </button>
      <button
        data-restore
        class="rounded border px-3 py-1"
        @click="restoreRightPanels"
      >
        Restore
      </button>
      <output data-resize-count>{{ resizeCount }}</output>
      <output data-resized-count>{{ resizedCount }}</output>
    </div>
    <Splitpanes
      data-pane-group
      class="default-theme h-[420px]"
      @resize="resizeCount += 1"
      @resized="resizedCount += 1"
    >
      <Pane :size="leftSize" min-size="20"
        ><div data-pane="main" class="h-full p-4">Main</div></Pane
      >
      <Pane
        v-for="(size, index) in rightSizes"
        :key="index"
        :size="size"
        min-size="0"
      >
        <div :data-pane="`right-${index + 1}`" class="h-full p-4">
          Right {{ index + 1 }}
        </div>
      </Pane>
    </Splitpanes>
  </main>
</template>
