<script setup lang="ts">
import { Files } from "lucide-vue-next";

defineProps<{ count: number }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <button
    v-if="count > 0"
    type="button"
    data-testid="artifact-trigger"
    aria-label="Show artifacts"
    class="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 items-center gap-1.5 rounded-md px-2 text-xs"
    @click="emit('open')"
  >
    <Files :size="15" />
    <span class="hidden sm:inline">Artifacts</span>
  </button>
</template>
