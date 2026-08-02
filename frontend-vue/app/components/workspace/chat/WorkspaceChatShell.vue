<script setup lang="ts">
defineProps<{
  isWelcomeMode: boolean;
}>();
</script>

<template>
  <main
    class="workspace-page workspace-shell"
    :class="{ 'workspace-shell--welcome': isWelcomeMode }"
  >
    <a class="workspace-nav-shell__skip" href="#workspace-chat-content">Skip to content</a>
    <aside class="workspace-sidebar">
      <slot name="sidebar" />
    </aside>
    <section
      id="workspace-chat-content"
      class="workspace-chat"
      :class="{ 'workspace-chat--welcome': isWelcomeMode }"
      tabindex="-1"
    >
      <div class="workspace-chat__utility-bar">
        <slot name="utility" />
      </div>
      <slot />
    </section>
  </main>
</template>
