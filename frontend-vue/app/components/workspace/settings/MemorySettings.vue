<script setup lang="ts">
/*
  【文件职责】     查看和修改 DeerFlow 记忆条目。
  【对应 frontend/】 src/components/workspace/settings/memory-settings.tsx
  【架构位置】     L3
  【主要导出】     默认 MemorySettings 组件
  【依赖关系】     memory APIs · settings dialog
  【边界与注意】   DeerFlow memory 业务，不属于 L2。
*/
import { computed, onMounted, ref } from "vue";

import {
  clearMemory,
  createMemoryFact,
  deleteMemoryFact,
  exportMemory,
  importMemory,
  loadMemory,
  updateMemoryFact,
} from "@/core/memory/api";
import type { MemoryFact, UserMemory } from "@/core/memory/types";

const memory = ref<UserMemory | null>(null);
const loading = ref(false);
const error = ref("");
const factContent = ref("");
const category = ref("context");
const editingId = ref<string | null>(null);
const importInput = ref<HTMLInputElement | null>(null);
const summaries = computed(() => {
  if (!memory.value) return [];
  return [
    { title: "Work context", summary: memory.value.user.workContext.summary },
    {
      title: "Personal context",
      summary: memory.value.user.personalContext.summary,
    },
    { title: "Top of mind", summary: memory.value.user.topOfMind.summary },
    {
      title: "Recent months",
      summary: memory.value.history.recentMonths.summary,
    },
    {
      title: "Earlier context",
      summary: memory.value.history.earlierContext.summary,
    },
    {
      title: "Long-term background",
      summary: memory.value.history.longTermBackground.summary,
    },
  ].filter((entry) => entry.summary.trim());
});

async function run(action: () => Promise<UserMemory>) {
  loading.value = true;
  error.value = "";
  try {
    memory.value = await action();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Memory request failed";
  } finally {
    loading.value = false;
  }
}

async function saveFact() {
  const content = factContent.value.trim();
  if (!content) return;
  await run(() =>
    editingId.value
      ? updateMemoryFact(editingId.value, { content, category: category.value })
      : createMemoryFact({
          content,
          category: category.value,
          confidence: 0.8,
        }),
  );
  factContent.value = "";
  editingId.value = null;
}

function editFact(fact: MemoryFact) {
  editingId.value = fact.id;
  factContent.value = fact.content;
  category.value = fact.category;
}

async function download() {
  try {
    const value = await exportMemory();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "deerflow-memory.json";
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Memory export failed";
  }
}

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text()) as UserMemory;
    await run(() => importMemory(parsed));
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Invalid memory file";
  } finally {
    (event.target as HTMLInputElement).value = "";
  }
}

onMounted(() => void run(loadMemory));
</script>

<template>
  <section class="space-y-5">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">Memory</h2>
        <p class="text-muted-foreground text-sm">
          Review summaries and manage durable facts stored by the Gateway.
        </p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-sm"
          @click="download"
        >
          Export
        </button>
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-sm"
          @click="importInput?.click()"
        >
          Import
        </button>
        <input
          ref="importInput"
          type="file"
          accept="application/json"
          class="hidden"
          @change="upload"
        />
        <button
          type="button"
          class="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700"
          @click="run(clearMemory)"
        >
          Clear
        </button>
      </div>
    </header>
    <p v-if="loading" class="text-muted-foreground text-sm">Loading…</p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <div v-if="summaries.length" class="space-y-3">
      <article
        v-for="entry in summaries"
        :key="entry.title"
        class="rounded-md border p-3"
      >
        <h3 class="font-medium">{{ entry.title }}</h3>
        <p class="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
          {{ entry.summary }}
        </p>
      </article>
    </div>
    <form class="rounded-md border p-3" @submit.prevent="saveFact">
      <h3 class="font-medium">{{ editingId ? "Edit fact" : "Add fact" }}</h3>
      <textarea
        v-model="factContent"
        required
        rows="3"
        placeholder="Durable fact"
        class="border-input mt-2 w-full rounded-md border p-2"
      />
      <div class="mt-2 flex gap-2">
        <input
          v-model="category"
          aria-label="Fact category"
          class="border-input min-w-0 flex-1 rounded-md border px-3 py-2"
        />
        <button
          type="submit"
          class="bg-primary text-primary-foreground rounded-md px-3 py-2"
          :disabled="loading"
        >
          Save
        </button>
      </div>
    </form>
    <div class="space-y-2">
      <article
        v-for="fact in memory?.facts ?? []"
        :key="fact.id"
        class="flex items-start justify-between gap-3 rounded-md border p-3"
      >
        <div>
          <p class="text-sm">{{ fact.content }}</p>
          <p class="text-muted-foreground mt-1 text-xs">
            {{ fact.category }} · confidence {{ fact.confidence }}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="text-sm underline"
            @click="editFact(fact)"
          >
            Edit
          </button>
          <button
            type="button"
            class="text-sm text-red-600 underline"
            @click="run(() => deleteMemoryFact(fact.id))"
          >
            Delete
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
