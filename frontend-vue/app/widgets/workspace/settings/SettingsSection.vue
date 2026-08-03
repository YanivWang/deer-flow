<script setup lang="ts">
defineProps<{ id: string; title?: string }>();
</script>

<template>
  <section :id="id" class="settings-content" :aria-label="title">
    <slot />
  </section>
</template>
