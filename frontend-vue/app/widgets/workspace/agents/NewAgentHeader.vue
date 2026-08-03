<script setup lang="ts">
import { ref } from "vue";

import type { NewAgentStep, SetupAgentStatus } from "../../../features/agents/new/use-new-agent";

const props = defineProps<{
  canSave: boolean;
  setupAgentStatus: SetupAgentStatus;
  step: NewAgentStep;
}>();

const emit = defineEmits<{
  back: [];
  save: [];
}>();

const menuOpen = ref(false);

function requestSave(): void {
  menuOpen.value = false;
  emit("save");
}
</script>

<template>
  <header class="new-agent-header">
    <button
      class="workspace-button workspace-button--ghost"
      data-testid="vue-new-agent-back"
      type="button"
      @click="emit('back')"
    >
      返回
    </button>
    <div>
      <h1>设计你的智能体</h1>
      <p>描述你想要的自定义智能体，并通过 DeerFlow 保存。</p>
    </div>
    <div v-if="props.step === 'chat'" class="new-agent-header__actions">
      <button
        class="workspace-button workspace-button--ghost"
        data-testid="vue-new-agent-more"
        type="button"
        @click="menuOpen = !menuOpen"
      >
        更多
      </button>
      <div v-if="menuOpen" class="new-agent-header__menu" role="menu">
        <button
          class="workspace-button"
          data-testid="vue-new-agent-save"
          :disabled="!props.canSave"
          role="menuitem"
          type="button"
          @click="requestSave"
        >
          {{ props.setupAgentStatus === "requested" ? "正在保存智能体..." : "保存智能体" }}
        </button>
      </div>
    </div>
  </header>
</template>
