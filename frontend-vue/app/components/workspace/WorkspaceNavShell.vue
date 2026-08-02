<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const route = useRoute();
const { t } = useAppI18n();
const agentsFeature = useAgentsApiEnabled({
  enabled: route.path.startsWith("/workspace/agents"),
});
const NAV_COLLAPSED_STORAGE_KEY = "deerflow.vue.workspace-nav.collapsed";
const NAV_DENSITY_STORAGE_KEY = "deerflow.vue.workspace-nav.density";

type WorkspaceNavItem = {
  id: string;
  label: string;
  to: string;
  match: (path: string) => boolean;
};

type WorkspaceNavDensity = "comfortable" | "compact";

type WorkspaceBreadcrumb = {
  label: string;
  to?: string;
};

const navItems: WorkspaceNavItem[] = [
  {
    id: "new-chat",
    label: t("sidebar.newChat"),
    to: "/workspace/chats/new",
    match: (path) => path === "/workspace/chats/new",
  },
  {
    id: "chats",
    label: t("sidebar.chats"),
    to: "/workspace/chats",
    match: (path) => path === "/workspace/chats" || path.startsWith("/workspace/chats/"),
  },
  {
    id: "agents",
    label: t("sidebar.agents"),
    to: "/workspace/agents",
    match: (path) => path.startsWith("/workspace/agents"),
  },
  {
    id: "scheduled",
    label: t("sidebar.scheduledTasks"),
    to: "/workspace/scheduled-tasks",
    match: (path) => path.startsWith("/workspace/scheduled-tasks"),
  },
  {
    id: "settings",
    label: t("common.settings"),
    to: "/workspace/settings",
    match: (path) => path.startsWith("/workspace/settings"),
  },
];

const isCollapsed = ref(false);
const density = ref<WorkspaceNavDensity>("comfortable");
const agentsFeatureTooltipVisible = ref(false);
const visibleNavItems = computed(() =>
  agentsFeature.enabled.value ? navItems : navItems.filter((item) => item.id !== "agents"),
);
const activeNavItem = computed(() => navItems.find((item) => item.match(route.path)));
const breadcrumbs = computed(() => buildWorkspaceBreadcrumbs(route.path));

onMounted(() => {
  isCollapsed.value = readStorageValue(NAV_COLLAPSED_STORAGE_KEY) === "true";
  const storedDensity = readStorageValue(NAV_DENSITY_STORAGE_KEY);
  density.value = storedDensity === "compact" ? "compact" : "comfortable";
  window.addEventListener("keydown", handleNavKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleNavKeydown);
});

function toggleCollapsed() {
  isCollapsed.value = !isCollapsed.value;
  writeStorageValue(NAV_COLLAPSED_STORAGE_KEY, String(isCollapsed.value));
}

function toggleDensity() {
  density.value = density.value === "compact" ? "comfortable" : "compact";
  writeStorageValue(NAV_DENSITY_STORAGE_KEY, density.value);
}

function handleNavKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
    event.preventDefault();
    toggleCollapsed();
  }
}

function readStorageValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function buildWorkspaceBreadcrumbs(path: string): WorkspaceBreadcrumb[] {
  if (path === "/workspace") {
    return [{ label: t("common.home") }];
  }

  const breadcrumbs: WorkspaceBreadcrumb[] = [{ label: t("common.home"), to: "/workspace" }];
  if (path === "/workspace/chats/new") {
    return [...breadcrumbs, { label: t("sidebar.newChat") }];
  }
  if (path === "/workspace/chats" || path.startsWith("/workspace/chats/")) {
    return [...breadcrumbs, { label: t("sidebar.chats"), to: "/workspace/chats" }];
  }
  if (path === "/workspace/agents/new") {
    return [...breadcrumbs, { label: t("sidebar.agents"), to: "/workspace/agents" }, { label: t("agents.newAgent") }];
  }
  if (path === "/workspace/agents" || path.startsWith("/workspace/agents/")) {
    return [...breadcrumbs, { label: t("sidebar.agents"), to: "/workspace/agents" }];
  }
  if (path.startsWith("/workspace/scheduled-tasks")) {
    return [...breadcrumbs, { label: t("sidebar.scheduledTasks") }];
  }
  if (path.startsWith("/workspace/settings")) {
    return [...breadcrumbs, { label: t("common.settings") }];
  }

  return [...breadcrumbs, { label: t("common.home") }];
}
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
    <aside class="workspace-nav-shell__sidebar" data-testid="vue-workspace-nav">
      <NuxtLink class="workspace-nav-shell__brand" data-testid="vue-workspace-nav-home" to="/workspace">
        <span class="workspace-nav-shell__label">DeerFlow</span>
        <span class="workspace-nav-shell__mark">DF</span>
      </NuxtLink>
      <div class="workspace-nav-shell__controls">
        <button
          class="workspace-nav-shell__control"
          data-testid="vue-workspace-nav-collapse"
          type="button"
          @click="toggleCollapsed"
        >
          {{ isCollapsed ? "展开" : "折叠" }}
        </button>
        <button
          class="workspace-nav-shell__control"
          data-testid="vue-workspace-nav-density"
          type="button"
          @click="toggleDensity"
        >
          {{ density === "compact" ? "舒适" : "紧凑" }}
        </button>
      </div>
      <nav class="workspace-nav-shell__links">
        <NuxtLink
          v-for="item in visibleNavItems"
          :key="item.id"
          class="workspace-nav-shell__link"
          :class="{ 'workspace-nav-shell__link--active': activeNavItem?.id === item.id }"
          :data-testid="`vue-workspace-nav-${item.id}`"
          :to="item.to"
        >
          <span class="workspace-nav-shell__link-initial">
            {{ item.label.slice(0, 1) }}
          </span>
          <span class="workspace-nav-shell__label">{{ item.label }}</span>
        </NuxtLink>
        <span
          v-if="!agentsFeature.enabled.value"
          class="workspace-nav-shell__feature-disabled"
          data-testid="vue-workspace-nav-agents-disabled"
          @mouseenter="agentsFeatureTooltipVisible = true"
          @mouseleave="agentsFeatureTooltipVisible = false"
          @focusin="agentsFeatureTooltipVisible = true"
          @focusout="agentsFeatureTooltipVisible = false"
        >
          <button
            class="workspace-nav-shell__link workspace-nav-shell__link--disabled"
            data-testid="vue-workspace-nav-agents"
            type="button"
            @focus="agentsFeatureTooltipVisible = true"
          >
            <span class="workspace-nav-shell__link-initial">A</span>
            <span class="workspace-nav-shell__label">{{ t("sidebar.agents") }}</span>
          </button>
          <span
            v-if="agentsFeatureTooltipVisible"
            class="workspace-nav-shell__feature-tooltip"
            role="tooltip"
          >
            {{ t("sidebar.agentsDisabledTooltip") }}
          </span>
        </span>
      </nav>
    </aside>
    <section id="workspace-main-content" class="workspace-nav-shell__content" tabindex="-1">
      <header class="workspace-nav-shell__topbar" data-testid="vue-workspace-header">
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
              <span v-else>
                {{ breadcrumb.label }}
              </span>
            </li>
          </ol>
        </nav>
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
