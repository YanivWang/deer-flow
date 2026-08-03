<script setup lang="ts">
import { useWorkspaceNavigation } from "../../../features/workspace/navigation/use-workspace-navigation";
import WorkspaceNavigation from "./WorkspaceNavigation.vue";

const navigation = useWorkspaceNavigation();
const breadcrumbs = navigation.breadcrumbs;
const density = navigation.density;
const isCollapsed = navigation.isCollapsed;
</script>

<template>
  <main
    class="workspace-page workspace-nav-shell"
    :class="{
      'workspace-nav-shell--collapsed': isCollapsed,
      'workspace-nav-shell--compact': density === 'compact',
    }"
    :data-density="density"
  >
    <a class="workspace-nav-shell__skip" href="#workspace-main-content">
      跳到主内容
    </a>
    <WorkspaceNavigation :navigation="navigation" />
    <section id="workspace-main-content" class="workspace-nav-shell__content" tabindex="-1">
      <header class="workspace-nav-shell__topbar" data-testid="vue-workspace-header">
        <div class="workspace-nav-shell__topbar-leading">
          <button
            class="workspace-nav-shell__mobile-toggle"
            data-testid="vue-workspace-nav-mobile-toggle"
            type="button"
            @click="navigation.toggleMobileOpen"
          >
            导航
          </button>
          <nav>
            <ol class="workspace-nav-shell__breadcrumbs">
              <li
                v-for="(breadcrumb, index) in breadcrumbs"
                :key="`${breadcrumb.label}-${index}`"
                class="workspace-nav-shell__breadcrumb"
              >
                <NuxtLink
                  v-if="breadcrumb.to && index < breadcrumbs.length - 1"
                  :to="breadcrumb.to"
                >
                  {{ breadcrumb.label }}
                </NuxtLink>
                <span v-else>{{ breadcrumb.label }}</span>
              </li>
            </ol>
          </nav>
        </div>
        <a
          class="workspace-nav-shell__github"
          data-testid="vue-workspace-github"
          href="https://github.com/bytedance/deer-flow"
          rel="noopener noreferrer"
          target="_blank"
        >
          GitHub
        </a>
      </header>
      <slot />
    </section>
  </main>
</template>
