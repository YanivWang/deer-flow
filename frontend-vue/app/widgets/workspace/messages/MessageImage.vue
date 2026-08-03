<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  alt: string;
  reveal?: boolean;
  src: string;
}>();

const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <a
    class="rich-message-content__image-link"
    :class="{ 'rich-message-content__streaming-reveal': props.reveal }"
    :data-testid="props.reveal ? 'vue-message-streaming-reveal' : 'vue-message-image-link'"
    :href="props.src"
    target="_blank"
    rel="noopener noreferrer"
  >
    <img
      v-if="!failed"
      :src="props.src"
      :alt="props.alt"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    >
    <span
      v-else
      class="rich-message-content__image-error"
      data-testid="vue-message-image-error"
      role="alert"
    >图片加载失败{{ props.alt ? `：${props.alt}` : "" }}</span>
  </a>
</template>
