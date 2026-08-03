<script setup lang="ts">
withDefaults(
  defineProps<{ state?: "initial" | "loading" | "empty" | "error"; title?: string; message?: string }>(),
  { state: "empty", title: "暂无内容", message: undefined },
);

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <section class="app-empty-state" :data-state="state" :role="state === 'error' ? 'alert' : 'status'">
    <strong>{{ title }}</strong>
    <p v-if="message">{{ message }}</p>
    <span v-if="state === 'loading'">加载中…</span>
    <button v-if="state === 'error'" type="button" @click="emit('retry')">重试</button>
    <slot />
  </section>
</template>

<style scoped lang="scss">
.app-empty-state {
  display: grid;
  gap: var(--df-space-2);
  place-items: center;
  padding: var(--df-space-8);
  color: var(--df-color-text-secondary);
  text-align: center;
}
.app-empty-state p { margin: 0; }

.app-empty-state button {
  color: var(--df-color-link);
  background: transparent;
  border: 0;
  cursor: pointer;
}
</style>
