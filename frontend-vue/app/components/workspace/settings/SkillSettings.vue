<script setup lang="ts">
/*
  【文件职责】     管理 DeerFlow skill 启用状态与详情。
  【对应 frontend/】 src/components/workspace/settings/skill-settings.tsx
  【架构位置】     L3
  【主要导出】     默认 SkillSettings 组件
  【依赖关系】     skills APIs · settings dialog
  【边界与注意】   skill 是 L1 禁入业务概念，不属于 L2。
*/
import { computed, onMounted, ref } from "vue";

import { enableSkill, loadSkills } from "@/core/skills/api";
import type { Skill } from "@/core/skills/type";
import { useSettingsDialog } from "@/composables/useSettingsDialog";

const settings = useSettingsDialog();
const skills = ref<Skill[]>([]);
const filter = ref<"public" | "custom">("public");
const loading = ref(false);
const error = ref("");
const filtered = computed(() =>
  skills.value.filter((skill) => skill.category === filter.value),
);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    skills.value = await loadSkills();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Failed to load skills";
  } finally {
    loading.value = false;
  }
}

async function toggle(skill: Skill, enabled: boolean) {
  const previous = skill.enabled;
  skill.enabled = enabled;
  try {
    await enableSkill(skill.name, enabled);
  } catch (cause) {
    skill.enabled = previous;
    error.value =
      cause instanceof Error ? cause.message : "Failed to update skill";
  }
}

async function createSkill() {
  settings.close();
  await navigateTo("/workspace/chats/new?mode=skill");
}

onMounted(() => void load());
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold">Skills</h2>
        <p class="text-muted-foreground text-sm">
          Enable installed skills or create one through the agent workflow.
        </p>
      </div>
      <button
        type="button"
        class="bg-primary text-primary-foreground rounded-md px-3 py-2"
        @click="createSkill"
      >
        Create skill
      </button>
    </header>
    <div class="flex gap-2">
      <button
        v-for="kind in ['public', 'custom'] as const"
        :key="kind"
        type="button"
        class="rounded-md border px-3 py-1.5 text-sm capitalize"
        :class="filter === kind ? 'bg-accent' : ''"
        @click="filter = kind"
      >
        {{ kind }}
      </button>
    </div>
    <p v-if="loading" class="text-muted-foreground text-sm">Loading…</p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <p
      v-if="!loading && !error && filtered.length === 0"
      class="text-muted-foreground rounded-md border p-4 text-sm"
    >
      No {{ filter }} skills installed.
    </p>
    <div
      v-for="skill in filtered"
      :key="skill.name"
      class="border-border flex items-center justify-between gap-4 rounded-md border p-3"
    >
      <div class="min-w-0">
        <div class="font-medium">{{ skill.name }}</div>
        <p class="text-muted-foreground text-sm">{{ skill.description }}</p>
      </div>
      <input
        type="checkbox"
        role="switch"
        :aria-label="skill.name"
        :checked="skill.enabled"
        @change="toggle(skill, ($event.target as HTMLInputElement).checked)"
      />
    </div>
  </section>
</template>
