<script setup lang="ts">
const props = defineProps<{
  canContinue: boolean;
  isChecking: boolean;
  modelValue: string;
  nameError: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  clearError: [];
  confirm: [];
}>();

function updateName(event: Event): void {
  const target = event.target;
  emit("update:modelValue", target instanceof HTMLInputElement ? target.value : "");
  emit("clearError");
}
</script>

<template>
  <section class="new-agent-name-step">
    <div class="new-agent-name-card">
      <h2>命名你的新智能体</h2>
      <p>只能使用字母、数字和连字符。DeerFlow 会存储规范化后的后端名称。</p>
      <label class="workspace-field">
        <span>名称</span>
        <input
          :value="props.modelValue"
          autocomplete="off"
          data-testid="vue-new-agent-name"
          placeholder="code-reviewer"
          @input="updateName"
          @keydown.enter.prevent="emit('confirm')"
        >
      </label>
      <p
        v-if="props.nameError"
        id="vue-new-agent-name-error-message"
        class="workspace-error"
        data-testid="vue-new-agent-name-error"
        role="alert"
      >
        {{ props.nameError }}
      </p>
      <button
        class="workspace-button workspace-button--primary"
        data-testid="vue-new-agent-continue"
        :disabled="!props.canContinue"
        type="button"
        @click="emit('confirm')"
      >
        {{ props.isChecking ? "正在检查..." : "继续" }}
      </button>
    </div>
  </section>
</template>
