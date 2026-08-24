<script setup lang="ts">
/*
  【文件职责】     复用 composer skill catalog，并按 session role 管理全局 skill 开关。
  【架构位置】     L3 product UI
  【主要导出】     默认 SkillSettings 组件
  【依赖关系】     useSettingsPermissions · useSkillSettings · ui/tabs · ui/switch
  【边界与注意】   普通用户可读 catalog 但不能 PUT；create-skill 对话入口不是全局启停权限。
*/

import { computed, ref } from "vue";

import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { useSkillSettings } from "@/composables/useSkillSettings";
import { SkillRequestError } from "@/core/skills/api";
import type { Skill } from "@/core/skills/type";

const { $i18n } = useNuxtApp();
const t = computed(() => $i18n.t.value);
const settings = useSettingsDialog();
const access = useSettingsPermissions();
const skills = useSkillSettings({
  canManage: access.canManageSkills,
  enabled: access.canReadSkills,
});
const filter = ref<"public" | "custom">("public");
const actionError = ref("");
const pendingName = ref<string | null>(null);
const filtered = computed(() =>
  skills.skills.value.filter((skill) => skill.category === filter.value),
);

function errorMessage(cause: unknown) {
  if (cause instanceof SkillRequestError && cause.isAdminRequired) {
    return t.value.settings.skills.adminRequired;
  }
  return cause instanceof Error && cause.message
    ? cause.message
    : t.value.settings.skills.description;
}

async function toggle(skill: Skill, enabled: boolean) {
  // 受控开关：视觉状态只跟随服务端真相，请求失败时不会停在一个假的 on。
  if (!access.canManageSkills.value || skills.pending.value) return;
  actionError.value = "";
  pendingName.value = skill.name;
  try {
    await skills.toggle(skill.name, enabled);
  } catch (cause) {
    actionError.value = errorMessage(cause);
  } finally {
    pendingName.value = null;
  }
}

async function createSkill() {
  settings.close();
  await navigateTo("/workspace/chats/new?mode=skill");
}
</script>

<template>
  <section class="space-y-4" data-testid="skill-settings">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold">{{ t.settings.skills.title }}</h2>
        <p class="text-muted-foreground text-sm">
          {{ t.settings.skills.description }}
        </p>
      </div>
      <button
        type="button"
        class="bg-primary text-primary-foreground rounded-md px-3 py-2"
        data-testid="create-skill"
        @click="createSkill"
      >
        {{ t.settings.skills.createSkill }}
      </button>
    </header>

    <p
      v-if="access.permissions.value.state === 'loading'"
      class="text-muted-foreground text-sm"
    >
      {{ t.common.loading }}
    </p>
    <p
      v-else-if="access.permissions.value.state === 'unavailable'"
      role="alert"
      class="rounded-md bg-red-50 p-3 text-sm text-red-700"
      data-testid="settings-session-unavailable"
    >
      {{ t.settings.sessionUnavailable }}
    </p>
    <template v-else>
      <p
        v-if="access.permissions.value.adminRequired"
        class="rounded-md bg-amber-50 p-3 text-sm text-amber-800"
        data-testid="skills-admin-required"
      >
        {{ t.settings.skills.adminRequired }}
      </p>
      <Tabs v-model="filter">
        <TabsList :aria-label="t.settings.skills.title">
          <TabsTrigger
            v-for="kind in ['public', 'custom'] as const"
            :key="kind"
            :value="kind"
          >
            {{ kind === "public" ? t.common.public : t.common.custom }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <p v-if="skills.loading.value" class="text-muted-foreground text-sm">
        {{ t.common.loading }}
      </p>
      <p v-if="skills.error.value" role="alert" class="text-sm text-red-600">
        {{ errorMessage(skills.error.value) }}
      </p>
      <p
        v-if="actionError"
        role="alert"
        class="text-sm text-red-600"
        data-testid="skill-action-error"
      >
        {{ actionError }}
      </p>
      <p
        v-if="
          !skills.loading.value && !skills.error.value && filtered.length === 0
        "
        class="text-muted-foreground rounded-md border p-4 text-sm"
      >
        {{ t.settings.skills.emptyTitle }}
      </p>
      <div
        v-for="skill in filtered"
        :key="skill.name"
        class="border-border flex items-center justify-between gap-4 rounded-md border p-3"
        :data-testid="`skill-${skill.name}`"
      >
        <div class="min-w-0">
          <div class="font-medium">{{ skill.name }}</div>
          <p class="text-muted-foreground text-sm">{{ skill.description }}</p>
        </div>
        <Switch
          :aria-label="skill.name"
          :model-value="skill.enabled"
          :disabled="!access.canManageSkills.value || skills.pending.value"
          :data-pending="pendingName === skill.name || undefined"
          @update:model-value="toggle(skill, $event)"
        />
      </div>
    </template>
  </section>
</template>
