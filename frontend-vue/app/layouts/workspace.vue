<script setup lang="ts">
import ThreadSidebar from "@/components/workspace/ThreadSidebar.vue";
import SettingsDialog from "@/components/workspace/settings/SettingsDialog.vue";
</script>

<template>
  <div class="bg-background text-foreground flex h-screen overflow-hidden">
    <ThreadSidebar />
    <main class="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <slot />
    </main>
    <SettingsDialog />
  </div>
</template>
