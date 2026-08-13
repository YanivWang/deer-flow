<script setup lang="ts">
import { Monitor } from "lucide-vue-next";
defineEmits<{ open: [] }>();
</script>
<template>
  <button
    type="button"
    data-testid="browser-trigger"
    aria-label="Open browser panel"
    class="text-muted-foreground hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="$emit('open')"
  >
    <Monitor :size="16" />
  </button>
</template>
