<script setup lang="ts">
/*
  【文件职责】     为 Settings 的 destructive/preview/form 动作提供受控确认对话框。
  【架构位置】     L3 Settings UI primitive
  【主要导出】     默认 SettingsActionDialog 组件
  【依赖关系】     Vue slots/emits
  【边界与注意】   pending 时不能关闭或重复确认；不使用 window.confirm。
*/

defineProps<{
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  destructive?: boolean;
  confirmDisabled?: boolean;
}>();

defineEmits<{
  cancel: [];
  confirm: [];
}>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4"
    @mousedown.self="!pending && $emit('cancel')"
  >
    <section
      role="alertdialog"
      aria-modal="true"
      :aria-label="title"
      class="bg-background border-border w-full max-w-lg rounded-xl border p-5 shadow-2xl"
    >
      <h3 class="text-lg font-semibold">{{ title }}</h3>
      <p v-if="description" class="text-muted-foreground mt-1 text-sm">
        {{ description }}
      </p>
      <div class="mt-4 space-y-3">
        <slot />
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-sm"
          :disabled="pending"
          @click="$emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-2 text-sm"
          :class="
            destructive
              ? 'bg-red-600 text-white'
              : 'bg-primary text-primary-foreground'
          "
          :disabled="pending || confirmDisabled"
          @click="$emit('confirm')"
        >
          {{ pending ? "…" : confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>
