import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { useAgentsApiEnabled } from "../../agents/use-agents-api-enabled";

export type WorkspaceNavDensity = "comfortable" | "compact";

export type WorkspaceNavItem = {
  id: "new-chat" | "chats" | "agents" | "scheduled" | "settings";
  label: string;
  to: string;
  match: (path: string) => boolean;
};

export type WorkspaceBreadcrumb = {
  label: string;
  to?: string;
};

const NAV_COLLAPSED_STORAGE_KEY = "deerflow.vue.workspace-nav.collapsed";
const NAV_DENSITY_STORAGE_KEY = "deerflow.vue.workspace-nav.density";

export function useWorkspaceNavigation() {
  const route = useRoute();
  const { t } = useAppI18n();
  const agentsFeature = useAgentsApiEnabled({
    enabled: route.path.startsWith("/workspace/agents"),
  });
  const isCollapsed = ref(false);
  const isMobileOpen = ref(false);
  const density = ref<WorkspaceNavDensity>("comfortable");
  const agentsFeatureTooltipVisible = ref(false);

  const navItems = computed<readonly WorkspaceNavItem[]>(() => [
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
  ]);

  const visibleNavItems = computed(() =>
    agentsFeature.enabled.value
      ? navItems.value
      : navItems.value.filter((item) => item.id !== "agents"),
  );
  const activeNavItem = computed(() => navItems.value.find((item) => item.match(route.path)));
  const breadcrumbs = computed(() => buildWorkspaceBreadcrumbs(route.path, t));

  onMounted(() => {
    isCollapsed.value = readStorageValue(NAV_COLLAPSED_STORAGE_KEY) === "true";
    density.value = readStorageValue(NAV_DENSITY_STORAGE_KEY) === "compact" ? "compact" : "comfortable";
    window.addEventListener("keydown", handleNavKeydown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleNavKeydown);
  });

  watch(
    () => route.path,
    () => {
      isMobileOpen.value = false;
      agentsFeatureTooltipVisible.value = false;
    },
  );

  function toggleCollapsed() {
    isCollapsed.value = !isCollapsed.value;
    writeStorageValue(NAV_COLLAPSED_STORAGE_KEY, String(isCollapsed.value));
  }

  function toggleDensity() {
    density.value = density.value === "compact" ? "comfortable" : "compact";
    writeStorageValue(NAV_DENSITY_STORAGE_KEY, density.value);
  }

  function toggleMobileOpen() {
    isMobileOpen.value = !isMobileOpen.value;
  }

  function closeMobileNav() {
    isMobileOpen.value = false;
  }

  function showAgentsFeatureTooltip() {
    agentsFeatureTooltipVisible.value = true;
  }

  function hideAgentsFeatureTooltip() {
    agentsFeatureTooltipVisible.value = false;
  }

  function handleNavKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleCollapsed();
    }
  }

  return {
    activeNavItem,
    agentsFeatureTooltipVisible,
    breadcrumbs,
    closeMobileNav,
    density,
    hideAgentsFeatureTooltip,
    isCollapsed,
    isMobileOpen,
    navItems,
    showAgentsFeatureTooltip,
    toggleCollapsed,
    toggleDensity,
    toggleMobileOpen,
    visibleNavItems,
  };
}

export type WorkspaceNavigationController = ReturnType<typeof useWorkspaceNavigation>;

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

function buildWorkspaceBreadcrumbs(
  path: string,
  t: ReturnType<typeof useAppI18n>["t"],
): WorkspaceBreadcrumb[] {
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
