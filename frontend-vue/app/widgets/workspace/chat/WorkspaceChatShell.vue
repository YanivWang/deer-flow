<script setup lang="ts">
const props = defineProps<{
  isWelcomeMode: boolean;
  mobileNavOpen?: boolean;
}>();

const emit = defineEmits<{
  toggleMobileNav: [];
}>();
</script>

<template>
  <main
    class="workspace-page workspace-shell"
    :class="{ 'workspace-shell--welcome': isWelcomeMode }"
  >
    <a class="workspace-nav-shell__skip" href="#workspace-chat-content">Skip to content</a>
    <aside
      class="workspace-sidebar"
      :class="{ 'workspace-sidebar--mobile-open': props.mobileNavOpen }"
    >
      <slot name="sidebar" />
    </aside>
    <section
      id="workspace-chat-content"
      class="workspace-chat"
      :class="{ 'workspace-chat--welcome': isWelcomeMode }"
      tabindex="-1"
    >
      <div class="workspace-chat__utility-bar">
        <button
          class="workspace-nav-shell__mobile-toggle"
          data-testid="vue-workspace-nav-mobile-toggle"
          type="button"
          @click="emit('toggleMobileNav')"
        >
          导航
        </button>
        <slot name="utility" />
      </div>
      <slot />
    </section>
  </main>
</template>
