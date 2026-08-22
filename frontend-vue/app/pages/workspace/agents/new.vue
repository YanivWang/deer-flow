<script setup lang="ts">
/*
  【文件职责】     创建 DeerFlow custom agent。
  【对应 frontend/】 src/app/workspace/agents/new/page.tsx
  【架构位置】     L3 application page
  【主要导出】     默认 new agent page
  【依赖关系】     agents API · workspace routing
  【边界与注意】   agent 管理业务，不属于 L2。
*/
import { ref } from "vue";

import AgentChat from "@/components/chat/AgentChat.vue";
import {
  AgentNameCheckError,
  AgentsApiDisabledError,
  checkAgentName,
} from "@/core/agents/api";

definePageMeta({ layout: "workspace" });
const { $i18n } = useNuxtApp();
const name = ref("");
const confirmedName = ref<string | null>(null);
const checking = ref(false);
const error = ref("");
const namePattern = /^[A-Za-z0-9-]+$/;

async function continueSetup() {
  const candidate = name.value.trim();
  error.value = "";
  if (!namePattern.test(candidate)) {
    error.value = $i18n.t.value.agents.nameStepInvalidError;
    return;
  }
  checking.value = true;
  try {
    const result = await checkAgentName(candidate);
    if (!result.available) {
      error.value = $i18n.t.value.agents.nameStepAlreadyExistsError;
      return;
    }
    confirmedName.value = candidate;
  } catch (cause) {
    error.value =
      cause instanceof AgentsApiDisabledError
        ? $i18n.t.value.agents.nameStepApiDisabledError
        : cause instanceof AgentNameCheckError && cause.detail
          ? $i18n.t.value.agents.nameStepCheckErrorWithDetail.replace(
              "{detail}",
              cause.detail,
            )
          : $i18n.t.value.agents.nameStepCheckError;
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <div v-if="confirmedName" class="size-full">
    <AgentChat :agent-name="confirmedName" bootstrap />
  </div>
  <main v-else class="flex size-full items-center justify-center p-6">
    <form
      class="w-full max-w-sm space-y-5 text-center"
      @submit.prevent="continueSetup"
    >
      <div class="text-4xl" aria-hidden="true">🤖</div>
      <div>
        <h1 class="text-xl font-semibold">
          {{ $i18n.t.value.agents.nameStepTitle }}
        </h1>
        <p class="text-muted-foreground mt-2 text-sm">
          {{ $i18n.t.value.agents.nameStepHint }}
        </p>
      </div>
      <input
        v-model="name"
        required
        :aria-label="$i18n.t.value.agents.nameStepTitle"
        :placeholder="$i18n.t.value.agents.nameStepPlaceholder"
        class="border-input w-full rounded-md border px-3 py-2 text-left"
      />
      <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit"
        class="bg-primary text-primary-foreground w-full rounded-md px-3 py-2"
        :disabled="checking"
      >
        {{
          checking
            ? $i18n.t.value.agents.nameStepChecking
            : $i18n.t.value.agents.nameStepContinue
        }}
      </button>
    </form>
  </main>
</template>
