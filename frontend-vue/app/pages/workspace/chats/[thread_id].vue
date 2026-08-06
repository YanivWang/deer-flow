<!--
  【文件职责】     M4a 的最小可用聊天页：发消息 → 流式 → 停止 → 刷新恢复顺序。
  【对应 frontend/】 src/app/workspace/chats/[thread_id]/page.tsx（**只对应它的骨架**）
  【架构位置】     L2/L3 之间的临时壳
  【主要导出】     /workspace/chats/:thread_id 路由
  【边界与注意】   ⚠️ **这不是 M4b 的聊天页，是数据流的验收装置。**
                   06 §M4a 的 gate 原话是「先只接一个最小可用聊天页…再往下做组件」。
                   本文件刻意只有一个 textarea、一个发送/停止按钮和一列消息，
                   没有 composer、没有侧栏、没有 markdown 渲染——M3 的
                   `StreamMarkdown` 在这里**故意不接**，它的接线在 M4b，
                   混进来会让「流式顺序错了」和「渲染层错了」分不开，
                   而分不开正是这个 gate 要避免的事。

                   `placeholder` 与上游逐字一致（"How can I assist you today?"），
                   因为共享合同 spec 用它当选择器。这是本页与 M4b 唯一的重合点。

                   thread id 走 `new` 特例：`/workspace/chats/new` 在客户端生成
                   一个 uuid 但**不写进路由**，直到 `POST /runs/stream` 真的建出
                   thread 才 replace。这一条就是 `chat-thread-init-ordering`
                   验的东西（issue #2746）——提前把 id 放进路由，历史查询会
                   在 thread 存在之前就打 404。
-->

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { useThreadStream } from "@/composables/useThreadStream";
import { isHiddenFromUIMessage } from "@/core/messages/utils";
import type { Message } from "@/core/types/message";

definePageMeta({ layout: "workspace" });

const route = useRoute();
const router = useRouter();

const routeThreadId = computed(() => {
  const raw = route.params.thread_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "new" || !value ? null : value;
});

/** 客户端草稿 id：只在提交时才用，不进路由（见文件头）。 */
const draftThreadId = ref(globalThis.crypto.randomUUID());
watch(routeThreadId, (id) => {
  if (id === null) draftThreadId.value = globalThis.crypto.randomUUID();
});

const context = ref({ mode: "flash" });
const warnings = ref<string[]>([]);

const stream = useThreadStream({
  threadId: routeThreadId,
  context,
  notify: {
    warn: (key) => warnings.value.push(key),
    error: (message) => warnings.value.push(message),
  },
  onStart(startedThreadId) {
    if (routeThreadId.value === null) {
      void router.replace(`/workspace/chats/${startedThreadId}`);
    }
  },
});

const input = ref("");

const visibleMessages = computed(() =>
  stream.messages.value.filter(
    (message: Message) => !isHiddenFromUIMessage(message),
  ),
);

function textOf(message: Message): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      typeof part === "object" && part !== null && "text" in part
        ? String((part as { text?: unknown }).text ?? "")
        : "",
    )
    .join("");
}

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await stream.sendMessage(routeThreadId.value ?? draftThreadId.value, {
    text,
  });
}
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 p-6">
    <ul data-testid="message-list" class="flex-1 space-y-3 overflow-y-auto">
      <li
        v-for="(message, index) in visibleMessages"
        :key="message.id ?? index"
        :data-role="message.type"
        class="text-sm whitespace-pre-wrap"
      >
        {{ textOf(message) }}
      </li>
    </ul>

    <p v-if="warnings.length > 0" role="status" class="text-sm text-amber-600">
      {{ warnings.at(-1) }}
    </p>

    <div class="flex items-end gap-2">
      <textarea
        v-model="input"
        placeholder="How can I assist you today?"
        rows="2"
        class="border-border flex-1 resize-none rounded-md border p-2 text-sm"
        @keydown.enter.exact.prevent="send"
      />
      <button
        v-if="stream.isStreaming.value"
        type="button"
        class="rounded-md border px-3 py-2 text-sm"
        @click="stream.stop()"
      >
        Stop
      </button>
      <button
        v-else
        type="button"
        class="rounded-md border px-3 py-2 text-sm"
        @click="send"
      >
        Send
      </button>
    </div>
  </div>
</template>
